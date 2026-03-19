import { ExternalServiceError } from "../../lib/errors/effect";

/**
 * Normalizes unknown project-deletion failures into the shared external-service error model.
 *
 * @param fallbackMessage The message to use when the failure has no useful `Error` message.
 * @param error The unknown thrown failure value.
 * @returns A typed external-service error.
 * @remarks This keeps project delete workflows from leaking raw thrown values into Effect programs.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function toProjectDeleteError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}
