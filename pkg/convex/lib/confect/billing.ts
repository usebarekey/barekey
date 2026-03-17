import { Effect } from "effect";

import type { ReserveFeatureUnitsResult } from "../../payments/types";
import type { BillingError } from "../effect_errors";
import {
  BillingService,
  type BillingCompensationResult,
  type BillingUnitsInput,
} from "./services";

/**
 * Reserves metered billing units through the shared runtime billing service.
 *
 * @param payload The reservation request to execute.
 * @returns An Effect that succeeds with the reservation result.
 * @remarks This is the Effect-native billing reservation entrypoint for domain programs.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function reserveFeatureUnitsEffect(
  payload: BillingUnitsInput,
): Effect.Effect<ReserveFeatureUnitsResult, BillingError, BillingService> {
  return Effect.gen(function* () {
    const billing = yield* BillingService;
    return yield* billing.reserve(payload);
  });
}

/**
 * Compensates previously reserved metered billing units through the shared runtime billing service.
 *
 * @param payload The compensation request to execute.
 * @returns An Effect that succeeds with the compensation result.
 * @remarks This is the Effect-native billing rollback entrypoint for domain programs.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function compensateFeatureUnitsEffect(
  payload: BillingUnitsInput,
): Effect.Effect<BillingCompensationResult, BillingError, BillingService> {
  return Effect.gen(function* () {
    const billing = yield* BillingService;
    return yield* billing.compensate(payload);
  });
}
