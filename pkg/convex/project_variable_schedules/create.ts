import { Effect } from "effect";
import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  BarekeyConfectMutationCtx,
  ClockService,
  effectMutation,
} from "../confect";
import { appendAuditEventEffect } from "../lib/confect/audit";
import {
  requireCurrentOrgProjectAccessEffect,
  requireStageInProjectEffect,
} from "./access";
import { toScheduleExternalServiceError } from "./errors";
import {
  attachScheduledFunctionIdIfStillPendingEffect,
  buildPreparedScheduleSnapshotEffect,
} from "./snapshot";
import {
  scheduleBatchNames,
  summarizeScheduleEntries,
  toScheduledScheduleSummary,
} from "./summary";
import { executeScheduledVariableScheduleInternalReference } from "./refs";
import type { ScheduledCreateEntry, ScheduledUpdateEntry } from "./types";
import {
  projectVariableScheduleCreateEntryValidator,
  projectVariableScheduleUpdateEntryValidator,
  scheduledScheduleSummaryValidator,
  validateRunAtMsEffect,
  validateTimeZoneEffect,
} from "./validators";

type CreateForCurrentOrgProjectArgs = {
  expectedOrgSlug: string;
  projectSlug: string;
  stageSlug: string;
  timezone: string;
  runAtMs: number;
  creates: Array<ScheduledCreateEntry>;
  updates: Array<ScheduledUpdateEntry>;
};

function createForCurrentOrgProjectEffect(
  args: CreateForCurrentOrgProjectArgs,
): Effect.Effect<ReturnType<typeof toScheduledScheduleSummary>, unknown, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectMutationCtx;
    const clock = yield* ClockService;
    const ctx = confectCtx.ctx as unknown as MutationCtx;
    const { activeOrg, project } = yield* requireCurrentOrgProjectAccessEffect(
      ctx,
      args.expectedOrgSlug,
      args.projectSlug,
    );

    const stage = yield* requireStageInProjectEffect(ctx, project._id, args.stageSlug);
    const timezone = yield* validateTimeZoneEffect(args.timezone);
    const runAtMs = yield* validateRunAtMsEffect(args.runAtMs);
    const now = clock.nowMs();

    const snapshot = yield* buildPreparedScheduleSnapshotEffect({
      ctx,
      orgId: activeOrg.orgId,
      clerkUserId: activeOrg.clerkUserId,
      projectSlug: args.projectSlug,
      stageSlug: stage.slug,
      creates: args.creates,
      updates: args.updates,
    });

    const scheduleId = yield* Effect.tryPromise({
      try: () =>
        ctx.db.insert("projectVariableSchedules", {
          projectId: project._id,
          orgId: activeOrg.orgId,
          stageSlug: stage.slug,
          timezone,
          runAtMs,
          status: "scheduled",
          scheduledFunctionId: null,
          preparedCreates: snapshot.preparedCreates,
          preparedUpdates: snapshot.preparedUpdates,
          updateTargets: snapshot.updateTargets,
          createdCount: snapshot.createdCount,
          updatedCount: snapshot.updatedCount,
          createdByClerkUserId: activeOrg.clerkUserId,
          updatedByClerkUserId: activeOrg.clerkUserId,
          createdAtMs: now,
          updatedAtMs: now,
          executedAtMs: null,
          canceledAtMs: null,
          failedAtMs: null,
          failureMessage: null,
        }),
      catch: (error) =>
        toScheduleExternalServiceError("Failed to create the scheduled variable batch.", error),
    });

    const scheduledFunctionId = yield* Effect.tryPromise({
      try: () =>
        ctx.scheduler.runAt(
          runAtMs,
          executeScheduledVariableScheduleInternalReference,
          {
            scheduleId,
          },
        ),
      catch: (error) =>
        toScheduleExternalServiceError("Failed to schedule the variable batch execution.", error),
    });

    const persistedSchedule: Doc<"projectVariableSchedules"> | null =
      yield* attachScheduledFunctionIdIfStillPendingEffect({
      ctx,
      scheduleId,
      scheduledFunctionId,
    });
    const currentSchedule: Doc<"projectVariableSchedules"> | null =
      persistedSchedule ??
      (yield* Effect.tryPromise({
        try: () => ctx.db.get(scheduleId),
        catch: (error) =>
          toScheduleExternalServiceError(
            "Failed to reload the scheduled batch after scheduling it.",
            error,
          ),
      }));
    const currentStatus = currentSchedule?.status ?? "scheduled";
    const currentExecutedAtMs = currentSchedule?.executedAtMs ?? null;
    const currentCanceledAtMs = currentSchedule?.canceledAtMs ?? null;
    const currentFailedAtMs = currentSchedule?.failedAtMs ?? null;
    const currentFailureMessage = currentSchedule?.failureMessage ?? null;

    const summarizedEntries = summarizeScheduleEntries({
      creates: snapshot.preparedCreates,
      updates: snapshot.preparedUpdates,
      updateTargets: snapshot.updateTargets,
    });

    yield* appendAuditEventEffect({
      orgId: activeOrg.orgId,
      orgSlug: activeOrg.orgSlug ?? args.expectedOrgSlug,
      projectId: project._id,
      projectSlug: project.slug,
      stageSlug: stage.slug,
      eventType: "schedule.created",
      category: "schedule",
      actorSource: "barekey_user",
      actorClerkUserId: activeOrg.clerkUserId,
      actorDisplayName: null,
      actorEmail: null,
      subjectType: "schedule",
      subjectId: String(scheduleId),
      subjectName: stage.name,
      title: `Scheduled ${snapshot.createdCount + snapshot.updatedCount} variable change${snapshot.createdCount + snapshot.updatedCount === 1 ? "" : "s"}`,
      description: `A scheduled batch was created for ${project.slug}/${stage.slug}.`,
      severity: summarizedEntries.some((entry) => entry.visibility === "private")
        ? "sensitive"
        : "info",
      payloadJson: JSON.stringify({
        timezone,
        runAtMs,
        counts: {
          created: snapshot.createdCount,
          updated: snapshot.updatedCount,
        },
        variables: summarizedEntries,
      }),
      retentionTierOverride: null,
    });

    return toScheduledScheduleSummary({
      id: scheduleId,
      stageSlug: stage.slug,
      stageName: stage.name,
      timezone,
      runAtMs,
      status: currentStatus,
      createdCount: snapshot.createdCount,
      updatedCount: snapshot.updatedCount,
      batchNames: scheduleBatchNames({
        creates: snapshot.preparedCreates,
        updateTargets: snapshot.updateTargets,
      }),
      createdAtMs: now,
      updatedAtMs: now,
      executedAtMs: currentExecutedAtMs,
      canceledAtMs: currentCanceledAtMs,
      failedAtMs: currentFailedAtMs,
      failureMessage: currentFailureMessage,
    });
  });
}

/**
 * Creates a new scheduled variable batch for a project stage.
 *
 * @param ctx The Convex public mutation context.
 * @param args The workspace, project, stage, schedule timing, and pending variable changes.
 * @returns The persisted scheduled batch summary.
 * @remarks This stores the encrypted prepared snapshot, schedules execution, and appends an audit event.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const createForCurrentOrgProject = effectMutation<
  CreateForCurrentOrgProjectArgs,
  ReturnType<typeof toScheduledScheduleSummary>,
  any
>({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
    timezone: v.string(),
    runAtMs: v.number(),
    creates: v.array(projectVariableScheduleCreateEntryValidator),
    updates: v.array(projectVariableScheduleUpdateEntryValidator),
  },
  returns: scheduledScheduleSummaryValidator,
  handler: createForCurrentOrgProjectEffect,
});
