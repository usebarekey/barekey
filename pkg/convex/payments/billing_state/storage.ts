import { api } from "../../_generated/api";
import type { ActionCtx } from "../../_generated/server";
import { FeatureId } from "../../lib/payments/catalog";
import {
  ensureOrgStorageUsageForOrgInternalReference,
} from "../refs";

/**
 * Ensures the storage-usage mirror exists for an organization and syncs it to Autumn on first creation.
 *
 * @param convexCtx The Convex action context.
 * @param orgId The organization whose storage mirror should exist.
 * @returns The current encrypted-byte count and whether the mirror was initialized in this call.
 * @remarks This writes the local storage mirror and may invoke Autumn usage sync when the mirror is first seeded.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export async function ensureBillingStateStorageMirror(
  convexCtx: ActionCtx,
  orgId: string,
): Promise<{
  encryptedBytes: number;
  initialized: boolean;
}> {
  const ensuredStorage = (await convexCtx.runMutation(
    ensureOrgStorageUsageForOrgInternalReference,
    {
      orgId,
    },
  )) as {
    encryptedBytes: number;
    initialized: boolean;
  };

  if (ensuredStorage.initialized) {
    const syncStorageUsageResult = await convexCtx.runAction(api.autumn.usage, {
      featureId: FeatureId.StorageBytes,
      value: ensuredStorage.encryptedBytes,
    });
    if (syncStorageUsageResult.error !== null) {
      console.error("Failed to sync initial storage usage to Autumn.", {
        orgId,
        error: syncStorageUsageResult.error,
      });
    }
  }

  return ensuredStorage;
}
