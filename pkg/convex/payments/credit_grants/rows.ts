import { Effect } from "effect";
import type { MutationCtx } from "../../_generated/server";
import { ExternalServiceError } from "../../lib/errors/effect";
import { getCanonicalFreePlanCreditForClerkUserId } from "../../lib/payments/state";
import {
  type FreePlanCreditRow,
  toFreePlanCreditError,
} from "./shared";

/**
 * Creates the initial free-plan credit row for a Clerk user.
 *
 * @param ctx The Convex mutation context.
 * @param clerkUserId The Clerk user identifier that owns the credit.
 * @param now The shared timestamp for the insert.
 * @returns An Effect that succeeds with the newly created canonical row.
 * @remarks This inserts exactly one `userFreePlanCredits` row for the current initialization attempt.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
function createFreePlanCreditRowEffect(
  ctx: MutationCtx,
  clerkUserId: string,
  now: number,
): Effect.Effect<FreePlanCreditRow, ExternalServiceError> {
  return Effect.tryPromise({
    try: async () => {
      const rowId = await ctx.db.insert("userFreePlanCredits", {
        clerkUserId,
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

      return {
        _id: rowId,
        clerkUserId,
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
    },
    catch: (error) => toFreePlanCreditError("Unable to create a free organization credit.", error),
  });
}

/**
 * Loads or creates the canonical free-plan credit row for a Clerk user.
 *
 * @param ctx The Convex mutation context.
 * @param clerkUserId The Clerk user identifier that owns the credit.
 * @param now The shared timestamp for any lazy insert.
 * @returns An Effect that succeeds with the canonical row and whether it was newly created.
 * @remarks This keeps the mutation handlers focused on assignment logic instead of row bootstrapping.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function ensureFreePlanCreditRowEffect(
  ctx: MutationCtx,
  clerkUserId: string,
  now: number,
): Effect.Effect<
  {
    row: FreePlanCreditRow;
    createdCredit: boolean;
  },
  ExternalServiceError
> {
  return Effect.gen(function* () {
    const existing = yield* Effect.tryPromise({
      try: () => getCanonicalFreePlanCreditForClerkUserId(ctx, clerkUserId),
      catch: (error) =>
        toFreePlanCreditError("Unable to load the existing free organization credit.", error),
    });
    if (existing !== null) {
      return {
        row: existing,
        createdCredit: false,
      };
    }

    return {
      row: yield* createFreePlanCreditRowEffect(ctx, clerkUserId, now),
      createdCredit: true,
    };
  });
}
