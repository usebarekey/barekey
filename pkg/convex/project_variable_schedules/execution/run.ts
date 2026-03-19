import { Effect } from "effect";

import type { ActionCtx } from "../../_generated/server";
import { BarekeyConfectActionCtx } from "../../confect";
import { appendAuditEventEffect } from "../../lib/confect/audit";
import { summarizeScheduleEntries } from "../summary";
import type { GetScheduleForExecutionArgs, ScheduleExecutionRow } from "./types";
import {
  applyScheduledVariableWritesEffect,
  markScheduledBatchAppliedEffect,
  markScheduledBatchFailedEffect,
  readScheduleExecutionPayloadEffect,
} from "./repo";

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
    const schedule = (yield* readScheduleExecutionPayloadEffect(
      ctx,
      args,
    )) as ScheduleExecutionRow | null;
    if (schedule === null || schedule.status !== "scheduled") {
      return null;
    }

    const summarizedEntries = summarizeScheduleEntries({
      creates: schedule.preparedCreates,
      updates: schedule.preparedUpdates,
      updateTargets: schedule.updateTargets,
    });

    yield* applyScheduledVariableWritesEffect(ctx, schedule).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          const failureMessage = error instanceof Error ? error.message : "Scheduled update failed.";
          yield* markScheduledBatchFailedEffect(ctx, {
            scheduleId: schedule.scheduleId,
            failureMessage,
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

    yield* markScheduledBatchAppliedEffect(ctx, schedule.scheduleId);
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
