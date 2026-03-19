import { Effect } from "effect";

import type { MutationCtx } from "../../_generated/server";
import { ExternalServiceError } from "../../lib/errors/effect";
import {
  type FreePlanCreditRow,
  toFreePlanCreditRevocationError,
} from "./shared";

/**
 * Creates the default available free-plan credit row for a Clerk user.
 *
 * @param convexCtx The Convex mutation context.
 * @param clerkUserId The Clerk user identifier.
 * @param now The shared timestamp for the insert.
 * @returns An Effect that succeeds with the inserted free-plan credit row.
 * @remarks This inserts a single unassigned available credit row when no canonical row exists yet.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function createAvailableFreePlanCreditRowEffect(
  convexCtx: MutationCtx,
  clerkUserId: string,
  now: number,
): Effect.Effect<FreePlanCreditRow, ExternalServiceError> {
  return Effect.tryPromise({
    try: async () => {
      const rowId = await convexCtx.db.insert("userFreePlanCredits", {
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
    catch: (error) =>
      toFreePlanCreditRevocationError("Failed to create the default free-plan credit row.", error),
  });
}
