import { ExternalServiceError } from "../../lib/errors/effect";

/**
 * Normalizes device-code creation failures into typed external-service errors.
 *
 * @param fallbackMessage The fallback message to use when the failure is not an `Error`.
 * @param error The unknown failure value.
 * @returns A typed external-service error.
 * @remarks Device-code issuance uses the shared Effect error channel for token hashing and persistence failures.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function toDeviceCodeCreateError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}
