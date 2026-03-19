import {
  ExternalServiceError,
  ValidationError,
} from "../../lib/errors/effect";

/**
 * Normalizes unknown schedule snapshot failures into the shared external
 * service error shape.
 *
 * @param fallbackMessage The message to use when the error has no useful text.
 * @param error The unknown failure value.
 * @returns A typed external-service error.
 * @remarks This is used for Convex query/mutation boundaries inside schedule snapshot preparation.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function toScheduleSnapshotExternalError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}

/**
 * Normalizes unknown schedule validation failures into the shared validation
 * error shape.
 *
 * @param fallbackMessage The message to use when the error has no useful text.
 * @param error The unknown failure value.
 * @returns A typed validation error.
 * @remarks This keeps schedule snapshot preparation from leaking raw thrown values.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function toScheduleSnapshotValidationError(
  fallbackMessage: string,
  error: unknown,
): ValidationError {
  return new ValidationError({
    message: error instanceof Error ? error.message : fallbackMessage,
  });
}
