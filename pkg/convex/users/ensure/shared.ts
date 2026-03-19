import { ExternalServiceError } from "../../lib/errors/effect";

/**
 * Normalizes user-ensure failures into the shared external-service error model.
 *
 * @param fallbackMessage The fallback message when the thrown value is not an `Error`.
 * @param error The unknown failure value.
 * @returns A typed external-service error.
 * @remarks This keeps user creation/update flows on the shared Effect error channel.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function toUserEnsureError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}
