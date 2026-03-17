import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction, internalMutation, internalQuery } from "../confect";
import {
  summarizeScheduleEntries,
} from "./snapshot";
import {
  projectVariableScheduleStatusValidator,
  scheduleExecutionRowValidator,
} from "./validators";

/**
 * Loads the data needed by the scheduler to execute a pending variable batch.
 *
 * @param ctx The Convex internal query context.
 * @param args The schedule identifier to load.
 * @returns The execution payload for the schedule, or `null` when it no longer exists.
 * @remarks This joins the schedule row with the owning project so scheduler actions do not need extra lookups.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const getScheduleForExecutionInternal = internalQuery({
  args: {
    scheduleId: v.id("projectVariableSchedules"),
  },
  returns: scheduleExecutionRowValidator,
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get(args.scheduleId);
    if (schedule === null) {
      return null;
    }

    const project = await ctx.db.get(schedule.projectId);
    if (project === null) {
      return null;
    }

    return {
      scheduleId: schedule._id,
      projectId: project._id,
      orgSlug: project.orgSlug,
      projectSlug: project.slug,
      orgId: schedule.orgId,
      stageSlug: schedule.stageSlug,
      timezone: schedule.timezone,
      runAtMs: schedule.runAtMs,
      createdCount: schedule.createdCount,
      updatedCount: schedule.updatedCount,
      preparedCreates: schedule.preparedCreates,
      preparedUpdates: schedule.preparedUpdates,
      updateTargets: schedule.updateTargets,
      status: schedule.status,
    };
  },
});

/**
 * Marks a scheduled batch as applied after successful execution.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The schedule identifier to mark applied.
 * @returns `null` after the schedule row is updated.
 * @remarks This clears the scheduler handle and stamps the execution timestamp.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const markScheduleAppliedInternal = internalMutation({
  args: {
    scheduleId: v.id("projectVariableSchedules"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get(args.scheduleId);
    if (schedule === null) {
      return null;
    }

    const now = Date.now();
    await ctx.db.patch(schedule._id, {
      status: "applied",
      scheduledFunctionId: null,
      updatedAtMs: now,
      executedAtMs: now,
      failedAtMs: null,
      failureMessage: null,
    });
    return null;
  },
});

/**
 * Marks a scheduled batch as failed after unsuccessful execution.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The schedule identifier and failure message.
 * @returns `null` after the schedule row is updated.
 * @remarks This clears the scheduler handle, stamps the failure timestamp, and stores the failure message.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const markScheduleFailedInternal = internalMutation({
  args: {
    scheduleId: v.id("projectVariableSchedules"),
    failureMessage: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get(args.scheduleId);
    if (schedule === null) {
      return null;
    }

    const now = Date.now();
    await ctx.db.patch(schedule._id, {
      status: "failed",
      scheduledFunctionId: null,
      updatedAtMs: now,
      failedAtMs: now,
      failureMessage: args.failureMessage,
    });
    return null;
  },
});

/**
 * Executes a pending scheduled variable batch.
 *
 * @param ctx The Convex internal action context.
 * @param args The schedule identifier to execute.
 * @returns `null` after execution or when the schedule is no longer pending.
 * @remarks This delegates actual writes to the prepared variable write pipeline, then appends success or failure audit events.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const executeScheduledVariableScheduleInternal = internalAction({
  args: {
    scheduleId: v.id("projectVariableSchedules"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const schedule = await ctx.runQuery(
      internal.project_variable_schedules.getScheduleForExecutionInternal,
      {
        scheduleId: args.scheduleId,
      },
    );
    if (schedule === null || schedule.status !== "scheduled") {
      return null;
    }

    const summarizedEntries = summarizeScheduleEntries({
      creates: schedule.preparedCreates,
      updates: schedule.preparedUpdates,
      updateTargets: schedule.updateTargets,
    });

    try {
      await ctx.runAction(
        internal.project_variables.applyPreparedVariableWritesForOrgProjectStageWithUsageInternal,
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
      );

      await ctx.runMutation(internal.project_variable_schedules.markScheduleAppliedInternal, {
        scheduleId: schedule.scheduleId,
      });
      await ctx.runMutation(internal.audit.appendEventInternal, {
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
    } catch (error: unknown) {
      const failureMessage = error instanceof Error ? error.message : "Scheduled update failed.";
      await ctx.runMutation(internal.project_variable_schedules.markScheduleFailedInternal, {
        scheduleId: schedule.scheduleId,
        failureMessage,
      });
      await ctx.runMutation(internal.audit.appendEventInternal, {
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
      throw error;
    }

    return null;
  },
});
