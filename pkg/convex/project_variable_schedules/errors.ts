import { ExternalServiceError } from "../lib/errors/effect";

/**
 * Normalizes unknown scheduled-write infrastructure failures into the shared
 * external-service error shape.
 *
 * @param fallbackMessage The message to use when the failure has no usable text.
 * @param error The unknown failure value.
 * @returns A typed external-service error with the original failure attached.
 * @remarks This is used for scheduler, audit, and DB boundary failures in schedule programs.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function toScheduleExternalServiceError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}
