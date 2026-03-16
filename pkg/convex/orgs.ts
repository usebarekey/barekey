import { v } from "convex/values";

import { internal } from "./_generated/api";
import { action, internalQuery, query } from "./confect";
import {
  assertExpectedOrgSlug,
  getOrgClaimsFromIdentity,
  requireActiveOrgIdClaims,
  requireIdentity,
} from "./lib/auth";

export const getCurrentOrgClaims = query({
  args: {
    expectedOrgSlug: v.union(v.string(), v.null()),
  },
  returns: v.object({
    isSignedIn: v.boolean(),
    clerkUserId: v.union(v.string(), v.null()),
    orgId: v.union(v.string(), v.null()),
    orgSlug: v.union(v.string(), v.null()),
    orgRole: v.union(v.string(), v.null()),
    expectedOrgSlug: v.union(v.string(), v.null()),
    routeMatchesActiveOrg: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return {
        isSignedIn: false,
        clerkUserId: null,
        orgId: null,
        orgSlug: null,
        orgRole: null,
        expectedOrgSlug: args.expectedOrgSlug,
        routeMatchesActiveOrg: false,
      };
    }

    const claims = getOrgClaimsFromIdentity(identity);
    return {
      isSignedIn: true,
      clerkUserId: claims.clerkUserId,
      orgId: claims.orgId,
      orgSlug: claims.orgSlug,
      orgRole: claims.orgRole,
      expectedOrgSlug: args.expectedOrgSlug,
      routeMatchesActiveOrg:
        args.expectedOrgSlug !== null &&
        claims.orgSlug !== null &&
        args.expectedOrgSlug === claims.orgSlug,
    };
  },
});

export const getCurrentOrgDeletionReadiness = query({
  args: {
    expectedOrgSlug: v.string(),
  },
  returns: v.object({
    orgId: v.string(),
    orgRole: v.union(v.string(), v.null()),
    projectCount: v.number(),
    canDeleteOrganization: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_org_id", (q) => q.eq("orgId", activeOrg.orgId))
      .collect();
    const projectCount = projects.length;
    const canDeleteOrganization =
      activeOrg.orgRole === "org:admin" || activeOrg.orgRole === "org:owner";

    return {
      orgId: activeOrg.orgId,
      orgRole: activeOrg.orgRole,
      projectCount,
      canDeleteOrganization,
    };
  },
});

export const assertCanDeleteCurrentOrg = action({
  args: {
    expectedOrgSlug: v.string(),
  },
  returns: v.object({
    orgId: v.string(),
    projectCount: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    orgId: string;
    projectCount: number;
  }> => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    if (activeOrg.orgRole !== "org:admin" && activeOrg.orgRole !== "org:owner") {
      throw new Error("Only organization admins can delete organizations.");
    }

    const projects = await ctx.runQuery(
      internal.orgs.listProjectsForCurrentOrgDeletionCheckInternal,
      {
        expectedOrgSlug: args.expectedOrgSlug,
      },
    );
    const projectCount = projects.length;
    if (projectCount > 0) {
      throw new Error(
        `Delete blocked. Remove all projects first (${projectCount} project${projectCount === 1 ? "" : "s"} remaining).`,
      );
    }

    return {
      orgId: activeOrg.orgId,
      projectCount,
    };
  },
});

export const listProjectsForCurrentOrgDeletionCheckInternal = internalQuery({
  args: {
    expectedOrgSlug: v.string(),
  },
  returns: v.array(
    v.object({
      id: v.id("projects"),
    }),
  ),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    const rows = await ctx.db
      .query("projects")
      .withIndex("by_org_id", (q) => q.eq("orgId", activeOrg.orgId))
      .collect();
    return rows.map((row) => ({
      id: row._id,
    }));
  },
});
