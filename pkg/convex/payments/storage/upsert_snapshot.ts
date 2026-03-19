import { Effect } from "effect";
import { v } from "convex/values";
import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import {
  BarekeyConfectMutationCtx,
  effectInternalMutation,
} from "../../confect";
import { dbInsertEffect, dbPatchEffect, dbUniqueEffect } from "../../lib/convex/db";
import { ExternalServiceError } from "../../lib/errors/effect";
import {
  type BillingSnapshotArgs,
  toStorageMirrorError,
} from "./shared";

/**
 * Upserts the cached billing snapshot tier for one organization.
 *
 * @param ctx The Convex mutation context.
 * @param args The organization identifier and current tier.
 * @returns An Effect that succeeds with `null` once the snapshot is written.
 * @remarks This maintains `orgBillingSnapshots` as a lightweight resolved-tier mirror.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
function upsertOrgBillingSnapshotForOrgInternalEffect(
  ctx: MutationCtx,
  args: BillingSnapshotArgs,
): Effect.Effect<null, ExternalServiceError> {
  return Effect.gen(function* () {
    const existing = yield* dbUniqueEffect<
      Doc<"orgBillingSnapshots">,
      ExternalServiceError
    >(
      ctx,
      "orgBillingSnapshots",
      (query) =>
        query.withIndex("by_org_id", (indexQuery) => indexQuery.eq("orgId", args.orgId)),
      (error) => toStorageMirrorError("Failed to load the organization billing snapshot.", error),
    );
    const updatedAtMs = Date.now();

    if (existing === null) {
      yield* dbInsertEffect(ctx, "orgBillingSnapshots", {
        orgId: args.orgId,
        currentTier: args.currentTier,
        updatedAtMs,
      }, (error) =>
        toStorageMirrorError("Failed to create the organization billing snapshot.", error),
      );
      return null;
    }

    yield* dbPatchEffect(
      ctx,
      existing._id,
      {
        currentTier: args.currentTier,
        updatedAtMs,
      },
      (error) => toStorageMirrorError("Failed to update the organization billing snapshot.", error),
    );
    return null;
  });
}

/**
 * Upserts the cached billing snapshot row for an organization.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The organization identifier and current billing tier.
 * @returns `null` after the snapshot is written.
 * @remarks This keeps a lightweight mirror of the latest resolved tier for downstream billing and audit flows.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const upsertOrgBillingSnapshotForOrgInternal = effectInternalMutation<
  BillingSnapshotArgs,
  null,
  any
>({
  args: {
    orgId: v.string(),
    currentTier: v.union(v.literal("free"), v.literal("pro"), v.literal("max"), v.null()),
  },
  returns: v.null(),
  handler: (args) =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectMutationCtx;
      const ctx = confectCtx.ctx as unknown as MutationCtx;
      return yield* upsertOrgBillingSnapshotForOrgInternalEffect(ctx, args);
    }),
});
