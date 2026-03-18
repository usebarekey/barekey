import {
  ExternalServiceError,
  ValidationError,
} from "../lib/errors/effect";

/**
 * Normalizes unknown project-variable infrastructure failures into the shared
 * external-service error shape.
 *
 * @param fallbackMessage The message to use when the failure has no useful text.
 * @param error The unknown failure value.
 * @returns A typed external-service error with the original failure attached.
 * @remarks This is used for DB, encryption, and cross-function boundaries in variable workflows.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function toProjectVariableExternalServiceError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}

/**
 * Normalizes unknown project-variable validation failures into the shared
 * validation error shape.
 *
 * @param fallbackMessage The message to use when the failure has no useful text.
 * @param error The unknown failure value.
 * @returns A typed validation error.
 * @remarks This is useful when existing pure helpers still throw standard errors.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function toProjectVariableValidationError(
  fallbackMessage: string,
  error: unknown,
): ValidationError {
  return new ValidationError({
    message: error instanceof Error ? error.message : fallbackMessage,
  });
}

/**
 * Creates a project-variable validation error with a fixed message.
 *
 * @param message The validation message to expose to callers.
 * @returns A typed validation error.
 * @remarks This is useful for direct invariant and conflict failures that do not originate from thrown exceptions.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function projectVariableValidationError(message: string): ValidationError {
  return new ValidationError({ message });
}
