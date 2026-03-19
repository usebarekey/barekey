import { Effect } from "effect";

import type { MutationCtx } from "../../_generated/server";
import { dbInsertEffect, dbPatchEffect } from "../../lib/convex/db";
import { runMutationEffect } from "../../lib/convex/functions";
import { ensureFreePlanCreditForClerkUserInternalReference } from "../../payments/refs";
import {
  deriveUserSlugBase,
  getCanonicalUserByClerkUserId,
  getCanonicalUserBySlug,
  randomNumericSuffix,
} from "../shared";
import { toUserEnsureError } from "./shared";

/**
 * Loads the canonical user row for a Clerk user id.
 *
 * @param ctx The Convex mutation context.
 * @param clerkUserId The Clerk user id to resolve.
 * @returns The canonical user row, or `null`.
 * @remarks This wraps the shared lookup helper with typed Effect error mapping.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function getCanonicalUserByClerkUserIdEffect(
  ctx: MutationCtx,
  clerkUserId: string,
) {
  return Effect.tryPromise({
    try: () => getCanonicalUserByClerkUserId(ctx, clerkUserId),
    catch: (error) =>
      toUserEnsureError("Failed to load the canonical user by Clerk id.", error),
  });
}

/**
 * Allocates a unique canonical user slug for a new user row.
 *
 * @param ctx The Convex mutation context.
 * @param slugBase The normalized slug base to expand with random suffixes.
 * @returns An Effect that yields a unique slug.
 * @remarks This checks for slug collisions before a new user row is inserted.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function allocateUniqueUserSlugEffect(
  ctx: MutationCtx,
  slugBase: string,
): Effect.Effect<string, ReturnType<typeof toUserEnsureError>> {
  return Effect.gen(function* () {
    for (const suffixLength of [4, 6] as const) {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const candidate = `${slugBase}-${randomNumericSuffix(suffixLength)}`;
        const collision = yield* Effect.tryPromise({
          try: () => getCanonicalUserBySlug(ctx, candidate),
          catch: (error) =>
            toUserEnsureError(`Failed while checking user slug ${candidate}.`, error),
        });
        if (collision === null) {
          return candidate;
        }
      }
    }

    return yield* Effect.fail(
      toUserEnsureError("Unable to allocate a unique user slug.", null),
    );
  });
}

/**
 * Updates the canonical user row with the latest identity fields.
 *
 * @param ctx The Convex mutation context.
 * @param input The existing row id and normalized user profile fields to persist.
 * @returns An Effect that completes after the row is patched.
 * @remarks This writes the current email, display name, image url, and last-seen timestamps.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function patchCanonicalUserEffect(
  ctx: MutationCtx,
  input: {
    userId: string;
    email: string | null;
    displayName: string | null;
    imageUrl: string | null;
    now: number;
  },
) {
  return dbPatchEffect(
    ctx,
    input.userId,
    {
      email: input.email,
      displayName: input.displayName,
      imageUrl: input.imageUrl,
      updatedAtMs: input.now,
      lastSeenAtMs: input.now,
    },
    (error) => toUserEnsureError("Failed to update the canonical user record.", error),
  );
}

/**
 * Inserts a new canonical user row.
 *
 * @param ctx The Convex mutation context.
 * @param input The canonical user fields to insert.
 * @returns An Effect that completes after the user row is inserted.
 * @remarks This writes the initial user profile row for a newly seen Clerk user.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function insertCanonicalUserEffect(
  ctx: MutationCtx,
  input: {
    clerkUserId: string;
    slug: string;
    slugBase: string;
    email: string | null;
    displayName: string | null;
    imageUrl: string | null;
    now: number;
  },
) {
  return dbInsertEffect(
    ctx,
    "users",
    {
      clerkUserId: input.clerkUserId,
      slug: input.slug,
      slugBase: input.slugBase,
      email: input.email,
      displayName: input.displayName,
      imageUrl: input.imageUrl,
      createdAtMs: input.now,
      updatedAtMs: input.now,
      lastSeenAtMs: input.now,
    },
    (error) => toUserEnsureError("Failed to insert the canonical user row.", error),
  );
}

/**
 * Ensures the user has a free-plan credit assignment for the active organization.
 *
 * @param ctx The Convex mutation context.
 * @param input The Clerk user and active organization context.
 * @returns An Effect that completes after the free-plan credit mutation runs.
 * @remarks This delegates to the payments internal mutation used during first sign-in and subsequent refreshes.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function ensureFreePlanCreditAssignmentEffect(
  ctx: MutationCtx,
  input: {
    clerkUserId: string;
    orgId: string | null;
    orgSlug: string | null;
  },
) {
  return runMutationEffect(
    ctx,
    ensureFreePlanCreditForClerkUserInternalReference,
    {
      clerkUserId: input.clerkUserId,
      orgId: input.orgId,
      orgSlug: input.orgSlug,
      consumeForOrgIfAvailable: true,
    },
    (error) => toUserEnsureError("Failed to ensure the user's free plan credit.", error),
  );
}

/**
 * Derives the normalized slug base for a canonical user.
 *
 * @param email The Clerk email value.
 * @param name The Clerk display name value.
 * @returns The normalized slug base.
 * @remarks This is re-exported here so the user-ensure program depends on one repo module.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function deriveCanonicalUserSlugBase(email: string | null, name: string | null) {
  return deriveUserSlugBase(email ?? undefined, name ?? undefined);
}
