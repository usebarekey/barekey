import { v } from "convex/values";

import { internalMutation } from "../confect";
import {
  freePlanCreditStateValidator,
  getCanonicalFreePlanCreditForClerkUserId,
  toFreePlanCreditState,
  type ConsumeFreePlanCreditResult,
  type FreePlanCreditState,
} from "../lib/payments_state";

/**
 * Ensures a free-plan credit row exists for a Clerk user and optionally
 * consumes it for an organization when newly created.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The Clerk user and optional organization assignment details.
 * @returns The canonical free-plan credit state after initialization or assignment.
 * @remarks This may insert or patch `userFreePlanCredits`.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const ensureFreePlanCreditForClerkUserInternal = internalMutation({
  args: {
    clerkUserId: v.string(),
    orgId: v.union(v.string(), v.null()),
    orgSlug: v.union(v.string(), v.null()),
    consumeForOrgIfAvailable: v.boolean(),
  },
  returns: freePlanCreditStateValidator,
  handler: async (ctx, args): Promise<FreePlanCreditState> => {
    const now = Date.now();
    let row = await getCanonicalFreePlanCreditForClerkUserId(ctx, args.clerkUserId);
    let createdCredit = false;

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
      createdCredit = true;
    }
    if (row === null) {
      throw new Error("Unable to create a free organization credit.");
    }
    const currentRow = row;
    const currentRowId = currentRow._id;

    if (
      args.consumeForOrgIfAvailable &&
      createdCredit &&
      args.orgId !== null &&
      currentRow.assignedOrgId === null &&
      currentRow.remainingCredits > 0
    ) {
      const existingOrgAssignments = await ctx.db
        .query("userFreePlanCredits")
        .withIndex("by_assigned_org_id", (q) => q.eq("assignedOrgId", args.orgId))
        .collect();
      const assignmentExistsForAnotherCredit = existingOrgAssignments.some(
        (entry) => entry._id !== currentRowId,
      );
      if (assignmentExistsForAnotherCredit) {
        return toFreePlanCreditState(currentRow);
      }

      const nextRemainingCredits = Math.max(0, currentRow.remainingCredits - 1);
      await ctx.db.patch(currentRow._id, {
        remainingCredits: nextRemainingCredits,
        assignedOrgId: args.orgId,
        assignedOrgSlug: args.orgSlug,
        consumedAtMs: now,
        revokedAtMs: null,
        revokedReason: null,
        updatedAtMs: now,
      });
      row = {
        ...currentRow,
        remainingCredits: nextRemainingCredits,
        assignedOrgId: args.orgId,
        assignedOrgSlug: args.orgSlug,
        consumedAtMs: now,
        revokedAtMs: null,
        revokedReason: null,
        updatedAtMs: now,
      };
    } else if (
      args.orgId !== null &&
      currentRow.assignedOrgId === args.orgId &&
      currentRow.assignedOrgSlug !== args.orgSlug
    ) {
      await ctx.db.patch(currentRow._id, {
        assignedOrgSlug: args.orgSlug,
        updatedAtMs: now,
      });
      row = {
        ...currentRow,
        assignedOrgSlug: args.orgSlug,
        updatedAtMs: now,
      };
    }

    return toFreePlanCreditState(row ?? currentRow);
  },
});

/**
 * Consumes a free-plan credit for the current organization.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The Clerk user and target organization details.
 * @returns The credit grant result and canonical credit state.
 * @remarks This may insert or patch `userFreePlanCredits`, but will not grant more than one organization credit.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const consumeFreePlanCreditForCurrentOrgInternal = internalMutation({
  args: {
    clerkUserId: v.string(),
    orgId: v.string(),
    orgSlug: v.union(v.string(), v.null()),
  },
  returns: v.object({
    granted: v.boolean(),
    reason: v.union(
      v.literal("granted"),
      v.literal("already_assigned"),
      v.literal("org_already_assigned"),
      v.literal("assigned_elsewhere"),
      v.literal("no_remaining_credits"),
    ),
    credit: freePlanCreditStateValidator,
  }),
  handler: async (ctx, args): Promise<ConsumeFreePlanCreditResult> => {
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
    }
    if (row === null) {
      throw new Error("Unable to create a free organization credit.");
    }

    if (row.assignedOrgId === args.orgId) {
      if (row.assignedOrgSlug !== args.orgSlug) {
        await ctx.db.patch(row._id, {
          assignedOrgSlug: args.orgSlug,
          updatedAtMs: now,
        });
        row = {
          ...row,
          assignedOrgSlug: args.orgSlug,
          updatedAtMs: now,
        };
      }
      return {
        granted: true,
        reason: "already_assigned",
        credit: toFreePlanCreditState(row),
      };
    }

    const existingOrgAssignments = await ctx.db
      .query("userFreePlanCredits")
      .withIndex("by_assigned_org_id", (q) => q.eq("assignedOrgId", args.orgId))
      .collect();
    const assignmentExistsForAnotherCredit = existingOrgAssignments.some(
      (entry) => entry._id !== row._id,
    );
    if (assignmentExistsForAnotherCredit) {
      return {
        granted: false,
        reason: "org_already_assigned",
        credit: toFreePlanCreditState(row),
      };
    }

    if (row.assignedOrgId !== null && row.assignedOrgId !== args.orgId) {
      return {
        granted: false,
        reason: "assigned_elsewhere",
        credit: toFreePlanCreditState(row),
      };
    }

    if (row.remainingCredits <= 0) {
      return {
        granted: false,
        reason: "no_remaining_credits",
        credit: toFreePlanCreditState(row),
      };
    }

    const nextRemainingCredits = Math.max(0, row.remainingCredits - 1);
    await ctx.db.patch(row._id, {
      remainingCredits: nextRemainingCredits,
      assignedOrgId: args.orgId,
      assignedOrgSlug: args.orgSlug,
      consumedAtMs: now,
      revokedAtMs: null,
      revokedReason: null,
      updatedAtMs: now,
    });
    const patched = {
      ...row,
      remainingCredits: nextRemainingCredits,
      assignedOrgId: args.orgId,
      assignedOrgSlug: args.orgSlug,
      consumedAtMs: now,
      revokedAtMs: null,
      revokedReason: null,
      updatedAtMs: now,
    };
    return {
      granted: true,
      reason: "granted",
      credit: toFreePlanCreditState(patched),
    };
  },
});
