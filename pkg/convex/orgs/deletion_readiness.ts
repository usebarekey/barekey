import { Effect } from "effect";
import { v } from "convex/values";

import { effectInternalQuery, effectQuery } from "../confect";
import {
  assertExpectedOrgSlugEffect,
  requireActiveOrgIdClaimsEffect,
  requireIdentityEffect,
} from "../lib/auth";
import { listProjectIdsByOrgIdEffect } from "./repo";
import { withOrgQueryCtx } from "./shared";

/**
 * Reads whether the active organization is ready to be deleted.
 *
 * @param ctx The Convex query context.
 * @param args The expected organization slug.
 * @returns The current organization id, role, project count, and deletion capability.
 * @remarks This is a read-only readiness check used by settings UI flows.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
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
    withOrgQueryCtx((ctx) =>
      Effect.gen(function* () {
        const identity = yield* requireIdentityEffect(ctx);
        const activeOrg = yield* requireActiveOrgIdClaimsEffect(identity);
        if (activeOrg.orgSlug !== null) {
          yield* assertExpectedOrgSlugEffect(activeOrg, args.expectedOrgSlug);
        }

        const projects = yield* listProjectIdsByOrgIdEffect(ctx, activeOrg.orgId);
        return {
          orgId: activeOrg.orgId,
          orgRole: activeOrg.orgRole,
          projectCount: projects.length,
          canDeleteOrganization:
            activeOrg.orgRole === "org:admin" || activeOrg.orgRole === "org:owner",
        };
      }),
    ),
});

/**
 * Lists the current organization's projects for delete-guard checks.
 *
 * @param ctx The Convex internal query context.
 * @param args The expected organization slug.
 * @returns The current organization's project ids.
 * @remarks This stays internal and is used by the delete guard action.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
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
    withOrgQueryCtx((ctx) =>
      Effect.gen(function* () {
        const identity = yield* requireIdentityEffect(ctx);
        const activeOrg = yield* requireActiveOrgIdClaimsEffect(identity);
        if (activeOrg.orgSlug !== null) {
          yield* assertExpectedOrgSlugEffect(activeOrg, args.expectedOrgSlug);
        }

        return yield* listProjectIdsByOrgIdEffect(ctx, activeOrg.orgId);
      }),
    ),
});
