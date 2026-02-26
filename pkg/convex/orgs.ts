import { v } from "convex/values";

import { query } from "./_generated/server";
import { getOrgClaimsFromIdentity } from "./lib/auth";

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
