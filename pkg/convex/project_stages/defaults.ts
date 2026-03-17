import { v } from "convex/values";

import { mutation } from "../confect";
import {
  assertExpectedOrgSlug,
  requireActiveOrgIdClaims,
  requireIdentity,
} from "../lib/auth";
import { requireProjectBySlugForOrg } from "./access";
import { DEFAULT_STAGE_DEFINITIONS } from "./types";

/**
 * Ensures the canonical default stages exist for a project.
 *
 * @param ctx The Convex mutation context.
 * @param args The expected org slug and project slug.
 * @returns The number of default stages created.
 * @remarks This is idempotent and backfills missing default `projectStages` rows.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const ensureDefaultStagesForCurrentOrgProject = mutation({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
  },
  returns: v.object({
    createdCount: v.number(),
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

    const existingStages = await ctx.db
      .query("projectStages")
      .withIndex("by_project_id", (q) => q.eq("projectId", project._id))
      .collect();
    const existingSlugs = new Set(existingStages.map((stage) => stage.slug));

    let createdCount = 0;
    for (const definition of DEFAULT_STAGE_DEFINITIONS) {
      if (existingSlugs.has(definition.slug)) {
        continue;
      }

      const now = Date.now();
      await ctx.db.insert("projectStages", {
        projectId: project._id,
        orgId: activeOrg.orgId,
        slug: definition.slug,
        name: definition.name,
        isDefault: true,
        createdAtMs: now,
        updatedAtMs: now,
      });
      createdCount += 1;
    }

    return {
      createdCount,
    };
  },
});
