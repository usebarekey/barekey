import { Effect } from "effect";
import { makeFunctionReference } from "convex/server";

import type { ReserveFeatureUnitsResult } from "../../../payments/types";
import { BillingError } from "../../errors/effect";
import type { BillingCompensationResult, BillingUnitsInput } from "../services";
import type { BarekeyRuntimeCtx } from "./context";
import { hasActionRunner } from "./context";
import { toBillingError } from "./errors";

const reserveFeatureUnitsForCurrentOrgInternalReference = makeFunctionReference<
  "action",
  {
    expectedOrgSlug: string;
    featureId: string;
    units: number;
    reason: string;
  },
  ReserveFeatureUnitsResult
>("payments:reserveFeatureUnitsForCurrentOrgInternal") as any;

const reserveFeatureUnitsForOrgInternalReference = makeFunctionReference<
  "action",
  {
    orgId: string;
    orgSlug: string | null;
    featureId: string;
    units: number;
    reason: string;
  },
  ReserveFeatureUnitsResult
>("payments:reserveFeatureUnitsForOrgInternal") as any;

const compensateFeatureUnitsForCurrentOrgInternalReference = makeFunctionReference<
  "action",
  {
    expectedOrgSlug: string;
    featureId: string;
    units: number;
    reason: string;
  },
  BillingCompensationResult
>("payments:compensateFeatureUnitsForCurrentOrgInternal") as any;

const compensateFeatureUnitsForOrgInternalReference = makeFunctionReference<
  "action",
  {
    orgId: string;
    orgSlug: string | null;
    featureId: string;
    units: number;
    reason: string;
  },
  BillingCompensationResult
>("payments:compensateFeatureUnitsForOrgInternal") as any;

/**
 * Reserves metered billing units using the current runtime context.
 *
 * @param ctx The active Convex runtime context.
 * @param payload The billing reservation request.
 * @returns An Effect that succeeds with the reservation result.
 * @remarks This currently requires an action context because the underlying billing flow is action-backed.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function reserveBillingUnitsWithRuntimeCtx(
  ctx: BarekeyRuntimeCtx,
  payload: BillingUnitsInput,
) {
  if (!hasActionRunner(ctx)) {
    return Effect.fail(
      new BillingError({
        message: "Metered billing reservations require an action context.",
      }),
    );
  }

  return Effect.tryPromise({
    try: async () => {
      if (payload.scope === "currentOrg") {
        return (await ctx.runAction(reserveFeatureUnitsForCurrentOrgInternalReference, {
          expectedOrgSlug: payload.expectedOrgSlug,
          featureId: payload.featureId,
          units: payload.units,
          reason: payload.reason,
        })) as ReserveFeatureUnitsResult;
      }

      return (await ctx.runAction(reserveFeatureUnitsForOrgInternalReference, {
        orgId: payload.orgId,
        orgSlug: payload.orgSlug,
        featureId: payload.featureId,
        units: payload.units,
        reason: payload.reason,
      })) as ReserveFeatureUnitsResult;
    },
    catch: (error) => toBillingError("Failed to reserve metered feature units.", error),
  });
}

/**
 * Compensates previously reserved metered billing units using the current runtime context.
 *
 * @param ctx The active Convex runtime context.
 * @param payload The billing compensation request.
 * @returns An Effect that succeeds with the compensation result.
 * @remarks This currently requires an action context because the underlying billing flow is action-backed.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function compensateBillingUnitsWithRuntimeCtx(
  ctx: BarekeyRuntimeCtx,
  payload: BillingUnitsInput,
) {
  if (!hasActionRunner(ctx)) {
    return Effect.fail(
      new BillingError({
        message: "Metered billing compensation requires an action context.",
      }),
    );
  }

  return Effect.tryPromise({
    try: async () => {
      if (payload.scope === "currentOrg") {
        return (await ctx.runAction(compensateFeatureUnitsForCurrentOrgInternalReference, {
          expectedOrgSlug: payload.expectedOrgSlug,
          featureId: payload.featureId,
          units: payload.units,
          reason: payload.reason,
        })) as BillingCompensationResult;
      }

      return (await ctx.runAction(compensateFeatureUnitsForOrgInternalReference, {
        orgId: payload.orgId,
        orgSlug: payload.orgSlug,
        featureId: payload.featureId,
        units: payload.units,
        reason: payload.reason,
      })) as BillingCompensationResult;
    },
    catch: (error) => toBillingError("Failed to compensate metered feature units.", error),
  });
}
