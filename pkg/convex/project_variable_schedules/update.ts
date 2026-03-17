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
 * Updates an existing scheduled variable batch.
 *
 * @param ctx The Convex public mutation context.
 * @param args The workspace, project, schedule, stage, timing, and pending variable changes.
 * @returns The persisted scheduled batch summary after the edit.
 * @remarks This rewrites the prepared snapshot, reschedules execution, and appends an audit event.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const updateForCurrentOrgProject = mutation({
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
  handler: async (ctx, args) => {
    const { activeOrg, project } = await requireCurrentOrgProjectAccess(
      ctx,
      args.expectedOrgSlug,
      args.projectSlug,
    );

    const existingSchedule = await ctx.db.get(args.scheduleId);
    if (existingSchedule === null || existingSchedule.projectId !== project._id) {
      throw new Error("Scheduled update not found.");
    }
    if (existingSchedule.status !== "scheduled") {
      throw new Error("Only scheduled updates can be edited.");
    }

    const stage = await requireStageInProject(ctx, project._id, args.stageSlug);
    const timezone = validateTimeZone(args.timezone);
    const runAtMs = validateRunAtMs(args.runAtMs);

    const snapshot = await buildPreparedScheduleSnapshot({
      ctx,
      orgId: activeOrg.orgId,
      clerkUserId: activeOrg.clerkUserId,
      projectSlug: args.projectSlug,
      stageSlug: stage.slug,
      creates: args.creates as Array<ScheduledCreateEntry>,
      updates: args.updates as Array<ScheduledUpdateEntry>,
    });

    if (existingSchedule.scheduledFunctionId !== null) {
      await ctx.scheduler.cancel(existingSchedule.scheduledFunctionId);
    }

    const scheduledFunctionId = await ctx.scheduler.runAt(
      runAtMs,
      internal.project_variable_schedules.executeScheduledVariableScheduleInternal,
      {
        scheduleId: existingSchedule._id,
      },
    );

    const updatedAtMs = Date.now();
    await ctx.db.patch(existingSchedule._id, {
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
    });
    const persistedSchedule = await attachScheduledFunctionIdIfStillPending({
      ctx,
      scheduleId: existingSchedule._id,
      scheduledFunctionId,
    });

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
  },
});
