import { Effect } from "effect";
import { v } from "convex/values";

import { effectInternalAction } from "../../confect";
import { ExternalServiceError } from "../../lib/errors/effect";
import { createAutumnClient } from "../../lib/payments/variants";
import {
  compensatedUnitsResultValidator,
  METERED_USAGE_ROLLBACK_ERROR_MESSAGE,
  type OrgMeteredUsageArgs,
  toMeteredUsageError,
} from "./shared";

/**
 * Compensates previously reserved metered feature units for one arbitrary organization.
 *
 * @param args The organization identity, feature identifier, units, and compensation reason.
 * @returns An Effect that succeeds with the compensated unit count.
 * @remarks This emits a negative usage event to Autumn and fails with a typed external-service error when rollback fails.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
function compensateFeatureUnitsForOrgInternalEffect(
  args: {
    orgId: string;
    featureId: string;
    units: number;
    reason: string;
  },
): Effect.Effect<{ compensatedUnits: number }, ExternalServiceError> {
  return Effect.gen(function* () {
    if (!Number.isFinite(args.units) || args.units <= 0) {
      return {
        compensatedUnits: 0,
      };
    }

    const autumn = createAutumnClient();
    const result = yield* Effect.tryPromise({
      try: () =>
        autumn.track({
          customer_id: args.orgId,
          feature_id: args.featureId,
          value: -Math.abs(args.units),
          properties: {
            reason: args.reason,
          },
        }),
      catch: (error) =>
        toMeteredUsageError(METERED_USAGE_ROLLBACK_ERROR_MESSAGE, error),
    });

    if (result.error !== null) {
      return yield* Effect.fail(
        new ExternalServiceError({
          message: METERED_USAGE_ROLLBACK_ERROR_MESSAGE,
          cause: result.error,
        }),
      );
    }

    return {
      compensatedUnits: Math.abs(args.units),
    };
  });
}

/**
 * Compensates previously reserved metered feature units for an arbitrary organization.
 *
 * @param ctx The Convex internal action context.
 * @param args The organization identity, feature identifier, units, and compensation reason.
 * @returns The compensated unit count.
 * @remarks This emits a negative usage event to Autumn and throws when rollback fails.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const compensateFeatureUnitsForOrgInternal = effectInternalAction<
  OrgMeteredUsageArgs,
  { compensatedUnits: number },
  never
>({
  args: {
    orgId: v.string(),
    orgSlug: v.union(v.string(), v.null()),
    featureId: v.string(),
    units: v.number(),
    reason: v.string(),
  },
  returns: compensatedUnitsResultValidator,
  handler: (args): Effect.Effect<{ compensatedUnits: number }, ExternalServiceError> =>
    compensateFeatureUnitsForOrgInternalEffect({
      orgId: args.orgId,
      featureId: args.featureId,
      units: args.units,
      reason: args.reason,
    }),
});
