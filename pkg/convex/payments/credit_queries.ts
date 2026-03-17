import { v } from "convex/values";

import { internalQuery } from "../confect";
import {
  freePlanCreditStateValidator,
  pickCanonicalRow,
  toFreePlanCreditState,
} from "../lib/payments_state";

/**
 * Reads the canonical free-plan credit row for a Clerk user.
 *
 * @param ctx The Convex internal query context.
 * @param args The Clerk user identifier.
 * @returns The canonical free-plan credit state, or `null`.
 * @remarks This is a read-only billing helper used by user and workspace plan flows.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const getFreePlanCreditForClerkUserIdInternal = internalQuery({
  args: {
    clerkUserId: v.string(),
  },
  returns: v.union(freePlanCreditStateValidator, v.null()),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("userFreePlanCredits")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .collect();
    const row = pickCanonicalRow(rows);
    if (row === null) {
      return null;
    }
    return toFreePlanCreditState(row);
  },
});

/**
 * Reads the free-plan credit assigned to an organization, if any.
 *
 * @param ctx The Convex internal query context.
 * @param args The organization identifier.
 * @returns The assigned free-plan credit state, or `null`.
 * @remarks This is used when deciding whether a free workspace should still count as active.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const getFreePlanCreditForOrgIdInternal = internalQuery({
  args: {
    orgId: v.string(),
  },
  returns: v.union(freePlanCreditStateValidator, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("userFreePlanCredits")
      .withIndex("by_assigned_org_id", (q) => q.eq("assignedOrgId", args.orgId))
      .first();
    if (row === null) {
      return null;
    }
    return toFreePlanCreditState(row);
  },
});
