import { Effect } from "effect";
import { v } from "convex/values";

import { effectQuery } from "../confect";
import { getOrgClaimsFromIdentity } from "../lib/auth";
import { toOrgDeletionError, withOrgQueryCtx } from "./shared";

/**
 * Reads the current signed-in user's active organization claims.
 *
 * @param ctx The Convex query context.
 * @param args The expected organization slug from the route.
 * @returns The current auth/org claim snapshot for UI routing decisions.
 * @remarks This does not mutate data and tolerates unauthenticated requests.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const getCurrentOrgClaims = effectQuery<
  {
    expectedOrgSlug: string | null;
  },
  {
    isSignedIn: boolean;
    clerkUserId: string | null;
    orgId: string | null;
    orgSlug: string | null;
    orgRole: string | null;
    expectedOrgSlug: string | null;
    routeMatchesActiveOrg: boolean;
  },
  any
>({
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
  handler: (args) =>
    withOrgQueryCtx((ctx) =>
      Effect.gen(function* () {
        const identity = yield* Effect.tryPromise({
          try: () => ctx.auth.getUserIdentity(),
          catch: (error) =>
            toOrgDeletionError("Failed to read the current organization claims.", error),
        });
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
      }),
    ),
});
