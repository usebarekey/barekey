import { ExternalServiceError } from "../lib/errors/effect";

export const defaultStages = [
  {
    slug: "development",
    name: "Development",
  },
  {
    slug: "production",
    name: "Production",
  },
] as const;

/**
 * Normalizes bootstrap persistence failures into the shared external-service error model.
 *
 * @param fallbackMessage The fallback message to use when the failure is not an `Error`.
 * @param error The unknown failure value.
 * @returns A typed external-service error.
 * @remarks Config-project bootstrap stays on the shared Effect error channel even though it performs direct persistence.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function toBootstrapExternalServiceError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}
