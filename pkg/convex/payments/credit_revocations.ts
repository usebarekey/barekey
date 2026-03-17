import { v } from "convex/values";

import { internalMutation } from "../confect";
import {
  freePlanCreditStateValidator,
  getCanonicalFreePlanCreditForClerkUserId,
  toFreePlanCreditState,
  type FreePlanCreditState,
} from "../lib/payments_state";

/**
 * Revokes the free-plan credit assigned to the current organization.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The Clerk user, organization, and optional revoke reason.
 * @returns The revoke result and canonical credit state.
 * @remarks This increments remaining credits back up to the cap and clears the assigned org.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const revokeFreePlanCreditForCurrentOrgInternal = internalMutation({
  args: {
    clerkUserId: v.string(),
    orgId: v.string(),
    reason: v.union(v.string(), v.null()),
  },
  returns: v.object({
    revoked: v.boolean(),
    reason: v.union(
      v.literal("revoked"),
      v.literal("already_available"),
      v.literal("not_assigned_to_org"),
    ),
    credit: freePlanCreditStateValidator,
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    let row = await getCanonicalFreePlanCreditForClerkUserId(ctx, args.clerkUserId);

    if (row === null) {
      const rowId = await ctx.db.insert("userFreePlanCredits", {
        clerkUserId: args.clerkUserId,
        totalCredits: 1,
        remainingCredits: 1,
        assignedOrgId: null,
        assignedOrgSlug: null,
        consumedAtMs: null,
        revokedAtMs: null,
        revokedReason: null,
        createdAtMs: now,
        updatedAtMs: now,
      });
      row = {
        _id: rowId,
        clerkUserId: args.clerkUserId,
        totalCredits: 1,
        remainingCredits: 1,
        assignedOrgId: null,
        assignedOrgSlug: null,
        consumedAtMs: null,
        revokedAtMs: null,
        revokedReason: null,
        createdAtMs: now,
        updatedAtMs: now,
      };
      return {
        revoked: false,
        reason: "already_available" as const,
        credit: toFreePlanCreditState(row),
      };
    }

    if (row.assignedOrgId === null) {
      return {
        revoked: false,
        reason: "already_available" as const,
        credit: toFreePlanCreditState(row),
      };
    }

    if (row.assignedOrgId !== args.orgId) {
      return {
        revoked: false,
        reason: "not_assigned_to_org" as const,
        credit: toFreePlanCreditState(row),
      };
    }

    const nextRemainingCredits = Math.min(row.totalCredits, row.remainingCredits + 1);
    await ctx.db.patch(row._id, {
      remainingCredits: nextRemainingCredits,
      assignedOrgId: null,
      assignedOrgSlug: null,
      revokedAtMs: now,
      revokedReason: args.reason ?? "manual_revoke",
      updatedAtMs: now,
    });
    const patched = {
      ...row,
      remainingCredits: nextRemainingCredits,
      assignedOrgId: null,
      assignedOrgSlug: null,
      revokedAtMs: now,
      revokedReason: args.reason ?? "manual_revoke",
      updatedAtMs: now,
    };
    return {
      revoked: true,
      reason: "revoked" as const,
      credit: toFreePlanCreditState(patched),
    };
  },
});

/**
 * Revokes the free-plan credit assigned to an organization without needing the
 * current Clerk user context.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The organization identifier and optional revoke reason.
 * @returns Whether any credit was revoked plus the first updated credit state.
 * @remarks This is used for administrative cleanup flows and may patch multiple matching credits.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const revokeFreePlanCreditByOrgIdInternal = internalMutation({
  args: {
    orgId: v.string(),
    reason: v.union(v.string(), v.null()),
  },
  returns: v.object({
    revoked: v.boolean(),
    credit: v.union(freePlanCreditStateValidator, v.null()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("userFreePlanCredits")
      .withIndex("by_assigned_org_id", (q) => q.eq("assignedOrgId", args.orgId))
      .collect();
    if (rows.length === 0) {
      return {
        revoked: false,
        credit: null,
      };
    }

    const patchedRows: Array<FreePlanCreditState> = [];
    for (const row of rows) {
      const nextRemainingCredits = Math.min(row.totalCredits, row.remainingCredits + 1);
      await ctx.db.patch(row._id, {
        remainingCredits: nextRemainingCredits,
        assignedOrgId: null,
        assignedOrgSlug: null,
        revokedAtMs: now,
        revokedReason: args.reason ?? "manual_revoke",
        updatedAtMs: now,
      });
      patchedRows.push(
        toFreePlanCreditState({
          ...row,
          remainingCredits: nextRemainingCredits,
          assignedOrgId: null,
          assignedOrgSlug: null,
          revokedAtMs: now,
          revokedReason: args.reason ?? "manual_revoke",
        }),
      );
    }

    return {
      revoked: true,
      credit: patchedRows[0] ?? null,
    };
  },
});
