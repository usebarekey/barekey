import { Effect } from "effect";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";

import type { ActionCtx, QueryCtx } from "./_generated/server";
import {
  BarekeyConfectActionCtx,
  BarekeyConfectQueryCtx,
  effectAction,
  effectInternalQuery,
  effectQuery,
} from "./confect";
import {
  assertExpectedOrgSlug,
  assertExpectedOrgSlugEffect,
  getOrgClaimsFromIdentity,
  requireActiveOrgIdClaims,
  requireActiveOrgIdClaimsEffect,
  requireIdentity,
  requireIdentityEffect,
} from "./lib/auth";
import { AuthError, ExternalServiceError, ValidationError } from "./lib/errors/effect";

const listProjectsForCurrentOrgDeletionCheckInternalReference = makeFunctionReference<
  "query",
  {
    expectedOrgSlug: string;
  },
  Array<{
    id: string;
  }>
>("orgs:listProjectsForCurrentOrgDeletionCheckInternal") as any;

function withOrgQueryCtx<Args, Result>(
  handler: (ctx: QueryCtx, args: Args) => Promise<Result>,
  args: Args,
): Effect.Effect<Result, AuthError | ExternalServiceError | ValidationError, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectQueryCtx;
    const ctx = confectCtx.ctx as unknown as QueryCtx;
    return yield* Effect.tryPromise({
      try: () => handler(ctx, args),
      catch: (error) => toOrgDeletionError("Failed to execute organization query.", error),
    });
  });
}

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
    withOrgQueryCtx(async (ctx, innerArgs) => {
      const identity = await ctx.auth.getUserIdentity();
      if (identity === null) {
        return {
          isSignedIn: false,
          clerkUserId: null,
          orgId: null,
          orgSlug: null,
          orgRole: null,
          expectedOrgSlug: innerArgs.expectedOrgSlug,
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
        expectedOrgSlug: innerArgs.expectedOrgSlug,
        routeMatchesActiveOrg:
          innerArgs.expectedOrgSlug !== null &&
          claims.orgSlug !== null &&
          innerArgs.expectedOrgSlug === claims.orgSlug,
      };
    }, args),
});

export const getCurrentOrgDeletionReadiness = effectQuery<
  {
    expectedOrgSlug: string;
  },
  {
    orgId: string;
    orgRole: string | null;
    projectCount: number;
    canDeleteOrganization: boolean;
  },
  any
>({
  args: {
    expectedOrgSlug: v.string(),
  },
  returns: v.object({
    orgId: v.string(),
    orgRole: v.union(v.string(), v.null()),
    projectCount: v.number(),
    canDeleteOrganization: v.boolean(),
  }),
  handler: (args) =>
    withOrgQueryCtx(async (ctx, innerArgs) => {
      const identity = await requireIdentity(ctx);
      const activeOrg = requireActiveOrgIdClaims(identity);
      if (activeOrg.orgSlug !== null) {
        assertExpectedOrgSlug(activeOrg, innerArgs.expectedOrgSlug);
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
    }, args),
});

function toOrgDeletionError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}

function assertCanDeleteCurrentOrgEffect(
  args: {
    expectedOrgSlug: string;
  },
): Effect.Effect<
  {
    orgId: string;
    projectCount: number;
  },
  AuthError | ExternalServiceError | ValidationError,
  any
> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectActionCtx;
    const ctx = confectCtx.ctx as unknown as ActionCtx;
    const identity = yield* requireIdentityEffect(ctx);
    const activeOrg = yield* requireActiveOrgIdClaimsEffect(identity);
    if (activeOrg.orgSlug !== null) {
      yield* assertExpectedOrgSlugEffect(activeOrg, args.expectedOrgSlug);
    }

    if (activeOrg.orgRole !== "org:admin" && activeOrg.orgRole !== "org:owner") {
      return yield* Effect.fail(
        new ValidationError({
          message: "Only organization admins can delete organizations.",
        }),
      );
    }

    const projects = yield* Effect.tryPromise({
      try: () =>
        ctx.runQuery(listProjectsForCurrentOrgDeletionCheckInternalReference, {
          expectedOrgSlug: args.expectedOrgSlug,
        }) as Promise<Array<{ id: string }>>,
      catch: (error) =>
        toOrgDeletionError("Failed to load organization projects for deletion readiness.", error),
    });
    const projectCount = projects.length;
    if (projectCount > 0) {
      return yield* Effect.fail(
        new ValidationError({
          message: `Delete blocked. Remove all projects first (${projectCount} project${projectCount === 1 ? "" : "s"} remaining).`,
        }),
      );
    }

    return {
      orgId: activeOrg.orgId,
      projectCount,
    };
  });
}

export const assertCanDeleteCurrentOrg = effectAction({
  args: {
    expectedOrgSlug: v.string(),
  },
  returns: v.object({
    orgId: v.string(),
    projectCount: v.number(),
  }),
  handler: assertCanDeleteCurrentOrgEffect,
});

export const listProjectsForCurrentOrgDeletionCheckInternal = effectInternalQuery<
  {
    expectedOrgSlug: string;
  },
  Array<{ id: string }>,
  any
>({
  args: {
    expectedOrgSlug: v.string(),
  },
  returns: v.array(
    v.object({
      id: v.id("projects"),
    }),
  ),
  handler: (args) =>
    withOrgQueryCtx(async (ctx, innerArgs) => {
      const identity = await requireIdentity(ctx);
      const activeOrg = requireActiveOrgIdClaims(identity);
      if (activeOrg.orgSlug !== null) {
        assertExpectedOrgSlug(activeOrg, innerArgs.expectedOrgSlug);
      }

      const rows = await ctx.db
        .query("projects")
        .withIndex("by_org_id", (q) => q.eq("orgId", activeOrg.orgId))
        .collect();
      return rows.map((row) => ({
        id: row._id,
      }));
    }, args),
});
