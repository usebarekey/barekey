import { v } from "convex/values";

import { ExternalServiceError } from "../../lib/errors/effect";
import {
  freePlanCreditStateValidator,
  getCanonicalFreePlanCreditForClerkUserId,
  type FreePlanCreditState,
} from "../../lib/payments/state";

export type RevokeCurrentOrgArgs = {
  clerkUserId: string;
  orgId: string;
  reason: string | null;
};

export type RevokeByOrgIdArgs = {
  orgId: string;
  reason: string | null;
};

export type RevokeCurrentOrgResult = {
  revoked: boolean;
  reason: "revoked" | "already_available" | "not_assigned_to_org";
  credit: FreePlanCreditState;
};

export type RevokeByOrgIdResult = {
  revoked: boolean;
  credit: FreePlanCreditState | null;
};

export type FreePlanCreditRow = NonNullable<
  Awaited<ReturnType<typeof getCanonicalFreePlanCreditForClerkUserId>>
>;

export const revokeCurrentOrgResultValidator = v.object({
  revoked: v.boolean(),
  reason: v.union(
    v.literal("revoked"),
    v.literal("already_available"),
    v.literal("not_assigned_to_org"),
  ),
  credit: freePlanCreditStateValidator,
});

export const revokeByOrgIdResultValidator = v.object({
  revoked: v.boolean(),
  credit: v.union(freePlanCreditStateValidator, v.null()),
});

export { freePlanCreditStateValidator, type FreePlanCreditState };

/**
 * Normalizes free-plan credit revocation failures into typed external-service errors.
 *
 * @param fallbackMessage The fallback message to use when the failure is not an `Error`.
 * @param error The unknown failure value.
 * @returns A typed external-service error.
 * @remarks These mutations are infrastructure-heavy and should stay on the shared Effect error channel.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function toFreePlanCreditRevocationError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}
