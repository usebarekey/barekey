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
  consumeFreePlanCreditResultValidator,
  type ConsumeFreePlanCreditArgs,
  type ConsumeFreePlanCreditResult,
  toFreePlanCreditError,
} from "./shared";

/**
 * Consumes a free-plan credit for the current organization.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The Clerk user and target organization details.
 * @returns The credit grant result and canonical credit state.
 * @remarks This may insert or patch `userFreePlanCredits`, but will not grant more than one organization credit.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const consumeFreePlanCreditForCurrentOrgInternal = effectInternalMutation<
  ConsumeFreePlanCreditArgs,
  ConsumeFreePlanCreditResult,
  any
>({
  args: {
    clerkUserId: v.string(),
    orgId: v.string(),
    orgSlug: v.union(v.string(), v.null()),
  },
  returns: consumeFreePlanCreditResultValidator,
  handler: (args) =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectMutationCtx;
      const ctx = confectCtx.ctx as unknown as MutationCtx;

      const now = Date.now();
      let row = (yield* ensureFreePlanCreditRowEffect(ctx, args.clerkUserId, now)).row;

      if (row.assignedOrgId === args.orgId) {
        if (row.assignedOrgSlug !== args.orgSlug) {
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
        return {
          granted: true,
          reason: "already_assigned",
          credit: toFreePlanCreditState(row),
        };
      }

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
          toFreePlanCreditError("Unable to consume the free organization credit.", error),
      );
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
    }),
});
