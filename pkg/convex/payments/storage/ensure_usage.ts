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
  ensuredOrgStorageUsageResultValidator,
  type EnsuredOrgStorageUsageResult,
  type OrgIdArgs,
  toStorageMirrorError,
} from "./shared";

/**
 * Ensures the organization storage usage mirror exists.
 *
 * @param ctx The Convex mutation context.
 * @param args The organization identifier.
 * @returns An Effect that succeeds with the mirrored encrypted byte count and whether initialization occurred.
 * @remarks This lazily inserts `orgStorageUsage` when the mirror row is missing.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
function ensureOrgStorageUsageForOrgInternalEffect(
  ctx: MutationCtx,
  args: OrgIdArgs,
): Effect.Effect<EnsuredOrgStorageUsageResult, ExternalServiceError> {
  return Effect.gen(function* () {
    const existing = yield* Effect.tryPromise({
      try: () => getCanonicalOrgStorageUsageRow(ctx, args.orgId),
      catch: (error) =>
        toStorageMirrorError("Failed to load the organization storage mirror.", error),
    });
    if (existing !== null) {
      return {
        encryptedBytes: existing.encryptedBytes,
        initialized: false,
      };
    }

    const encryptedBytes = yield* Effect.tryPromise({
      try: () => computeEncryptedBytesForOrg(ctx, args.orgId),
      catch: (error) =>
        toStorageMirrorError("Failed to compute encrypted storage usage.", error),
    });
    const now = Date.now();
    yield* Effect.tryPromise({
      try: () =>
        ctx.db.insert("orgStorageUsage", {
          orgId: args.orgId,
          encryptedBytes,
          createdAtMs: now,
          updatedAtMs: now,
        }),
      catch: (error) =>
        toStorageMirrorError("Failed to initialize the organization storage mirror.", error),
    });

    return {
      encryptedBytes,
      initialized: true,
    };
  });
}

/**
 * Ensures the organization storage mirror row exists, computing it from
 * encrypted project variables when needed.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The organization identifier.
 * @returns The current encrypted byte count and whether initialization occurred.
 * @remarks This writes `orgStorageUsage` only when the mirror row is missing.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const ensureOrgStorageUsageForOrgInternal = effectInternalMutation<
  OrgIdArgs,
  EnsuredOrgStorageUsageResult,
  any
>({
  args: {
    orgId: v.string(),
  },
  returns: ensuredOrgStorageUsageResultValidator,
  handler: (args) =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectMutationCtx;
      const ctx = confectCtx.ctx as unknown as MutationCtx;
      return yield* ensureOrgStorageUsageForOrgInternalEffect(ctx, args);
    }),
});
