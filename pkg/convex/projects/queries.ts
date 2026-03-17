import { v } from "convex/values";

import { query } from "../confect";
import { getActiveOrgIdClaimsOrNull } from "../lib/auth";
import {
  projectListItemValidator,
  projectSummaryValidator,
} from "./types";

/**
 * Lists projects for the current authenticated organization.
 *
 * @param ctx The Convex query context.
 * @param args The expected organization slug.
 * @returns The project list with per-project secret counts.
 * @remarks Missing or drifting org claims intentionally return an empty list during org-switch transitions.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const listForCurrentOrg = query({
  args: {
    expectedOrgSlug: v.string(),
  },
  returns: v.array(projectListItemValidator),
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

    const rows = await ctx.db
      .query("projects")
      .withIndex("by_org_id_and_created_at_ms", (q) => q.eq("orgId", activeOrg.orgId))
      .order("desc")
      .collect();

    return Promise.all(
      rows.map(async (row) => {
        const secretCount = (
          await ctx.db
            .query("projectVariables")
            .withIndex("by_org_id_and_project_id", (q) =>
              q.eq("orgId", activeOrg.orgId).eq("projectId", row._id),
            )
            .collect()
        ).length;

        return {
          id: row._id,
          orgId: row.orgId,
          orgSlug: row.orgSlug,
          name: row.name,
          slug: row.slug,
          slugBase: row.slugBase,
          createdByClerkUserId: row.createdByClerkUserId,
          createdAtMs: row.createdAtMs,
          updatedAtMs: row.updatedAtMs,
          secretCount,
        };
      }),
    );
  },
});

/**
 * Looks up a single project for the current authenticated organization by slug.
 *
 * @param ctx The Convex query context.
 * @param args The expected organization slug and project slug.
 * @returns The matching project summary, or `null`.
 * @remarks Missing or drifting org claims intentionally return `null` during org-switch transitions.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const getBySlugForCurrentOrg = query({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
  },
  returns: v.union(projectSummaryValidator, v.null()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }

    const activeOrg = getActiveOrgIdClaimsOrNull(identity);
    if (activeOrg === null) {
      return null;
    }

    if (activeOrg.orgSlug !== null && activeOrg.orgSlug !== args.expectedOrgSlug) {
      return null;
    }

    const row = await ctx.db
      .query("projects")
      .withIndex("by_org_id_and_slug", (q) =>
        q.eq("orgId", activeOrg.orgId).eq("slug", args.projectSlug),
      )
      .unique();

    if (row === null) {
      return null;
    }

    return {
      id: row._id,
      orgId: row.orgId,
      orgSlug: row.orgSlug,
      name: row.name,
      slug: row.slug,
      slugBase: row.slugBase,
      createdByClerkUserId: row.createdByClerkUserId,
      createdAtMs: row.createdAtMs,
      updatedAtMs: row.updatedAtMs,
    };
  },
});
