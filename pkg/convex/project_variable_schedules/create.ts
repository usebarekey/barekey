import { v } from "convex/values";

import { internal } from "../_generated/api";
import { mutation } from "../confect";
import {
  requireCurrentOrgProjectAccess,
  requireStageInProject,
} from "./access";
import {
  attachScheduledFunctionIdIfStillPending,
  buildPreparedScheduleSnapshot,
  scheduleBatchNames,
  summarizeScheduleEntries,
  toScheduledScheduleSummary,
} from "./snapshot";
import type { ScheduledCreateEntry, ScheduledUpdateEntry } from "./types";
import {
  projectVariableScheduleCreateEntryValidator,
  projectVariableScheduleUpdateEntryValidator,
  scheduledScheduleSummaryValidator,
  validateRunAtMs,
  validateTimeZone,
} from "./validators";

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
export const createForCurrentOrgProject = mutation({
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
  handler: async (ctx, args) => {
    const { activeOrg, project } = await requireCurrentOrgProjectAccess(
      ctx,
      args.expectedOrgSlug,
      args.projectSlug,
    );

    const stage = await requireStageInProject(ctx, project._id, args.stageSlug);
    const timezone = validateTimeZone(args.timezone);
    const runAtMs = validateRunAtMs(args.runAtMs);
    const now = Date.now();

    const snapshot = await buildPreparedScheduleSnapshot({
      ctx,
      orgId: activeOrg.orgId,
      clerkUserId: activeOrg.clerkUserId,
      projectSlug: args.projectSlug,
      stageSlug: stage.slug,
      creates: args.creates as Array<ScheduledCreateEntry>,
      updates: args.updates as Array<ScheduledUpdateEntry>,
    });

    const scheduleId = await ctx.db.insert("projectVariableSchedules", {
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
    });

    const scheduledFunctionId = await ctx.scheduler.runAt(
      runAtMs,
      internal.project_variable_schedules.executeScheduledVariableScheduleInternal,
      {
        scheduleId,
      },
    );

    const persistedSchedule = await attachScheduledFunctionIdIfStillPending({
      ctx,
      scheduleId,
      scheduledFunctionId,
    });
    const currentSchedule = persistedSchedule ?? (await ctx.db.get(scheduleId));
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

    await ctx.runMutation(internal.audit.appendEventInternal, {
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
  },
});
