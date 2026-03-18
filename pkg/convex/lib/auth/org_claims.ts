import type { UserIdentity } from "convex/server";
import { Effect } from "effect";

import { AuthError } from "../errors/effect";
import { toThrownAuthError, readStringClaim } from "./shared";
import type { ActiveOrgClaims, ActiveOrgIdClaims, OrgClaims } from "./types";

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
