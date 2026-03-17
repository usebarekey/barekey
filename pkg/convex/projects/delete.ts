import { v } from "convex/values";

import { internal } from "../_generated/api";
import { mutation } from "../confect";
import {
  assertExpectedOrgSlug,
  requireActiveOrgIdClaims,
  requireIdentity,
} from "../lib/auth";

/**
 * Deletes a project when it no longer contains stages or variables.
 *
 * @param ctx The Convex mutation context.
 * @param args The expected organization slug and project slug.
 * @returns The deleted project identifier and slug.
 * @remarks This deletes project keys before removing the project row and appends a project deletion audit event.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const deleteForCurrentOrg = mutation({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
  },
  returns: v.object({
    deletedProjectId: v.id("projects"),
    deletedProjectSlug: v.string(),
  }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    const project = await ctx.db
      .query("projects")
      .withIndex("by_org_id_and_slug", (q) =>
        q.eq("orgId", activeOrg.orgId).eq("slug", args.projectSlug),
      )
      .unique();

    if (project === null) {
      throw new Error("Project not found.");
    }

    const [variables, stages] = await Promise.all([
      ctx.db
        .query("projectVariables")
        .withIndex("by_org_id_and_project_id", (q) =>
          q.eq("orgId", activeOrg.orgId).eq("projectId", project._id),
        )
        .collect(),
      ctx.db
        .query("projectStages")
        .withIndex("by_org_id_and_project_id", (q) =>
          q.eq("orgId", activeOrg.orgId).eq("projectId", project._id),
        )
        .collect(),
    ]);

    if (variables.length > 0 || stages.length > 0) {
      throw new Error(
        `Delete blocked. Remove all environments and variables first (${stages.length} environments, ${variables.length} variables remaining).`,
      );
    }

    const keys = await ctx.db
      .query("projectKeys")
      .withIndex("by_org_id_and_project_id", (q) =>
        q.eq("orgId", activeOrg.orgId).eq("projectId", project._id),
      )
      .collect();

    for (const row of keys) {
      await ctx.db.delete(row._id);
    }

    await ctx.db.delete(project._id);

    await ctx.runMutation(internal.audit.appendEventInternal, {
      orgId: activeOrg.orgId,
      orgSlug: activeOrg.orgSlug ?? args.expectedOrgSlug,
      projectId: project._id,
      projectSlug: project.slug,
      stageSlug: null,
      eventType: "project.deleted",
      category: "project",
      actorSource: "barekey_user",
      actorClerkUserId: activeOrg.clerkUserId,
      actorDisplayName: null,
      actorEmail: null,
      subjectType: "project",
      subjectId: String(project._id),
      subjectName: project.name,
      title: `Deleted project ${project.name}`,
      description: `Project ${project.name} and its keys were removed from this workspace.`,
      severity: "warning",
      payloadJson: JSON.stringify({
        projectSlug: project.slug,
        deletedKeyCount: keys.length,
      }),
      retentionTierOverride: null,
    });

    return {
      deletedProjectId: project._id,
      deletedProjectSlug: project.slug,
    };
  },
});
