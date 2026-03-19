import { Effect } from "effect";

import { BillingError } from "../../../errors/effect";
import { runActionEffect } from "../../../convex/functions";
import type { BillingUnitsInput } from "../../services";
import type { ReserveFeatureUnitsResult } from "../../../../payments/types";
import type { BarekeyRuntimeCtx } from "../context";
import { hasActionRunner } from "../context";
import { toBillingError } from "../errors";
import {
  reserveFeatureUnitsForCurrentOrgInternalReference,
  reserveFeatureUnitsForOrgInternalReference,
} from "./refs";

/**
 * Reserves metered billing units using the current runtime context.
 *
 * @param ctx The active Convex runtime context.
 * @param payload The billing reservation request.
 * @returns An Effect that succeeds with the reservation result.
 * @remarks This currently requires an action context because the underlying billing flow is action-backed.
 * @lastModified 2026-03-18
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

  if (payload.scope === "currentOrg") {
    return runActionEffect<ReserveFeatureUnitsResult, BillingError>(
      ctx,
      reserveFeatureUnitsForCurrentOrgInternalReference,
      {
        expectedOrgSlug: payload.expectedOrgSlug,
        featureId: payload.featureId,
        units: payload.units,
        reason: payload.reason,
      },
      (error) => toBillingError("Failed to reserve metered feature units.", error),
    );
  }

  return runActionEffect<ReserveFeatureUnitsResult, BillingError>(
    ctx,
    reserveFeatureUnitsForOrgInternalReference,
    {
      orgId: payload.orgId,
      orgSlug: payload.orgSlug,
      featureId: payload.featureId,
      units: payload.units,
      reason: payload.reason,
    },
    (error) => toBillingError("Failed to reserve metered feature units.", error),
  );
}
