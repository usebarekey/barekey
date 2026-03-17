import { v } from "convex/values";

import { internal } from "../_generated/api";
import { mutation } from "../confect";
import {
  assertExpectedOrgSlug,
  requireActiveOrgIdClaims,
  requireIdentity,
} from "../lib/auth";
import { requireProjectBySlugForOrg } from "./access";

/**
 * Deletes a stage only when it contains no variables.
 *
 * @param ctx The Convex mutation context.
 * @param args The expected org slug, project slug, and stage slug.
 * @returns The deleted stage slug.
 * @remarks This prevents data loss by blocking deletion when variables still exist and appends a stage deletion audit event.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const deleteForCurrentOrgProject = mutation({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
  },
  returns: v.object({
    deletedStageSlug: v.string(),
  }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    const project = await requireProjectBySlugForOrg(ctx, {
      orgId: activeOrg.orgId,
      projectSlug: args.projectSlug,
    });

    const stage = await ctx.db
      .query("projectStages")
      .withIndex("by_project_id_and_slug", (q) =>
        q.eq("projectId", project._id).eq("slug", args.stageSlug),
      )
      .unique();
    if (stage === null) {
      throw new Error("Stage not found.");
    }

    const existingVariables = await ctx.db
      .query("projectVariables")
      .withIndex("by_project_id_and_stage_slug", (q) =>
        q.eq("projectId", project._id).eq("stageSlug", stage.slug),
      )
      .collect();
    if (existingVariables.length > 0) {
      throw new Error("Cannot delete a stage that still contains variables.");
    }

    await ctx.db.delete(stage._id);

    await ctx.runMutation(internal.audit.appendEventInternal, {
      orgId: activeOrg.orgId,
      orgSlug: activeOrg.orgSlug ?? args.expectedOrgSlug,
      projectId: project._id,
      projectSlug: project.slug,
      stageSlug: stage.slug,
      eventType: "stage.deleted",
      category: "stage",
      actorSource: "barekey_user",
      actorClerkUserId: activeOrg.clerkUserId,
      actorDisplayName: null,
      actorEmail: null,
      subjectType: "stage",
      subjectId: String(stage._id),
      subjectName: stage.name,
      title: `Deleted stage ${stage.name}`,
      description: `Stage ${stage.name} was removed from project ${project.name}.`,
      severity: "warning",
      payloadJson: JSON.stringify({
        projectSlug: project.slug,
        stageSlug: stage.slug,
      }),
      retentionTierOverride: null,
    });

    return {
      deletedStageSlug: stage.slug,
    };
  },
});
