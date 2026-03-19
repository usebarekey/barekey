import { Effect } from "effect";

import { BillingError } from "../../../errors/effect";
import { runActionEffect } from "../../../convex/functions";
import type { BillingCompensationResult, BillingUnitsInput } from "../../services";
import type { BarekeyRuntimeCtx } from "../context";
import { hasActionRunner } from "../context";
import { toBillingError } from "../errors";
import {
  compensateFeatureUnitsForCurrentOrgInternalReference,
  compensateFeatureUnitsForOrgInternalReference,
} from "./refs";

/**
 * Compensates previously reserved metered billing units using the current runtime context.
 *
 * @param ctx The active Convex runtime context.
 * @param payload The billing compensation request.
 * @returns An Effect that succeeds with the compensation result.
 * @remarks This currently requires an action context because the underlying billing flow is action-backed.
 * @lastModified 2026-03-18
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

  if (payload.scope === "currentOrg") {
    return runActionEffect<BillingCompensationResult, BillingError>(
      ctx,
      compensateFeatureUnitsForCurrentOrgInternalReference,
      {
        expectedOrgSlug: payload.expectedOrgSlug,
        featureId: payload.featureId,
        units: payload.units,
        reason: payload.reason,
      },
      (error) => toBillingError("Failed to compensate metered feature units.", error),
    );
  }

  return runActionEffect<BillingCompensationResult, BillingError>(
    ctx,
    compensateFeatureUnitsForOrgInternalReference,
    {
      orgId: payload.orgId,
      orgSlug: payload.orgSlug,
      featureId: payload.featureId,
      units: payload.units,
      reason: payload.reason,
    },
    (error) => toBillingError("Failed to compensate metered feature units.", error),
  );
}
