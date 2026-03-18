import { Effect } from "effect";
import { v } from "convex/values";

import type { MutationCtx } from "../../_generated/server";
import { BarekeyConfectMutationCtx, effectInternalMutation } from "../../confect";
import { ExternalServiceError } from "../../lib/errors/effect";
import {
  getCanonicalFreePlanCreditForClerkUserId,
  toFreePlanCreditState,
} from "../../lib/payments/state";
import { createAvailableFreePlanCreditRowEffect } from "./rows";
import {
  revokeCurrentOrgResultValidator,
  type RevokeCurrentOrgArgs,
  type RevokeCurrentOrgResult,
  toFreePlanCreditRevocationError,
} from "./shared";

/**
 * Revokes the free-plan credit assigned to the current organization.
 *
 * @param ctx The Convex mutation context.
 * @param args The Clerk user, organization, and optional revoke reason.
 * @returns An Effect that succeeds with the revoke result and canonical credit state.
 * @remarks This increments remaining credits back up to the cap and clears the assigned organization.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
function revokeFreePlanCreditForCurrentOrgInternalEffect(
  ctx: MutationCtx,
  args: RevokeCurrentOrgArgs,
): Effect.Effect<RevokeCurrentOrgResult, ExternalServiceError> {
  return Effect.gen(function* () {
    const now = Date.now();
    let row = yield* Effect.tryPromise({
      try: () => getCanonicalFreePlanCreditForClerkUserId(ctx, args.clerkUserId),
      catch: (error) =>
        toFreePlanCreditRevocationError("Failed to load the free-plan credit row.", error),
    });

    if (row === null) {
      row = yield* createAvailableFreePlanCreditRowEffect(ctx, args.clerkUserId, now);
      return {
        revoked: false,
        reason: "already_available",
        credit: toFreePlanCreditState(row),
      };
    }

    if (row.assignedOrgId === null) {
      return {
        revoked: false,
        reason: "already_available",
        credit: toFreePlanCreditState(row),
      };
    }

    if (row.assignedOrgId !== args.orgId) {
      return {
        revoked: false,
        reason: "not_assigned_to_org",
        credit: toFreePlanCreditState(row),
      };
    }

    const nextRemainingCredits = Math.min(row.totalCredits, row.remainingCredits + 1);
    const revokedReason = args.reason ?? "manual_revoke";
    yield* Effect.tryPromise({
      try: () =>
        ctx.db.patch(row._id, {
          remainingCredits: nextRemainingCredits,
          assignedOrgId: null,
          assignedOrgSlug: null,
          revokedAtMs: now,
          revokedReason,
          updatedAtMs: now,
        }),
      catch: (error) =>
        toFreePlanCreditRevocationError("Failed to revoke the current free-plan credit.", error),
    });
    const patched = {
      ...row,
      remainingCredits: nextRemainingCredits,
      assignedOrgId: null,
      assignedOrgSlug: null,
      revokedAtMs: now,
      revokedReason,
      updatedAtMs: now,
    };
    return {
      revoked: true,
      reason: "revoked",
      credit: toFreePlanCreditState(patched),
    };
  });
}

/**
 * Revokes the free-plan credit assigned to the current organization.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The Clerk user, organization, and optional revoke reason.
 * @returns The revoke result and canonical credit state.
 * @remarks This increments remaining credits back up to the cap and clears the assigned org.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const revokeFreePlanCreditForCurrentOrgInternal = effectInternalMutation<
  RevokeCurrentOrgArgs,
  RevokeCurrentOrgResult,
  any
>({
  args: {
    clerkUserId: v.string(),
    orgId: v.string(),
    reason: v.union(v.string(), v.null()),
  },
  returns: revokeCurrentOrgResultValidator,
  handler: (args) =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectMutationCtx;
      const ctx = confectCtx.ctx as unknown as MutationCtx;
      return yield* revokeFreePlanCreditForCurrentOrgInternalEffect(ctx, args);
    }),
});
