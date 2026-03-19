import { Effect, Schema } from "effect";

import type { MutationCtx } from "../../_generated/server";
import { BarekeyConfectMutationCtx, schemaEffectMutation } from "../../confect";
import { getOrgClaimsFromIdentity, requireIdentityEffect } from "../../lib/auth";
import { AuthError, ExternalServiceError } from "../../lib/errors/effect";
import { userRecordSchema } from "../shared";
import {
  allocateUniqueUserSlugEffect,
  deriveCanonicalUserSlugBase,
  ensureFreePlanCreditAssignmentEffect,
  getCanonicalUserByClerkUserIdEffect,
  insertCanonicalUserEffect,
  patchCanonicalUserEffect,
} from "./repo";

/**
 * Ensures the authenticated Clerk user has a canonical Barekey user row.
 *
 * @param ctx The Convex mutation context.
 * @returns The canonical public user profile fields.
 * @remarks This updates the existing user record when present, otherwise creates one and ensures the default free-plan credit assignment.
 * @lastModified 2026-03-18
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

    const existingUser = yield* getCanonicalUserByClerkUserIdEffect(ctx, clerkUserId);

    if (existingUser) {
      yield* patchCanonicalUserEffect(ctx, {
        userId: String(existingUser._id),
        email,
        displayName,
        imageUrl,
        now,
      });

      yield* ensureFreePlanCreditAssignmentEffect(ctx, {
        clerkUserId,
        orgId: orgClaims.orgId,
        orgSlug: orgClaims.orgSlug,
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

    const slugBase = deriveCanonicalUserSlugBase(identity.email ?? null, identity.name ?? identity.nickname ?? null);
    const slug = yield* allocateUniqueUserSlugEffect(ctx, slugBase);

    yield* insertCanonicalUserEffect(ctx, {
      clerkUserId,
      slug,
      slugBase,
      email,
      displayName,
      imageUrl,
      now,
    });

    yield* ensureFreePlanCreditAssignmentEffect(ctx, {
      clerkUserId,
      orgId: orgClaims.orgId,
      orgSlug: orgClaims.orgSlug,
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

/**
 * Ensures the authenticated Clerk user has a canonical Barekey user row.
 *
 * @remarks This public mutation delegates to the Effect-native user ensure program.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const ensureCurrentUser = schemaEffectMutation({
  args: Schema.Struct({}),
  returns: userRecordSchema,
  handler: ensureCurrentUserEffect,
});
