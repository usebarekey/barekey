import { BillingError, ExternalServiceError } from "../../errors/effect";

/**
 * Normalizes unknown runtime-layer failures into the shared external-service error model.
 *
 * @param fallbackMessage The message to use when the failure has no useful `Error` message.
 * @param error The unknown thrown failure value.
 * @returns A typed external-service error.
 * @remarks This keeps runtime service adapters from leaking raw thrown values into Effect programs.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function toExternalServiceError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}

/**
 * Normalizes unknown runtime-layer failures into the shared billing error model.
 *
 * @param fallbackMessage The message to use when the failure has no useful `Error` message.
 * @param error The unknown thrown failure value.
 * @returns A typed billing error.
 * @remarks Billing adapters intentionally collapse provider/runner failures into the billing error channel.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function toBillingError(fallbackMessage: string, error: unknown): BillingError {
  return new BillingError({
    message: error instanceof Error ? error.message : fallbackMessage,
  });
}
