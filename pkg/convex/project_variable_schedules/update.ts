import { Effect } from "effect";
import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  BarekeyConfectMutationCtx,
  ClockService,
  effectMutation,
} from "../confect";
import { appendAuditEventEffect } from "../lib/confect/audit";
import { NotFoundError, ValidationError } from "../lib/errors/effect";
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

type UpdateForCurrentOrgProjectArgs = {
  expectedOrgSlug: string;
  projectSlug: string;
  scheduleId: Id<"projectVariableSchedules">;
  stageSlug: string;
  timezone: string;
  runAtMs: number;
  creates: Array<ScheduledCreateEntry>;
  updates: Array<ScheduledUpdateEntry>;
};

function updateForCurrentOrgProjectEffect(
  args: UpdateForCurrentOrgProjectArgs,
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

    const existingSchedule: Doc<"projectVariableSchedules"> | null =
      yield* Effect.tryPromise({
      try: () => ctx.db.get(args.scheduleId),
      catch: (error) =>
        toScheduleExternalServiceError("Failed to load the scheduled variable batch.", error),
    });
    if (existingSchedule === null || existingSchedule.projectId !== project._id) {
      return yield* Effect.fail(new NotFoundError({ message: "Scheduled update not found." }));
    }
    if (existingSchedule.status !== "scheduled") {
      return yield* Effect.fail(
        new ValidationError({ message: "Only scheduled updates can be edited." }),
      );
    }

    const stage = yield* requireStageInProjectEffect(ctx, project._id, args.stageSlug);
    const timezone = yield* validateTimeZoneEffect(args.timezone);
    const runAtMs = yield* validateRunAtMsEffect(args.runAtMs);

    const snapshot = yield* buildPreparedScheduleSnapshotEffect({
      ctx,
      orgId: activeOrg.orgId,
      clerkUserId: activeOrg.clerkUserId,
      projectSlug: args.projectSlug,
      stageSlug: stage.slug,
      creates: args.creates,
      updates: args.updates,
    });

    if (existingSchedule.scheduledFunctionId !== null) {
      yield* Effect.tryPromise({
        try: () => ctx.scheduler.cancel(existingSchedule.scheduledFunctionId!),
        catch: (error) =>
          toScheduleExternalServiceError(
            "Failed to cancel the existing scheduled execution.",
            error,
          ),
      });
    }

    const scheduledFunctionId = yield* Effect.tryPromise({
      try: () =>
        ctx.scheduler.runAt(
          runAtMs,
          executeScheduledVariableScheduleInternalReference,
          {
            scheduleId: existingSchedule._id,
          },
        ),
      catch: (error) =>
        toScheduleExternalServiceError("Failed to reschedule the variable batch execution.", error),
    });

    const updatedAtMs = clock.nowMs();
    yield* Effect.tryPromise({
      try: () =>
        ctx.db.patch(existingSchedule._id, {
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
          updatedByClerkUserId: activeOrg.clerkUserId,
          updatedAtMs,
          executedAtMs: null,
          canceledAtMs: null,
          failedAtMs: null,
          failureMessage: null,
        }),
      catch: (error) =>
        toScheduleExternalServiceError("Failed to update the scheduled variable batch.", error),
    });
    const persistedSchedule: Doc<"projectVariableSchedules"> | null =
      yield* attachScheduledFunctionIdIfStillPendingEffect({
      ctx,
      scheduleId: existingSchedule._id,
      scheduledFunctionId,
    });

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
      eventType: "schedule.updated",
      category: "schedule",
      actorSource: "barekey_user",
      actorClerkUserId: activeOrg.clerkUserId,
      actorDisplayName: null,
      actorEmail: null,
      subjectType: "schedule",
      subjectId: String(existingSchedule._id),
      subjectName: stage.name,
      title: "Updated scheduled variable batch",
      description: `The scheduled batch for ${project.slug}/${stage.slug} was edited.`,
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
      id: existingSchedule._id,
      stageSlug: stage.slug,
      stageName: stage.name,
      timezone,
      runAtMs,
      status: persistedSchedule?.status ?? "scheduled",
      createdCount: snapshot.createdCount,
      updatedCount: snapshot.updatedCount,
      batchNames: scheduleBatchNames({
        creates: snapshot.preparedCreates,
        updateTargets: snapshot.updateTargets,
      }),
      createdAtMs: existingSchedule.createdAtMs,
      updatedAtMs,
      executedAtMs: persistedSchedule?.executedAtMs ?? null,
      canceledAtMs: persistedSchedule?.canceledAtMs ?? null,
      failedAtMs: persistedSchedule?.failedAtMs ?? null,
      failureMessage: persistedSchedule?.failureMessage ?? null,
    });
  });
}

/**
 * Updates an existing scheduled variable batch.
 *
 * @param ctx The Convex public mutation context.
 * @param args The workspace, project, schedule, stage, timing, and pending variable changes.
 * @returns The persisted scheduled batch summary after the edit.
 * @remarks This rewrites the prepared snapshot, reschedules execution, and appends an audit event.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const updateForCurrentOrgProject = effectMutation<
  UpdateForCurrentOrgProjectArgs,
  ReturnType<typeof toScheduledScheduleSummary>,
  any
>({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
    scheduleId: v.id("projectVariableSchedules"),
    stageSlug: v.string(),
    timezone: v.string(),
    runAtMs: v.number(),
    creates: v.array(projectVariableScheduleCreateEntryValidator),
    updates: v.array(projectVariableScheduleUpdateEntryValidator),
  },
  returns: scheduledScheduleSummaryValidator,
  handler: updateForCurrentOrgProjectEffect,
});
