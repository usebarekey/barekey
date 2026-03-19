import { Effect } from "effect";
import { v } from "convex/values";

import type { ActionCtx } from "../../_generated/server";
import { BarekeyConfectActionCtx, effectInternalAction } from "../../confect";
import { BillingError, ExternalServiceError } from "../../lib/errors/effect";
import {
  createAutumnClient,
  readWorkspacePlanStateForOrg,
} from "../../lib/payments/variants";
import { upsertOrgBillingSnapshotForOrgInternalReference } from "../refs";
import {
  reserveFeatureUnitsResultValidator,
  type OrgMeteredUsageArgs,
  type ReserveFeatureUnitsResult,
  type WorkspacePlanState,
  toMeteredUsageError,
} from "./shared";

/**
 * Reserves metered feature units for one arbitrary organization.
 *
 * @param runtimeCtx The Convex action context.
 * @param args The organization identity, feature identifier, units, and billing reason.
 * @returns An Effect that succeeds with the normalized reservation outcome.
 * @remarks This reads the workspace plan, refreshes the billing snapshot, and emits the reservation event to Autumn.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
function reserveFeatureUnitsForOrgInternalEffect(
  runtimeCtx: ActionCtx,
  args: OrgMeteredUsageArgs,
): Effect.Effect<ReserveFeatureUnitsResult, ExternalServiceError, never> {
  return Effect.gen(function* () {
    const planStateResult = yield* Effect.either(
      Effect.tryPromise({
        try: () => readWorkspacePlanStateForOrg(runtimeCtx, args),
        catch: (error) =>
          error instanceof BillingError || error instanceof ExternalServiceError
            ? error
            : toMeteredUsageError("Failed to read the workspace billing plan.", error),
      }),
    );

    if (planStateResult._tag === "Left") {
      if (planStateResult.left instanceof BillingError) {
        return {
          reservedUnits: 0,
          errorCode: "USAGE_LIMIT_EXCEEDED" as const,
        };
      }
      return {
        reservedUnits: 0,
        errorCode: "BILLING_UNAVAILABLE" as const,
      };
    }

    const planState: WorkspacePlanState = planStateResult.right;

    yield* Effect.tryPromise({
      try: () =>
        runtimeCtx.runMutation(upsertOrgBillingSnapshotForOrgInternalReference, {
          orgId: args.orgId,
          currentTier: planState.currentTier,
        }),
      catch: (error) =>
        toMeteredUsageError("Failed to refresh the billing snapshot.", error),
    });

    if (!Number.isFinite(args.units) || args.units <= 0) {
      return {
        reservedUnits: 0,
        errorCode: null,
      };
    }

    const autumn = createAutumnClient();
    const result = yield* Effect.tryPromise({
      try: () =>
        autumn.check({
          customer_id: args.orgId,
          feature_id: args.featureId,
          required_balance: args.units,
          send_event: true,
        }),
      catch: (error) =>
        toMeteredUsageError("Failed to reserve metered feature units.", error),
    });

    if (result.error !== null || result.data === null) {
      return {
        reservedUnits: 0,
        errorCode: "BILLING_UNAVAILABLE" as const,
      };
    }
    if (!result.data.allowed) {
      return {
        reservedUnits: 0,
        errorCode: "USAGE_LIMIT_EXCEEDED" as const,
      };
    }

    return {
      reservedUnits: args.units,
      errorCode: null,
    };
  });
}

/**
 * Reserves metered feature units for an arbitrary organization.
 *
 * @param runtimeCtx The Convex internal action context.
 * @param args The organization identity, feature identifier, units, and billing reason.
 * @returns The reserved unit count and any normalized billing error code.
 * @remarks This reads the workspace plan, refreshes the billing snapshot, and emits the reservation event to Autumn.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const reserveFeatureUnitsForOrgInternal = effectInternalAction<
  OrgMeteredUsageArgs,
  ReserveFeatureUnitsResult,
  any
>({
  args: {
    orgId: v.string(),
    orgSlug: v.union(v.string(), v.null()),
    featureId: v.string(),
    units: v.number(),
    reason: v.string(),
  },
  returns: reserveFeatureUnitsResultValidator,
  handler: (args): Effect.Effect<ReserveFeatureUnitsResult, ExternalServiceError, any> =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectActionCtx;
      const runtimeCtx = confectCtx.ctx as unknown as ActionCtx;
      return yield* reserveFeatureUnitsForOrgInternalEffect(runtimeCtx, args);
    }),
});
