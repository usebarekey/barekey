import { Effect } from "effect";
import { v } from "convex/values";

import type { ActionCtx } from "../../_generated/server";
import { BarekeyConfectActionCtx, effectInternalAction } from "../../confect";
import {
  assertExpectedOrgSlugEffect,
  requireActiveOrgIdClaimsEffect,
  requireIdentityEffect,
} from "../../lib/auth";
import { ExternalServiceError } from "../../lib/errors/effect";
import { reserveFeatureUnitsForOrgInternalReference } from "../refs";
import {
  reserveFeatureUnitsResultValidator,
  type CurrentOrgMeteredUsageArgs,
  type ReserveFeatureUnitsResult,
  toMeteredUsageError,
} from "./shared";

/**
 * Reserves metered feature units for the current authenticated organization.
 *
 * @param runtimeCtx The Convex internal action context.
 * @param args The expected org slug, feature identifier, units, and billing reason.
 * @returns The reserved unit count and any normalized billing error code.
 * @remarks This validates the active org and delegates the actual reservation to the org-scoped internal action.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const reserveFeatureUnitsForCurrentOrgInternal = effectInternalAction<
  CurrentOrgMeteredUsageArgs,
  ReserveFeatureUnitsResult,
  any
>({
  args: {
    expectedOrgSlug: v.string(),
    featureId: v.string(),
    units: v.number(),
    reason: v.string(),
  },
  returns: reserveFeatureUnitsResultValidator,
  handler: (args): Effect.Effect<ReserveFeatureUnitsResult, unknown, any> =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectActionCtx;
      const runtimeCtx = confectCtx.ctx as unknown as ActionCtx;

      const identity = yield* requireIdentityEffect(runtimeCtx);
      const activeOrg = yield* requireActiveOrgIdClaimsEffect(identity);
      if (activeOrg.orgSlug !== null) {
        yield* assertExpectedOrgSlugEffect(activeOrg, args.expectedOrgSlug);
      }

      return yield* Effect.tryPromise({
        try: (): Promise<ReserveFeatureUnitsResult> =>
          runtimeCtx.runAction(reserveFeatureUnitsForOrgInternalReference, {
            orgId: activeOrg.orgId,
            orgSlug: activeOrg.orgSlug,
            featureId: args.featureId,
            units: args.units,
            reason: args.reason,
          }) as Promise<ReserveFeatureUnitsResult>,
        catch: (error) =>
          toMeteredUsageError("Failed to reserve units for the current organization.", error),
      });
    }),
});
