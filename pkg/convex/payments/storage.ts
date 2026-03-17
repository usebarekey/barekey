import { v } from "convex/values";

import { internalMutation, internalQuery } from "../confect";
import { computeEncryptedBytesForOrg, getCanonicalOrgStorageUsageRow, pickCanonicalRow } from "../lib/payments_state";

/**
 * Reads the mirrored encrypted storage usage row for an organization.
 *
 * @param ctx The Convex internal query context.
 * @param args The organization identifier.
 * @returns The mirrored encrypted byte count and last update time, or `null`.
 * @remarks This reads the billing mirror table only and does not recompute usage.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const getOrgStorageUsageInternal = internalQuery({
  args: {
    orgId: v.string(),
  },
  returns: v.union(
    v.object({
      encryptedBytes: v.number(),
      updatedAtMs: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("orgStorageUsage")
      .withIndex("by_org_id", (q) => q.eq("orgId", args.orgId))
      .collect();
    const row = pickCanonicalRow(rows);
    if (row === null) {
      return null;
    }
    return {
      encryptedBytes: row.encryptedBytes,
      updatedAtMs: row.updatedAtMs,
    };
  },
});

/**
 * Ensures the organization storage mirror row exists, computing it from
 * encrypted project variables when needed.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The organization identifier.
 * @returns The current encrypted byte count and whether initialization occurred.
 * @remarks This writes `orgStorageUsage` only when the mirror row is missing.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const ensureOrgStorageUsageForOrgInternal = internalMutation({
  args: {
    orgId: v.string(),
  },
  returns: v.object({
    encryptedBytes: v.number(),
    initialized: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const existing = await getCanonicalOrgStorageUsageRow(ctx, args.orgId);
    if (existing !== null) {
      return {
        encryptedBytes: existing.encryptedBytes,
        initialized: false,
      };
    }
    const encryptedBytes = await computeEncryptedBytesForOrg(ctx, args.orgId);
    const now = Date.now();
    await ctx.db.insert("orgStorageUsage", {
      orgId: args.orgId,
      encryptedBytes,
      createdAtMs: now,
      updatedAtMs: now,
    });

    return {
      encryptedBytes,
      initialized: true,
    };
  },
});

/**
 * Upserts the cached billing snapshot row for an organization.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The organization identifier and current billing tier.
 * @returns `null` after the snapshot is written.
 * @remarks This keeps a lightweight mirror of the latest resolved tier for downstream billing and audit flows.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const upsertOrgBillingSnapshotForOrgInternal = internalMutation({
  args: {
    orgId: v.string(),
    currentTier: v.union(v.literal("free"), v.literal("pro"), v.literal("max"), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("orgBillingSnapshots")
      .withIndex("by_org_id", (q) => q.eq("orgId", args.orgId))
      .unique();
    const updatedAtMs = Date.now();

    if (existing === null) {
      await ctx.db.insert("orgBillingSnapshots", {
        orgId: args.orgId,
        currentTier: args.currentTier,
        updatedAtMs,
      });
      return null;
    }

    await ctx.db.patch(existing._id, {
      currentTier: args.currentTier,
      updatedAtMs,
    });
    return null;
  },
});

/**
 * Applies a storage delta to the mirrored encrypted-byte count for an organization.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The organization identifier and byte delta.
 * @returns The updated encrypted byte count and timestamp.
 * @remarks This initializes the mirror row on demand and never lets the stored byte count drop below zero.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const applyStorageDeltaForOrgInternal = internalMutation({
  args: {
    orgId: v.string(),
    deltaBytes: v.number(),
  },
  returns: v.object({
    encryptedBytes: v.number(),
    updatedAtMs: v.number(),
  }),
  handler: async (ctx, args): Promise<{ encryptedBytes: number; updatedAtMs: number }> => {
    let existing = await getCanonicalOrgStorageUsageRow(ctx, args.orgId);
    if (existing === null) {
      const encryptedBytes = await computeEncryptedBytesForOrg(ctx, args.orgId);
      const now = Date.now();
      const rowId = await ctx.db.insert("orgStorageUsage", {
        orgId: args.orgId,
        encryptedBytes,
        createdAtMs: now,
        updatedAtMs: now,
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
    await ctx.db.patch(existing._id, {
      encryptedBytes: nextEncryptedBytes,
      updatedAtMs: now,
    });

    return {
      encryptedBytes: nextEncryptedBytes,
      updatedAtMs: now,
    };
  },
});
