import { Effect } from "effect";
import { v } from "convex/values";

import type { MutationCtx } from "../../_generated/server";
import { BarekeyConfectMutationCtx, effectInternalMutation } from "../../confect";
import { ExternalServiceError } from "../../lib/errors/effect";
import { toFreePlanCreditState } from "../../lib/payments/state";
import {
  revokeByOrgIdResultValidator,
  type RevokeByOrgIdArgs,
  type RevokeByOrgIdResult,
  toFreePlanCreditRevocationError,
} from "./shared";

/**
 * Revokes every free-plan credit assigned to one organization.
 *
 * @param runtimeCtx The Convex mutation context.
 * @param args The organization identifier and optional revoke reason.
 * @returns An Effect that succeeds with whether anything was revoked and the first updated credit.
 * @remarks This is used for administrative cleanup flows and may patch multiple matching credit rows.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
function revokeFreePlanCreditByOrgIdInternalEffect(
  runtimeCtx: MutationCtx,
  args: RevokeByOrgIdArgs,
): Effect.Effect<RevokeByOrgIdResult, ExternalServiceError> {
  return Effect.gen(function* () {
    const now = Date.now();
    const rows = yield* Effect.tryPromise({
      try: () =>
        runtimeCtx.db
          .query("userFreePlanCredits")
          .withIndex("by_assigned_org_id", (q) => q.eq("assignedOrgId", args.orgId))
          .collect(),
      catch: (error) =>
        toFreePlanCreditRevocationError(
          "Failed to load organization-assigned free-plan credits.",
          error,
        ),
    });
    if (rows.length === 0) {
      return {
        revoked: false,
        credit: null,
      };
    }

    const revokedReason = args.reason ?? "manual_revoke";
    const patchedRows = yield* Effect.forEach(
      rows,
      (row) =>
        Effect.gen(function* () {
          const nextRemainingCredits = Math.min(row.totalCredits, row.remainingCredits + 1);
          yield* Effect.tryPromise({
            try: () =>
              runtimeCtx.db.patch(row._id, {
                remainingCredits: nextRemainingCredits,
                assignedOrgId: null,
                assignedOrgSlug: null,
                revokedAtMs: now,
                revokedReason,
                updatedAtMs: now,
              }),
            catch: (error) =>
              toFreePlanCreditRevocationError(
                "Failed to revoke an organization-assigned free-plan credit.",
                error,
              ),
          });
          return toFreePlanCreditState({
            ...row,
            remainingCredits: nextRemainingCredits,
            assignedOrgId: null,
            assignedOrgSlug: null,
            revokedAtMs: now,
            revokedReason,
          });
        }),
      { concurrency: 1 },
    );

    return {
      revoked: true,
      credit: patchedRows[0] ?? null,
    };
  });
}

/**
 * Revokes the free-plan credit assigned to an organization without needing the
 * current Clerk user context.
 *
 * @param runtimeCtx The Convex internal mutation context.
 * @param args The organization identifier and optional revoke reason.
 * @returns Whether any credit was revoked plus the first updated credit state.
 * @remarks This is used for administrative cleanup flows and may patch multiple matching credits.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const revokeFreePlanCreditByOrgIdInternal = effectInternalMutation<
  RevokeByOrgIdArgs,
  RevokeByOrgIdResult,
  any
>({
  args: {
    orgId: v.string(),
    reason: v.union(v.string(), v.null()),
  },
  returns: revokeByOrgIdResultValidator,
  handler: (args) =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectMutationCtx;
      const runtimeCtx = confectCtx.ctx as unknown as MutationCtx;
      return yield* revokeFreePlanCreditByOrgIdInternalEffect(runtimeCtx, args);
    }),
});
