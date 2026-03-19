import { ExternalServiceError, NotFoundError } from "../../errors/effect";

/**
 * Normalizes database reader failures into the shared external-service error shape.
 *
 * @param operation The read operation that failed.
 * @param error The unknown failure value to normalize.
 * @returns A typed external-service error with a stable operation-specific message.
 * @remarks This is used at Effect boundaries and does not mutate Convex state.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function toProjectScopeReadError(
  operation: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message:
      error instanceof Error
        ? error.message
        : `Failed to read ${operation}.`,
    cause: error,
  });
}

/**
 * Converts a typed project-scope error back into a thrown `Error` for
 * compatibility with legacy promise-based callers.
 *
 * @param error The typed project-scope error to convert.
 * @returns A standard `Error` instance carrying the same message.
 * @remarks This compatibility shim should disappear as callers move to the Effect-native exports.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function toThrownProjectScopeError(
  error: ExternalServiceError | NotFoundError,
): Error {
  return new Error(error.message);
}
