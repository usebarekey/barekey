import { Effect } from "effect";
import { v } from "convex/values";
import type { MutationCtx } from "../../_generated/server";
import {
  BarekeyConfectMutationCtx,
  effectInternalMutation,
} from "../../confect";
import { ExternalServiceError } from "../../lib/errors/effect";
import {
  computeEncryptedBytesForOrg,
  getCanonicalOrgStorageUsageRow,
} from "../../lib/payments/state";
import {
  storageDeltaResultValidator,
  type StorageDeltaArgs,
  type StorageDeltaResult,
  toStorageMirrorError,
} from "./shared";

/**
 * Applies an encrypted-byte storage delta to the organization mirror row.
 *
 * @param runtimeCtx The Convex mutation context.
 * @param args The organization identifier and byte delta to apply.
 * @returns An Effect that succeeds with the updated mirrored byte count and timestamp.
 * @remarks This initializes the mirror lazily and clamps the stored value at zero.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
function applyStorageDeltaForOrgInternalEffect(
  runtimeCtx: MutationCtx,
  args: StorageDeltaArgs,
): Effect.Effect<StorageDeltaResult, ExternalServiceError> {
  return Effect.gen(function* () {
    let existing = yield* Effect.tryPromise({
      try: () => getCanonicalOrgStorageUsageRow(runtimeCtx, args.orgId),
      catch: (error) =>
        toStorageMirrorError("Failed to load the organization storage mirror.", error),
    });
    if (existing === null) {
      const encryptedBytes = yield* Effect.tryPromise({
        try: () => computeEncryptedBytesForOrg(runtimeCtx, args.orgId),
        catch: (error) =>
          toStorageMirrorError("Failed to compute encrypted storage usage.", error),
      });
      const now = Date.now();
      const rowId = yield* Effect.tryPromise({
        try: () =>
          runtimeCtx.db.insert("orgStorageUsage", {
            orgId: args.orgId,
            encryptedBytes,
            createdAtMs: now,
            updatedAtMs: now,
          }),
        catch: (error) =>
          toStorageMirrorError("Failed to initialize the organization storage mirror.", error),
      });
      existing = {
        _id: rowId,
        orgId: args.orgId,
        encryptedBytes,
        createdAtMs: now,
        updatedAtMs: now,
      };
    }

    const nextEncryptedBytes = Math.max(0, existing.encryptedBytes + args.deltaBytes);
    const now = Date.now();
    yield* Effect.tryPromise({
      try: () =>
        runtimeCtx.db.patch(existing._id, {
          encryptedBytes: nextEncryptedBytes,
          updatedAtMs: now,
        }),
      catch: (error) =>
        toStorageMirrorError("Failed to apply the storage delta to the mirror.", error),
    });

    return {
      encryptedBytes: nextEncryptedBytes,
      updatedAtMs: now,
    };
  });
}

/**
 * Applies a storage delta to the mirrored encrypted-byte count for an organization.
 *
 * @param runtimeCtx The Convex internal mutation context.
 * @param args The organization identifier and byte delta.
 * @returns The updated encrypted byte count and timestamp.
 * @remarks This initializes the mirror row on demand and never lets the stored byte count drop below zero.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const applyStorageDeltaForOrgInternal = effectInternalMutation<
  StorageDeltaArgs,
  StorageDeltaResult,
  any
>({
  args: {
    orgId: v.string(),
    deltaBytes: v.number(),
  },
  returns: storageDeltaResultValidator,
  handler: (args) =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectMutationCtx;
      const runtimeCtx = confectCtx.ctx as unknown as MutationCtx;
      return yield* applyStorageDeltaForOrgInternalEffect(runtimeCtx, args);
    }),
});
