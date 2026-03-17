import { v } from "convex/values";

import { internal } from "../_generated/api";
import { mutation } from "../confect";
import { requireCurrentOrgProjectAccess } from "./access";

/**
 * Cancels a scheduled variable batch that has not executed yet.
 *
 * @param ctx The Convex public mutation context.
 * @param args The workspace, project, and schedule identifier to cancel.
 * @returns `null` after the schedule is canceled.
 * @remarks This cancels the pending scheduler handle, marks the row as canceled, and appends an audit event.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const cancelForCurrentOrgProject = mutation({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
    scheduleId: v.id("projectVariableSchedules"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { activeOrg, project } = await requireCurrentOrgProjectAccess(
      ctx,
      args.expectedOrgSlug,
      args.projectSlug,
    );

    const schedule = await ctx.db.get(args.scheduleId);
    if (schedule === null || schedule.projectId !== project._id) {
      throw new Error("Scheduled update not found.");
    }
    if (schedule.status !== "scheduled") {
      throw new Error("Only scheduled updates can be canceled.");
    }

    if (schedule.scheduledFunctionId !== null) {
      await ctx.scheduler.cancel(schedule.scheduledFunctionId);
    }

    const now = Date.now();
    await ctx.db.patch(schedule._id, {
      status: "canceled",
      scheduledFunctionId: null,
      updatedByClerkUserId: activeOrg.clerkUserId,
      updatedAtMs: now,
      canceledAtMs: now,
    });

    await ctx.runMutation(internal.audit.appendEventInternal, {
      orgId: activeOrg.orgId,
      orgSlug: activeOrg.orgSlug ?? args.expectedOrgSlug,
      projectId: project._id,
      projectSlug: project.slug,
      stageSlug: schedule.stageSlug,
      eventType: "schedule.canceled",
      category: "schedule",
      actorSource: "barekey_user",
      actorClerkUserId: activeOrg.clerkUserId,
      actorDisplayName: null,
      actorEmail: null,
      subjectType: "schedule",
      subjectId: String(schedule._id),
      subjectName: schedule.stageSlug,
      title: "Canceled scheduled variable batch",
      description: `A scheduled batch for ${project.slug}/${schedule.stageSlug} was canceled.`,
      severity: "warning",
      payloadJson: JSON.stringify({
        timezone: schedule.timezone,
        runAtMs: schedule.runAtMs,
        counts: {
          created: schedule.createdCount,
          updated: schedule.updatedCount,
        },
      }),
      retentionTierOverride: null,
    });

    return null;
  },
});
