import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import {
  assertExpectedOrgSlug,
  getActiveOrgIdClaimsOrNull,
  requireIdentity,
  requireActiveOrgIdClaims,
} from "./lib/auth";

function normalizeProjectSlugBase(name: string): string {
  const normalized = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/g, "")
    .replace(/-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");

  return normalized.length > 0 ? normalized : "project";
}

function randomNumericSuffix(length: number): string {
  const upperBound = 10 ** length;
  const value = Math.floor(Math.random() * upperBound);
  return String(value).padStart(length, "0");
}

async function allocateUniqueProjectSlug(
  ctx: MutationCtx,
  args: { orgId: string; slugBase: string },
): Promise<string> {
  for (const suffixLength of [4, 6] as const) {
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const candidate = `${args.slugBase}-${randomNumericSuffix(suffixLength)}`;
      const existing = await ctx.db
        .query("projects")
        .withIndex("by_org_id_and_slug", (q) =>
          q.eq("orgId", args.orgId).eq("slug", candidate),
        )
        .unique();

      if (existing === null) {
        return candidate;
      }
    }
  }

  throw new Error("Unable to allocate a unique project slug.");
}

const projectSummaryValidator = v.object({
  id: v.id("projects"),
  orgId: v.string(),
  orgSlug: v.string(),
  name: v.string(),
  slug: v.string(),
  slugBase: v.string(),
  createdByClerkUserId: v.string(),
  createdAtMs: v.number(),
  updatedAtMs: v.number(),
});

export const createForCurrentOrg = mutation({
  args: {
    expectedOrgSlug: v.string(),
    name: v.string(),
  },
  returns: projectSummaryValidator,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    const trimmedName = args.name.trim();
    if (trimmedName.length === 0) {
      throw new Error("Project name is required.");
    }

    if (trimmedName.length > 120) {
      throw new Error("Project name must be 120 characters or fewer.");
    }

    const slugBase = normalizeProjectSlugBase(trimmedName);
    const slug = await allocateUniqueProjectSlug(ctx, {
      orgId: activeOrg.orgId,
      slugBase,
    });
    const now = Date.now();

    const id = await ctx.db.insert("projects", {
      orgId: activeOrg.orgId,
      orgSlug: args.expectedOrgSlug,
      name: trimmedName,
      slug,
      slugBase,
      createdByClerkUserId: activeOrg.clerkUserId,
      createdAtMs: now,
      updatedAtMs: now,
    });

    return {
      id,
      orgId: activeOrg.orgId,
      orgSlug: args.expectedOrgSlug,
      name: trimmedName,
      slug,
      slugBase,
      createdByClerkUserId: activeOrg.clerkUserId,
      createdAtMs: now,
      updatedAtMs: now,
    };
  },
});

export const listForCurrentOrg = query({
  args: {
    expectedOrgSlug: v.string(),
  },
  returns: v.array(projectSummaryValidator),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return [];
    }

    const activeOrg = getActiveOrgIdClaimsOrNull(identity);
    if (activeOrg === null) {
      // During Clerk <-> Convex org switching, claims may briefly be absent.
      return [];
    }

    if (activeOrg.orgSlug !== null && activeOrg.orgSlug !== args.expectedOrgSlug) {
      // Route/org can briefly drift while active org is switching; treat as loading.
      return [];
    }

    const rows = await ctx.db
      .query("projects")
      .withIndex("by_org_id_and_created_at_ms", (q) => q.eq("orgId", activeOrg.orgId))
      .order("desc")
      .collect();

    return rows.map((row) => ({
      id: row._id,
      orgId: row.orgId,
      orgSlug: row.orgSlug,
      name: row.name,
      slug: row.slug,
      slugBase: row.slugBase,
      createdByClerkUserId: row.createdByClerkUserId,
      createdAtMs: row.createdAtMs,
      updatedAtMs: row.updatedAtMs,
    }));
  },
});
