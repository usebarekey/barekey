import { Effect } from "effect";
import { v } from "convex/values";

import type { ActionCtx } from "../../_generated/server";
import { BarekeyConfectActionCtx, effectInternalAction } from "../../confect";
import {
  assertExpectedOrgSlugEffect,
  requireActiveOrgIdClaimsEffect,
  requireIdentityEffect,
} from "../../lib/auth";
import { compensateFeatureUnitsForOrgInternalReference } from "../refs";
import {
  compensatedUnitsResultValidator,
  type CurrentOrgMeteredUsageArgs,
  toMeteredUsageError,
} from "./shared";

/**
 * Compensates previously reserved metered feature units for the current authenticated organization.
 *
 * @param runtimeCtx The Convex internal action context.
 * @param args The expected org slug, feature identifier, units, and compensation reason.
 * @returns The compensated unit count.
 * @remarks This validates the active org and delegates to the org-scoped compensation action.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const compensateFeatureUnitsForCurrentOrgInternal = effectInternalAction<
  CurrentOrgMeteredUsageArgs,
  { compensatedUnits: number },
  any
>({
  args: {
    expectedOrgSlug: v.string(),
    featureId: v.string(),
    units: v.number(),
    reason: v.string(),
  },
  returns: compensatedUnitsResultValidator,
  handler: (args): Effect.Effect<{ compensatedUnits: number }, unknown, any> =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectActionCtx;
      const runtimeCtx = confectCtx.ctx as unknown as ActionCtx;

      const identity = yield* requireIdentityEffect(runtimeCtx);
      const activeOrg = yield* requireActiveOrgIdClaimsEffect(identity);
      if (activeOrg.orgSlug !== null) {
        yield* assertExpectedOrgSlugEffect(activeOrg, args.expectedOrgSlug);
      }

      return yield* Effect.tryPromise({
        try: (): Promise<{ compensatedUnits: number }> =>
          runtimeCtx.runAction(compensateFeatureUnitsForOrgInternalReference, {
            orgId: activeOrg.orgId,
            orgSlug: activeOrg.orgSlug,
            featureId: args.featureId,
            units: args.units,
            reason: args.reason,
          }) as Promise<{ compensatedUnits: number }>,
        catch: (error) =>
          toMeteredUsageError("Failed to compensate units for the current organization.", error),
      });
    }),
});
