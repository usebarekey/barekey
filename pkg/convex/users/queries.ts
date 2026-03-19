import { Effect } from "effect";
import { v } from "convex/values";

import type { QueryCtx } from "../_generated/server";
import { BarekeyConfectQueryCtx, effectQuery } from "../confect";
import { requireIdentity } from "../lib/auth";
import { AuthError, ExternalServiceError } from "../lib/errors/effect";
import {
  currentUserFreePlanCreditValidator,
  getCanonicalUserByClerkUserId,
  getCanonicalUserBySlug,
  pickCanonicalUserRow,
  userAccountRecordValidator,
  userRecordValidator,
} from "./shared";

function toUserQueryError(error: unknown): AuthError | ExternalServiceError {
  if (error instanceof AuthError || error instanceof ExternalServiceError) {
    return error;
  }

  return new ExternalServiceError({
    message: error instanceof Error ? error.message : "Failed to load user query data.",
    cause: error,
  });
}

function withUserQueryCtx<Args, Result>(
  handler: (runtimeCtx: QueryCtx, args: Args) => Promise<Result>,
  args: Args,
): Effect.Effect<Result, AuthError | ExternalServiceError, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectQueryCtx;
    const runtimeCtx = confectCtx.ctx as unknown as QueryCtx;
    return yield* Effect.tryPromise({
      try: () => handler(runtimeCtx, args),
      catch: toUserQueryError,
    });
  });
}

/**
 * Returns the current authenticated user's public profile fields.
 *
 * @param runtimeCtx The Convex query context.
 * @returns The canonical public user record, or `null` when the user has not been provisioned.
 * @remarks This is read-only and does not create user rows implicitly.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const getCurrentUser = effectQuery<{}, {
  clerkUserId: string;
  slug: string;
  slugBase: string;
  email: string | null;
  displayName: string | null;
  imageUrl: string | null;
} | null, any>({
  args: {},
  returns: v.union(userRecordValidator, v.null()),
  handler: () =>
    withUserQueryCtx(async (runtimeCtx) => {
    const identity = await runtimeCtx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }

    const user = await getCanonicalUserByClerkUserId(runtimeCtx, identity.subject);
    if (user === null) {
      return null;
    }

    return {
      clerkUserId: user.clerkUserId,
      slug: user.slug,
      slugBase: user.slugBase,
      email: user.email,
      displayName: user.displayName,
      imageUrl: user.imageUrl,
    };
  }, {}),
});

/**
 * Returns the current user's account record with lifecycle timestamps for timeline views.
 *
 * @param runtimeCtx The Convex query context.
 * @returns The canonical user account record, or `null`.
 * @remarks This includes created/updated/last-seen timestamps for account surfaces that need them.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const getCurrentUserAccount = effectQuery<{}, {
  clerkUserId: string;
  slug: string;
  slugBase: string;
  email: string | null;
  displayName: string | null;
  imageUrl: string | null;
  createdAtMs: number;
  updatedAtMs: number;
  lastSeenAtMs: number;
} | null, any>({
  args: {},
  returns: v.union(userAccountRecordValidator, v.null()),
  handler: () =>
    withUserQueryCtx(async (runtimeCtx) => {
    const identity = await runtimeCtx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }

    const user = await getCanonicalUserByClerkUserId(runtimeCtx, identity.subject);
    if (user === null) {
      return null;
    }

    return {
      clerkUserId: user.clerkUserId,
      slug: user.slug,
      slugBase: user.slugBase,
      email: user.email,
      displayName: user.displayName,
      imageUrl: user.imageUrl,
      createdAtMs: user.createdAtMs,
      updatedAtMs: user.updatedAtMs,
      lastSeenAtMs: user.lastSeenAtMs,
    };
  }, {}),
});

/**
 * Looks up a user's public profile by slug.
 *
 * @param runtimeCtx The Convex query context.
 * @param args The user slug to look up.
 * @returns The public slug/display-name pair, or `null`.
 * @remarks This intentionally exposes only public-facing profile fields.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const getBySlug = effectQuery<
  {
    slug: string;
  },
  {
    slug: string;
    displayName: string | null;
  } | null,
  any
>({
  args: {
    slug: v.string(),
  },
  returns: v.union(
    v.object({
      slug: v.string(),
      displayName: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: (args) =>
    withUserQueryCtx(async (runtimeCtx, innerArgs) => {
    const user = await getCanonicalUserBySlug(runtimeCtx, innerArgs.slug);
    if (user === null) {
      return null;
    }

    return {
      slug: user.slug,
      displayName: user.displayName,
    };
  }, args),
});

/**
 * Returns the current user's free workspace credit status and assignment.
 *
 * @param runtimeCtx The Convex query context.
 * @returns The free-plan credit totals and current workspace assignment.
 * @remarks Missing credit rows default to a single unassigned available credit.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const getCurrentUserFreePlanCredit = effectQuery<{}, {
  totalCredits: number;
  remainingCredits: number;
  assignedOrgId: string | null;
  assignedOrgSlug: string | null;
}, any>({
  args: {},
  returns: currentUserFreePlanCreditValidator,
  handler: () =>
    withUserQueryCtx(async (runtimeCtx) => {
    const identity = await requireIdentity(runtimeCtx);
    const credits = await runtimeCtx.db
      .query("userFreePlanCredits")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .collect();
    const credit = pickCanonicalUserRow(
      credits.map((row) => ({
        ...row,
        createdAtMs: row.createdAtMs,
      })),
    );

    if (credit === null) {
      return {
        totalCredits: 1,
        remainingCredits: 1,
        assignedOrgId: null,
        assignedOrgSlug: null,
      };
    }

    return {
      totalCredits: credit.totalCredits,
      remainingCredits: credit.remainingCredits,
      assignedOrgId: credit.assignedOrgId,
      assignedOrgSlug: credit.assignedOrgSlug,
    };
  }, {}),
});
