import type { ActionCtx } from "../../_generated/server";
import { AuthError, ExternalServiceError, ValidationError } from "../../lib/errors/effect";

export type GetBillingStateForCurrentOrgArgs = {
  expectedOrgSlug: string;
};

export type BillingStateBoundaryError =
  | AuthError
  | ExternalServiceError
  | ValidationError;

/**
 * Normalizes unexpected billing-state boundary failures into the shared error model.
 *
 * @param error The unknown failure value.
 * @returns A typed backend error suitable for Effect boundaries.
 * @remarks Existing auth, validation, and external-service errors are preserved.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function toBillingStateError(error: unknown): BillingStateBoundaryError {
  if (
    error instanceof AuthError ||
    error instanceof ExternalServiceError ||
    error instanceof ValidationError
  ) {
    return error;
  }

  return new ExternalServiceError({
    message: error instanceof Error ? error.message : "Failed to load billing state.",
    cause: error,
  });
}

/**
 * Returns a typed `runAction` helper for billing state reads.
 *
 * @param runtimeCtx The Convex action context.
 * @returns A narrowed helper for calling other Convex actions.
 * @remarks This avoids repeating the generated reference expansion cast in each helper module.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function getBillingStateRunAction(runtimeCtx: ActionCtx) {
  return runtimeCtx.runAction as (
    functionReference: unknown,
    args: Record<string, unknown>,
  ) => Promise<unknown>;
}
