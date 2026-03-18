import { v } from "convex/values";

import { ExternalServiceError } from "../../lib/errors/effect";
import { METERED_USAGE_ROLLBACK_ERROR_MESSAGE } from "../../lib/payments/catalog";
import type { WorkspacePlanState } from "../../lib/payments/variants";
import type { ReserveFeatureUnitsResult } from "../types";

export type CurrentOrgMeteredUsageArgs = {
  expectedOrgSlug: string;
  featureId: string;
  units: number;
  reason: string;
};

export type OrgMeteredUsageArgs = {
  orgId: string;
  orgSlug: string | null;
  featureId: string;
  units: number;
  reason: string;
};

export const reserveFeatureUnitsResultValidator = v.object({
  reservedUnits: v.number(),
  errorCode: v.union(
    v.literal("USAGE_LIMIT_EXCEEDED"),
    v.literal("BILLING_UNAVAILABLE"),
    v.null(),
  ),
});

export const compensatedUnitsResultValidator = v.object({
  compensatedUnits: v.number(),
});

export { METERED_USAGE_ROLLBACK_ERROR_MESSAGE, type ReserveFeatureUnitsResult, type WorkspacePlanState };

/**
 * Normalizes metered-usage failures into typed external-service errors.
 *
 * @param fallbackMessage The fallback message to use when the thrown value is not an `Error`.
 * @param error The unknown failure value.
 * @returns A typed external-service error.
 * @remarks Reservation and rollback flows stay on the shared billing error channel.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function toMeteredUsageError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}
