import { Effect } from "effect";
import { v } from "convex/values";
import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import {
  BarekeyConfectMutationCtx,
  effectInternalMutation,
} from "../../confect";
import { dbCollectEffect, dbPatchEffect } from "../../lib/convex/db";
import { toFreePlanCreditState } from "../../lib/payments/state";
import { ensureFreePlanCreditRowEffect } from "./rows";
import {
  freePlanCreditStateValidator,
  type EnsureFreePlanCreditArgs,
  type FreePlanCreditState,
  toFreePlanCreditError,
} from "./shared";

/**
 * Ensures a free-plan credit row exists for a Clerk user and optionally
 * consumes it for an organization when newly created.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The Clerk user and optional organization assignment details.
 * @returns The canonical free-plan credit state after initialization or assignment.
 * @remarks This may insert or patch `userFreePlanCredits`.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const ensureFreePlanCreditForClerkUserInternal = effectInternalMutation<
  EnsureFreePlanCreditArgs,
  FreePlanCreditState,
  any
>({
  args: {
    clerkUserId: v.string(),
    orgId: v.union(v.string(), v.null()),
    orgSlug: v.union(v.string(), v.null()),
    consumeForOrgIfAvailable: v.boolean(),
  },
  returns: freePlanCreditStateValidator,
  handler: (args) =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectMutationCtx;
      const ctx = confectCtx.ctx as unknown as MutationCtx;

      const now = Date.now();
      const { row: initialRow, createdCredit } = yield* ensureFreePlanCreditRowEffect(
        ctx,
        args.clerkUserId,
        now,
      );
      let row = initialRow;
      const currentRowId = row._id;

      if (
        args.consumeForOrgIfAvailable &&
        createdCredit &&
        args.orgId !== null &&
        row.assignedOrgId === null &&
        row.remainingCredits > 0
      ) {
        const existingOrgAssignments = yield* dbCollectEffect<
          Doc<"userFreePlanCredits">,
          ReturnType<typeof toFreePlanCreditError>
        >(
          ctx,
          "userFreePlanCredits",
          (query) =>
            query.withIndex("by_assigned_org_id", (indexQuery) =>
              indexQuery.eq("assignedOrgId", args.orgId),
            ),
          (error) =>
            toFreePlanCreditError(
              "Unable to load existing free organization credit assignments.",
              error,
            ),
        );
        const assignmentExistsForAnotherCredit = existingOrgAssignments.some(
          (entry) => entry._id !== currentRowId,
        );
        if (assignmentExistsForAnotherCredit) {
          return toFreePlanCreditState(row);
        }

        const nextRemainingCredits = Math.max(0, row.remainingCredits - 1);
        yield* dbPatchEffect(
          ctx,
          row._id,
          {
            remainingCredits: nextRemainingCredits,
            assignedOrgId: args.orgId,
            assignedOrgSlug: args.orgSlug,
            consumedAtMs: now,
            revokedAtMs: null,
            revokedReason: null,
            updatedAtMs: now,
          },
          (error) =>
            toFreePlanCreditError("Unable to assign the free organization credit.", error),
        );
        row = {
          ...row,
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
        row.assignedOrgId === args.orgId &&
        row.assignedOrgSlug !== args.orgSlug
      ) {
        yield* dbPatchEffect(
          ctx,
          row._id,
          {
            assignedOrgSlug: args.orgSlug,
            updatedAtMs: now,
          },
          (error) =>
            toFreePlanCreditError("Unable to refresh the free organization credit slug.", error),
        );
        row = {
          ...row,
          assignedOrgSlug: args.orgSlug,
          updatedAtMs: now,
        };
      }

      return toFreePlanCreditState(row);
    }),
});
