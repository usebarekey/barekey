import { Effect } from "effect";
import { v } from "convex/values";

import type { QueryCtx } from "../_generated/server";
import { BarekeyConfectQueryCtx, effectInternalQuery } from "../confect";
import { ExternalServiceError } from "../lib/errors/effect";
import {
  freePlanCreditStateValidator,
  pickCanonicalRow,
  toFreePlanCreditState,
} from "../lib/payments/state";

type ClerkUserIdArgs = {
  clerkUserId: string;
};

type OrgIdArgs = {
  orgId: string;
};

type FreePlanCreditQueryResult = ReturnType<typeof toFreePlanCreditState> | null;

/**
 * Normalizes free-plan credit query failures into typed external-service errors.
 *
 * @param fallbackMessage The fallback message to use when the failure is not an `Error`.
 * @param error The unknown failure value.
 * @returns A typed external-service error.
 * @remarks These queries are infrastructure reads and should stay on the shared Effect error channel.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function toFreePlanCreditQueryError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}

/**
 * Reads the canonical free-plan credit row for a Clerk user.
 *
 * @param ctx The Convex query context.
 * @param args The Clerk user identifier.
 * @returns An Effect that succeeds with the canonical free-plan credit state, or `null`.
 * @remarks This is a read-only billing helper used by user and workspace plan flows.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function getFreePlanCreditForClerkUserIdInternalEffect(
  ctx: QueryCtx,
  args: ClerkUserIdArgs,
): Effect.Effect<FreePlanCreditQueryResult, ExternalServiceError> {
  return Effect.tryPromise({
    try: async () => {
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
    catch: (error) =>
      toFreePlanCreditQueryError("Failed to read the Clerk user's free-plan credit.", error),
  });
}

/**
 * Reads the free-plan credit assigned to an organization, if any.
 *
 * @param ctx The Convex query context.
 * @param args The organization identifier.
 * @returns An Effect that succeeds with the assigned free-plan credit state, or `null`.
 * @remarks This is used when deciding whether a free workspace should still count as active.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function getFreePlanCreditForOrgIdInternalEffect(
  ctx: QueryCtx,
  args: OrgIdArgs,
): Effect.Effect<FreePlanCreditQueryResult, ExternalServiceError> {
  return Effect.tryPromise({
    try: async () => {
      const row = await ctx.db
        .query("userFreePlanCredits")
        .withIndex("by_assigned_org_id", (q) => q.eq("assignedOrgId", args.orgId))
        .first();
      if (row === null) {
        return null;
      }
      return toFreePlanCreditState(row);
    },
    catch: (error) =>
      toFreePlanCreditQueryError(
        "Failed to read the organization's assigned free-plan credit.",
        error,
      ),
  });
}

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
export const getFreePlanCreditForClerkUserIdInternal = effectInternalQuery<
  ClerkUserIdArgs,
  FreePlanCreditQueryResult,
  any
>({
  args: {
    clerkUserId: v.string(),
  },
  returns: v.union(freePlanCreditStateValidator, v.null()),
  handler: (args) =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectQueryCtx;
      const ctx = confectCtx.ctx as unknown as QueryCtx;
      return yield* getFreePlanCreditForClerkUserIdInternalEffect(ctx, args);
    }),
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
export const getFreePlanCreditForOrgIdInternal = effectInternalQuery<
  OrgIdArgs,
  FreePlanCreditQueryResult,
  any
>({
  args: {
    orgId: v.string(),
  },
  returns: v.union(freePlanCreditStateValidator, v.null()),
  handler: (args) =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectQueryCtx;
      const ctx = confectCtx.ctx as unknown as QueryCtx;
      return yield* getFreePlanCreditForOrgIdInternalEffect(ctx, args);
    }),
});
