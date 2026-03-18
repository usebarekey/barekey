import { Effect } from "effect";

import type { MutationCtx } from "../_generated/server";
import { BarekeyConfectMutationCtx, effectMutation } from "../confect";
import { getOrgClaimsFromIdentity, requireIdentityEffect } from "../lib/auth";
import { AuthError, ExternalServiceError } from "../lib/errors/effect";
import { ensureFreePlanCreditForClerkUserInternalReference } from "../payments/refs";
import {
  deriveUserSlugBase,
  getCanonicalUserByClerkUserId,
  getCanonicalUserBySlug,
  randomNumericSuffix,
  userRecordValidator,
} from "./shared";

function toUserEnsureError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}

function allocateUniqueUserSlugEffect(
  ctx: MutationCtx,
  slugBase: string,
): Effect.Effect<string, ExternalServiceError> {
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
 * Ensures the authenticated Clerk user has a canonical Barekey user row.
 *
 * @param ctx The Convex mutation context.
 * @returns The canonical public user profile fields.
 * @remarks This updates the existing user record when present, otherwise creates one and ensures the default free-plan credit assignment.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function ensureCurrentUserEffect(): Effect.Effect<
  {
    clerkUserId: string;
    slug: string;
    slugBase: string;
    email: string | null;
    displayName: string | null;
    imageUrl: string | null;
  },
  AuthError | ExternalServiceError,
  any
> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectMutationCtx;
    const ctx = confectCtx.ctx as unknown as MutationCtx;
    const identity = yield* requireIdentityEffect(ctx);
    const orgClaims = getOrgClaimsFromIdentity(identity);
    const now = Date.now();
    const clerkUserId = identity.subject;
    const email = identity.email ?? null;
    const displayName = identity.name ?? identity.nickname ?? identity.preferredUsername ?? null;
    const imageUrl = identity.pictureUrl ?? null;

    const existingUser = yield* Effect.tryPromise({
      try: () => getCanonicalUserByClerkUserId(ctx, clerkUserId),
      catch: (error) =>
        toUserEnsureError("Failed to load the canonical user by Clerk id.", error),
    });

    if (existingUser) {
      yield* Effect.tryPromise({
        try: () =>
          ctx.db.patch(existingUser._id, {
            email,
            displayName,
            imageUrl,
            updatedAtMs: now,
            lastSeenAtMs: now,
          }),
        catch: (error) =>
          toUserEnsureError("Failed to update the canonical user record.", error),
      });

      yield* Effect.tryPromise({
        try: () =>
          ctx.runMutation(ensureFreePlanCreditForClerkUserInternalReference, {
            clerkUserId,
            orgId: orgClaims.orgId,
            orgSlug: orgClaims.orgSlug,
            consumeForOrgIfAvailable: true,
          }),
        catch: (error) =>
          toUserEnsureError("Failed to ensure the user's free plan credit.", error),
      });

      return {
        clerkUserId: existingUser.clerkUserId,
        slug: existingUser.slug,
        slugBase: existingUser.slugBase,
        email,
        displayName,
        imageUrl,
      };
    }

    const slugBase = deriveUserSlugBase(identity.email, identity.name ?? identity.nickname);
    const slug = yield* allocateUniqueUserSlugEffect(ctx, slugBase);

    yield* Effect.tryPromise({
      try: () =>
        ctx.db.insert("users", {
          clerkUserId,
          slug,
          slugBase,
          email,
          displayName,
          imageUrl,
          createdAtMs: now,
          updatedAtMs: now,
          lastSeenAtMs: now,
        }),
      catch: (error) =>
        toUserEnsureError("Failed to insert the canonical user row.", error),
    });

    yield* Effect.tryPromise({
      try: () =>
        ctx.runMutation(ensureFreePlanCreditForClerkUserInternalReference, {
          clerkUserId,
          orgId: orgClaims.orgId,
          orgSlug: orgClaims.orgSlug,
          consumeForOrgIfAvailable: true,
        }),
      catch: (error) =>
        toUserEnsureError("Failed to ensure the user's free plan credit.", error),
    });

    return {
      clerkUserId,
      slug,
      slugBase,
      email,
      displayName,
      imageUrl,
    };
  });
}

export const ensureCurrentUser = effectMutation({
  args: {},
  returns: userRecordValidator,
  handler: ensureCurrentUserEffect,
});
