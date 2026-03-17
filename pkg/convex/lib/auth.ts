import type { UserIdentity } from "convex/server";
import { Effect } from "effect";

import { AuthError } from "./effect_errors";

type AuthLikeCtx = {
  auth: {
    getUserIdentity(): Promise<UserIdentity | null>;
  };
};

export type OrgClaims = {
  clerkUserId: string;
  orgId: string | null;
  orgSlug: string | null;
  orgRole: string | null;
};

export type ActiveOrgClaims = {
  clerkUserId: string;
  orgId: string;
  orgSlug: string;
  orgRole: string | null;
};

export type ActiveOrgIdClaims = {
  clerkUserId: string;
  orgId: string;
  orgSlug: string | null;
  orgRole: string | null;
};

/**
 * Normalizes unknown auth failures into the shared typed auth error shape.
 *
 * @param error The unknown failure value to normalize.
 * @param fallbackMessage The message to use when the failure has no usable message.
 * @returns A typed auth error with a stable message.
 * @remarks This is used at Effect boundaries and does not read or write Convex state.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function toAuthError(error: unknown, fallbackMessage: string): AuthError {
  return new AuthError({
    message: error instanceof Error ? error.message : fallbackMessage,
  });
}

/**
 * Converts a typed auth error back into a thrown `Error` for compatibility with
 * legacy async and sync call sites.
 *
 * @param error The typed auth error to convert.
 * @returns A standard `Error` instance carrying the same message.
 * @remarks This compatibility shim should disappear as callers move to the Effect-native exports.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function toThrownAuthError(error: AuthError): Error {
  return new Error(error.message);
}

/**
 * Reads a string-valued Clerk claim from a user identity object.
 *
 * @param identity The authenticated Clerk identity.
 * @param key The claim key to read.
 * @returns The string claim value or `null` when the claim is absent or not a string.
 * @remarks This is a pure helper and does not perform any I/O.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function readStringClaim(identity: UserIdentity, key: string): string | null {
  const value = identity[key];
  return typeof value === "string" ? value : null;
}

/**
 * Resolves the authenticated Clerk identity as an Effect program.
 *
 * @param ctx The Convex-like auth context that can resolve the current identity.
 * @returns An Effect that succeeds with the authenticated identity or fails with `AuthError`.
 * @remarks This is the Effect-native entrypoint future handlers should depend on.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function requireIdentityEffect(ctx: AuthLikeCtx): Effect.Effect<UserIdentity, AuthError> {
  return Effect.gen(function* () {
    const identity = yield* Effect.tryPromise({
      try: () => ctx.auth.getUserIdentity(),
      catch: (error) => toAuthError(error, "Failed to resolve user identity."),
    });

    if (identity === null) {
      return yield* Effect.fail(new AuthError({ message: "Unauthorized" }));
    }

    return identity;
  });
}

/**
 * Resolves the authenticated Clerk identity for existing promise-based callers.
 *
 * @param ctx The Convex-like auth context that can resolve the current identity.
 * @returns A promise for the authenticated identity.
 * @remarks This compatibility wrapper rethrows `AuthError` as a standard `Error`.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function requireIdentity(ctx: AuthLikeCtx): Promise<UserIdentity> {
  return await Effect.runPromise(
    requireIdentityEffect(ctx).pipe(
      Effect.mapError(toThrownAuthError),
    ),
  );
}

/**
 * Extracts organization-related Clerk claims from an identity object.
 *
 * @param identity The authenticated Clerk identity.
 * @returns The normalized organization claims.
 * @remarks This is pure data shaping and does not validate whether an active organization is present.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function getOrgClaimsFromIdentity(identity: UserIdentity): OrgClaims {
  return {
    clerkUserId: identity.subject,
    orgId: readStringClaim(identity, "org_id"),
    orgSlug: readStringClaim(identity, "org_slug"),
    orgRole: readStringClaim(identity, "org_role"),
  };
}

/**
 * Validates that an identity has both an active organization ID and slug.
 *
 * @param identity The authenticated Clerk identity to validate.
 * @returns An Effect that succeeds with active organization claims or fails with `AuthError`.
 * @remarks This is the Effect-native validation path for organization-scoped handlers.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function requireActiveOrgClaimsEffect(
  identity: UserIdentity,
): Effect.Effect<ActiveOrgClaims, AuthError> {
  return Effect.gen(function* () {
    const claims = getOrgClaimsFromIdentity(identity);

    if (claims.orgId === null) {
      return yield* Effect.fail(new AuthError({ message: "No active organization selected." }));
    }

    if (claims.orgSlug === null) {
      return yield* Effect.fail(new AuthError({ message: "Active organization slug is missing." }));
    }

    return {
      clerkUserId: claims.clerkUserId,
      orgId: claims.orgId,
      orgSlug: claims.orgSlug,
      orgRole: claims.orgRole,
    };
  });
}

/**
 * Validates that an identity has both an active organization ID and slug for
 * existing synchronous callers.
 *
 * @param identity The authenticated Clerk identity to validate.
 * @returns The validated active organization claims.
 * @remarks This compatibility wrapper throws a standard `Error` so current callers keep working unchanged.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function requireActiveOrgClaims(identity: UserIdentity): ActiveOrgClaims {
  return Effect.runSync(
    requireActiveOrgClaimsEffect(identity).pipe(
      Effect.mapError(toThrownAuthError),
    ),
  );
}

/**
 * Returns active organization claims when both the organization ID and slug are present.
 *
 * @param identity The authenticated Clerk identity to inspect.
 * @returns The active organization claims or `null` when the identity is not scoped to an active organization.
 * @remarks This is a pure helper intended for optional organization-aware flows.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function getActiveOrgClaimsOrNull(identity: UserIdentity): ActiveOrgClaims | null {
  const claims = getOrgClaimsFromIdentity(identity);

  if (claims.orgId === null || claims.orgSlug === null) {
    return null;
  }

  return {
    clerkUserId: claims.clerkUserId,
    orgId: claims.orgId,
    orgSlug: claims.orgSlug,
    orgRole: claims.orgRole,
  };
}

/**
 * Validates that an identity has an active organization ID, allowing a missing slug.
 *
 * @param identity The authenticated Clerk identity to validate.
 * @returns An Effect that succeeds with active organization ID claims or fails with `AuthError`.
 * @remarks This is useful for flows that only require organization identity and not the workspace slug.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function requireActiveOrgIdClaimsEffect(
  identity: UserIdentity,
): Effect.Effect<ActiveOrgIdClaims, AuthError> {
  return Effect.gen(function* () {
    const claims = getOrgClaimsFromIdentity(identity);

    if (claims.orgId === null) {
      return yield* Effect.fail(new AuthError({ message: "No active organization selected." }));
    }

    return {
      clerkUserId: claims.clerkUserId,
      orgId: claims.orgId,
      orgSlug: claims.orgSlug,
      orgRole: claims.orgRole,
    };
  });
}

/**
 * Validates that an identity has an active organization ID for existing
 * synchronous callers.
 *
 * @param identity The authenticated Clerk identity to validate.
 * @returns The validated active organization ID claims.
 * @remarks This compatibility wrapper throws a standard `Error` so current callers keep working unchanged.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function requireActiveOrgIdClaims(identity: UserIdentity): ActiveOrgIdClaims {
  return Effect.runSync(
    requireActiveOrgIdClaimsEffect(identity).pipe(
      Effect.mapError(toThrownAuthError),
    ),
  );
}

/**
 * Returns organization ID claims when an active organization ID exists.
 *
 * @param identity The authenticated Clerk identity to inspect.
 * @returns The active organization ID claims or `null` when no organization is selected.
 * @remarks This is a pure helper for optional organization-aware flows.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function getActiveOrgIdClaimsOrNull(identity: UserIdentity): ActiveOrgIdClaims | null {
  const claims = getOrgClaimsFromIdentity(identity);

  if (claims.orgId === null) {
    return null;
  }

  return {
    clerkUserId: claims.clerkUserId,
    orgId: claims.orgId,
    orgSlug: claims.orgSlug,
    orgRole: claims.orgRole,
  };
}

/**
 * Verifies that the current active organization slug matches an expected workspace slug.
 *
 * @param claims The current organization claims.
 * @param expectedOrgSlug The workspace slug requested by the caller, if any.
 * @returns An Effect that succeeds when the slug matches or is not required.
 * @remarks This is the Effect-native validation path for workspace-scoped requests.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function assertExpectedOrgSlugEffect(
  claims: { orgSlug: string | null },
  expectedOrgSlug: string | null,
): Effect.Effect<void, AuthError> {
  if (expectedOrgSlug === null) {
    return Effect.void;
  }

  if (claims.orgSlug !== expectedOrgSlug) {
    return Effect.fail(
      new AuthError({
        message: "Active organization does not match the requested workspace.",
      }),
    );
  }

  return Effect.void;
}

/**
 * Verifies that the current active organization slug matches an expected workspace slug.
 *
 * @param claims The current organization claims.
 * @param expectedOrgSlug The workspace slug requested by the caller, if any.
 * @returns Nothing when validation succeeds.
 * @remarks This compatibility wrapper throws a standard `Error` so current callers keep working unchanged.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function assertExpectedOrgSlug(
  claims: { orgSlug: string | null },
  expectedOrgSlug: string | null,
): void {
  Effect.runSync(
    assertExpectedOrgSlugEffect(claims, expectedOrgSlug).pipe(
      Effect.mapError(toThrownAuthError),
    ),
  );
}
