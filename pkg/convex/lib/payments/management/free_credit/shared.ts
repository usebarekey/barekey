import { ExternalServiceError } from "../../../errors/effect";

export type RevokeFreePlanCreditForCurrentOrgResult = {
  revoked: boolean;
};

export type RevokeCurrentUserFreePlanCreditResult = {
  revoked: boolean;
  reason: "revoked" | "already_available" | "mismatch";
  previousAssignedOrgId: string | null;
  previousAssignedOrgSlug: string | null;
};

/**
 * Normalizes billing free-credit management failures into typed service errors.
 *
 * @param fallbackMessage The fallback message to use when the failure is not an `Error`.
 * @param error The unknown failure value.
 * @returns A typed external-service error.
 * @remarks This keeps free-credit revoke flows on the shared Effect error channel.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function toFreeCreditManagementError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}
