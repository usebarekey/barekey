import { Effect } from "effect";

import type { ActionCtx } from "../../_generated/server";
import { BarekeyConfectActionCtx } from "../../confect";
import { appendAuditEventEffect } from "../../lib/confect/audit";
import { applyPreparedVariableWritesForOrgProjectStageWithUsageInternalReference } from "../../project_variables/refs";
import { toScheduleExternalServiceError } from "../errors";
import {
  getScheduleForExecutionInternalReference,
  markScheduleAppliedInternalReference,
  markScheduleFailedInternalReference,
} from "../refs";
import { summarizeScheduleEntries } from "../summary";
import type { GetScheduleForExecutionArgs, ScheduleExecutionRow } from "./types";

/**
 * Executes a pending scheduled variable batch.
 *
 * @param args The schedule identifier to execute.
 * @returns `null` after execution or when the schedule is no longer pending.
 * @remarks This delegates actual writes to the prepared variable write pipeline, then appends success or failure audit events.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function executeScheduledVariableScheduleInternalEffect(
  args: GetScheduleForExecutionArgs,
): Effect.Effect<null, unknown, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectActionCtx;
    const ctx = confectCtx.ctx as unknown as ActionCtx;
    const schedule = (yield* Effect.tryPromise({
      try: () =>
        ctx.runQuery(getScheduleForExecutionInternalReference, {
          scheduleId: args.scheduleId,
        }) as Promise<ScheduleExecutionRow | null>,
      catch: (error) =>
        toScheduleExternalServiceError(
          "Failed to load the scheduled batch execution payload.",
          error,
        ),
    })) as ScheduleExecutionRow | null;
    if (schedule === null || schedule.status !== "scheduled") {
      return null;
    }

    const summarizedEntries = summarizeScheduleEntries({
      creates: schedule.preparedCreates,
      updates: schedule.preparedUpdates,
      updateTargets: schedule.updateTargets,
    });

    yield* Effect.tryPromise({
      try: () =>
        ctx.runAction(
          applyPreparedVariableWritesForOrgProjectStageWithUsageInternalReference,
          {
            orgId: schedule.orgId,
            orgSlug: null,
            clerkUserId: "scheduled-system",
            projectSlug: schedule.projectSlug,
            stageSlug: schedule.stageSlug,
            creates: schedule.preparedCreates,
            updates: schedule.preparedUpdates,
            deletes: [],
          },
        ),
      catch: (error) =>
        toScheduleExternalServiceError("Scheduled update failed.", error),
    }).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          const failureMessage = error instanceof Error ? error.message : "Scheduled update failed.";
          yield* Effect.tryPromise({
            try: () =>
              ctx.runMutation(markScheduleFailedInternalReference, {
                scheduleId: schedule.scheduleId,
                failureMessage,
              }),
            catch: (markError) =>
              toScheduleExternalServiceError(
                "Failed to mark the scheduled batch as failed.",
                markError,
              ),
          });
          yield* appendAuditEventEffect({
            orgId: schedule.orgId,
            orgSlug: schedule.orgSlug,
            projectId: schedule.projectId,
            projectSlug: schedule.projectSlug,
            stageSlug: schedule.stageSlug,
            eventType: "schedule.failed",
            category: "schedule",
            actorSource: "scheduler",
            actorClerkUserId: null,
            actorDisplayName: "Scheduler",
            actorEmail: null,
            subjectType: "schedule",
            subjectId: String(schedule.scheduleId),
            subjectName: schedule.stageSlug,
            title: "Scheduled variable batch failed",
            description: `A scheduled batch for ${schedule.projectSlug}/${schedule.stageSlug} failed to apply.`,
            severity: "warning",
            payloadJson: JSON.stringify({
              timezone: schedule.timezone,
              runAtMs: schedule.runAtMs,
              counts: {
                created: schedule.createdCount,
                updated: schedule.updatedCount,
              },
              failureMessage,
            }),
            retentionTierOverride: null,
          });
          return yield* Effect.fail(error);
        }),
      ),
    );

    yield* Effect.tryPromise({
      try: () =>
        ctx.runMutation(markScheduleAppliedInternalReference, {
          scheduleId: schedule.scheduleId,
        }),
      catch: (error) =>
        toScheduleExternalServiceError("Failed to mark the scheduled batch as applied.", error),
    });
    yield* appendAuditEventEffect({
      orgId: schedule.orgId,
      orgSlug: schedule.orgSlug,
      projectId: schedule.projectId,
      projectSlug: schedule.projectSlug,
      stageSlug: schedule.stageSlug,
      eventType: "schedule.executed",
      category: "schedule",
      actorSource: "scheduler",
      actorClerkUserId: null,
      actorDisplayName: "Scheduler",
      actorEmail: null,
      subjectType: "schedule",
      subjectId: String(schedule.scheduleId),
      subjectName: schedule.stageSlug,
      title: "Executed scheduled variable batch",
      description: `A scheduled batch for ${schedule.projectSlug}/${schedule.stageSlug} applied successfully.`,
      severity: summarizedEntries.some((entry) => entry.visibility === "private")
        ? "sensitive"
        : "info",
      payloadJson: JSON.stringify({
        timezone: schedule.timezone,
        runAtMs: schedule.runAtMs,
        counts: {
          created: schedule.createdCount,
          updated: schedule.updatedCount,
        },
        variables: summarizedEntries,
      }),
      retentionTierOverride: null,
    });

    return null;
  });
}
