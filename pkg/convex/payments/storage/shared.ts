import { v } from "convex/values";

import { ExternalServiceError } from "../../lib/errors/effect";

export type OrgIdArgs = {
  orgId: string;
};

export type StorageDeltaArgs = {
  orgId: string;
  deltaBytes: number;
};

export type OrgStorageUsageResult = {
  encryptedBytes: number;
  updatedAtMs: number;
} | null;

export type EnsuredOrgStorageUsageResult = {
  encryptedBytes: number;
  initialized: boolean;
};

export type StorageDeltaResult = {
  encryptedBytes: number;
  updatedAtMs: number;
};

export type BillingSnapshotArgs = {
  orgId: string;
  currentTier: "free" | "pro" | "max" | null;
};

export const orgStorageUsageResultValidator = v.union(
  v.object({
    encryptedBytes: v.number(),
    updatedAtMs: v.number(),
  }),
  v.null(),
);

export const ensuredOrgStorageUsageResultValidator = v.object({
  encryptedBytes: v.number(),
  initialized: v.boolean(),
});

export const storageDeltaResultValidator = v.object({
  encryptedBytes: v.number(),
  updatedAtMs: v.number(),
});

/**
 * Normalizes unknown storage-mirror failures into typed external-service errors.
 *
 * @param fallbackMessage The fallback message to use when the failure is not an `Error`.
 * @param error The unknown thrown failure value.
 * @returns A typed external-service error.
 * @remarks This keeps billing storage helpers on the shared Effect error channel.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function toStorageMirrorError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}
