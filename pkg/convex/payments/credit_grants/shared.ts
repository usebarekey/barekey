import { v } from "convex/values";

import { ExternalServiceError } from "../../lib/errors/effect";
import {
  freePlanCreditStateValidator,
  getCanonicalFreePlanCreditForClerkUserId,
  type ConsumeFreePlanCreditResult,
  type FreePlanCreditState,
} from "../../lib/payments/state";

export type FreePlanCreditRow = NonNullable<
  Awaited<ReturnType<typeof getCanonicalFreePlanCreditForClerkUserId>>
>;

export type EnsureFreePlanCreditArgs = {
  clerkUserId: string;
  orgId: string | null;
  orgSlug: string | null;
  consumeForOrgIfAvailable: boolean;
};

export type ConsumeFreePlanCreditArgs = {
  clerkUserId: string;
  orgId: string;
  orgSlug: string | null;
};

export const consumeFreePlanCreditResultValidator = v.object({
  granted: v.boolean(),
  reason: v.union(
    v.literal("granted"),
    v.literal("already_assigned"),
    v.literal("org_already_assigned"),
    v.literal("assigned_elsewhere"),
    v.literal("no_remaining_credits"),
  ),
  credit: freePlanCreditStateValidator,
});

export {
  freePlanCreditStateValidator,
  type ConsumeFreePlanCreditResult,
  type FreePlanCreditState,
};

/**
 * Normalizes free-plan credit failures into typed external-service errors.
 *
 * @param fallbackMessage The fallback message to use when the thrown value is not an `Error`.
 * @param error The unknown failure value.
 * @returns A typed external-service error.
 * @remarks Credit initialization and assignment stay on the shared billing error channel.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function toFreePlanCreditError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}
