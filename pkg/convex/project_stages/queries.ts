import { v } from "convex/values";

import { query } from "../confect";
import { getActiveOrgIdClaimsOrNull } from "../lib/auth";
import { countVariablesForStage, findProjectBySlugForOrg } from "./access";
import { stageSummaryValidator } from "./types";

/**
 * Lists stages for a project, including per-stage variable counts.
 *
 * @param ctx The Convex query context.
 * @param args The expected org slug and project slug.
 * @returns The stage summaries for the project.
 * @remarks Missing or drifting org claims intentionally return an empty list during org-switch transitions.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const listForCurrentOrgProject = query({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
  },
  returns: v.array(stageSummaryValidator),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return [];
    }

    const activeOrg = getActiveOrgIdClaimsOrNull(identity);
    if (activeOrg === null) {
      return [];
    }

    if (activeOrg.orgSlug !== null && activeOrg.orgSlug !== args.expectedOrgSlug) {
      return [];
    }

    const project = await findProjectBySlugForOrg(ctx, {
      orgId: activeOrg.orgId,
      projectSlug: args.projectSlug,
    });
    if (project === null) {
      return [];
    }

    const stages = await ctx.db
      .query("projectStages")
      .withIndex("by_project_id", (q) => q.eq("projectId", project._id))
      .collect();

    return Promise.all(
      stages.map(async (stage) => ({
        id: stage._id,
        projectId: stage.projectId,
        orgId: stage.orgId,
        slug: stage.slug,
        name: stage.name,
        isDefault: stage.isDefault,
        variableCount: await countVariablesForStage(ctx, {
          projectId: project._id,
          stageSlug: stage.slug,
        }),
        createdAtMs: stage.createdAtMs,
        updatedAtMs: stage.updatedAtMs,
      })),
    );
  },
});
