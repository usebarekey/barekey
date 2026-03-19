import { ExternalServiceError } from "../lib/errors/effect";

export type WipeEncryptedDataArgs = {
  confirm: "wipe_encrypted_data";
};

export type WipeEncryptedDataResult = {
  projectKeyCount: number;
  projectVariableCount: number;
  projectVariableScheduleCount: number;
  orgStorageUsageCount: number;
  cancelledScheduledFunctionCount: number;
  completedAtMs: number;
};

/**
 * Normalizes destructive cutover failures into typed external-service errors.
 *
 * @param fallbackMessage The fallback message to use when the failure is not an `Error`.
 * @param error The unknown failure value.
 * @returns A typed external-service error.
 * @remarks The cutover mutation is destructive infrastructure and should stay on the shared Effect error channel.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function toCutoverError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}
