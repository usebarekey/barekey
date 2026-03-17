import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction, internalMutation } from "../confect";

/**
 * Deletes one batch of expired audit events.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The current time and requested batch size.
 * @returns The number of deleted events plus whether another batch likely remains.
 * @remarks This mutates `auditEvents` and clamps the batch size to a safe range.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const pruneExpiredEventsBatchInternal = internalMutation({
  args: {
    nowMs: v.number(),
    batchSize: v.number(),
  },
  returns: v.object({
    deletedCount: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("auditEvents")
      .withIndex("by_expires_at_ms", (q) => q.lt("expiresAtMs", args.nowMs))
      .take(Math.min(Math.max(args.batchSize, 1), 500));

    for (const row of rows) {
      await ctx.db.delete(row._id);
    }

    return {
      deletedCount: rows.length,
      hasMore: rows.length === Math.min(Math.max(args.batchSize, 1), 500),
    };
  },
});

/**
 * Prunes expired audit events across multiple internal batches.
 *
 * @param ctx The Convex internal action context.
 * @returns The total number of deleted audit events.
 * @remarks This loops through at most 20 internal prune batches per invocation.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const pruneExpiredEventsInternal = internalAction({
  args: {},
  returns: v.object({
    deletedCount: v.number(),
  }),
  handler: async (ctx) => {
    let deletedCount = 0;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const batch = await ctx.runMutation(internal.audit.pruneExpiredEventsBatchInternal, {
        nowMs: Date.now(),
        batchSize: 250,
      });
      deletedCount += batch.deletedCount;
      if (!batch.hasMore) {
        break;
      }
    }

    return {
      deletedCount,
    };
  },
});
