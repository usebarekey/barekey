import { v } from "convex/values";

import { internalMutation } from "../confect";
import { pickCanonicalRow } from "../lib/payments_state";

/**
 * Logs a billing request key for idempotency and deduplicates concurrent inserts.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The organization, request key, feature, and unit count to log.
 * @returns Whether the request key was newly inserted.
 * @remarks This mutates `billingRequestLog` and deletes duplicate rows when races occur.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const logBillingRequestInternal = internalMutation({
  args: {
    orgId: v.string(),
    requestKey: v.string(),
    featureId: v.string(),
    units: v.number(),
  },
  returns: v.object({
    inserted: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("billingRequestLog")
      .withIndex("by_org_id_and_request_key", (q) =>
        q.eq("orgId", args.orgId).eq("requestKey", args.requestKey),
      )
      .collect();
    if (existing.length > 0) {
      return { inserted: false };
    }

    const rowId = await ctx.db.insert("billingRequestLog", {
      orgId: args.orgId,
      requestKey: args.requestKey,
      featureId: args.featureId,
      units: args.units,
      createdAtMs: Date.now(),
    });
    const rows = await ctx.db
      .query("billingRequestLog")
      .withIndex("by_org_id_and_request_key", (q) =>
        q.eq("orgId", args.orgId).eq("requestKey", args.requestKey),
      )
      .collect();
    const canonical = pickCanonicalRow(rows);
    if (canonical === null) {
      return { inserted: false };
    }
    if (canonical._id !== rowId) {
      await ctx.db.delete(rowId);
      return { inserted: false };
    }

    for (const row of rows) {
      if (row._id !== canonical._id) {
        await ctx.db.delete(row._id);
      }
    }
    return { inserted: true };
  },
});
