import { ExternalServiceError } from "../lib/errors/effect";

/**
 * Normalizes typegen manifest failures into typed external-service errors.
 *
 * @param fallbackMessage The fallback message to use when the failure is not an `Error`.
 * @param error The unknown failure value.
 * @returns A typed external-service error.
 * @remarks Typegen reads and decryption failures stay on the shared Effect error channel.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function toTypegenError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}
