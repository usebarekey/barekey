import { Effect } from "effect";
import type { UserIdentity } from "convex/server";

import type { ActiveOrgIdClaims } from "../lib/auth";
import {
  assertExpectedOrgSlug,
  assertExpectedOrgSlugEffect,
  getActiveOrgIdClaimsOrNull,
  requireActiveOrgIdClaims,
  requireActiveOrgIdClaimsEffect,
  requireIdentity,
  requireIdentityEffect,
} from "../lib/auth";
import { AuthError, ExternalServiceError } from "../lib/errors/effect";

type AuthCtxLike = {
  auth: {
    getUserIdentity(): Promise<UserIdentity | null>;
  };
};

/**
 * Converts typed project-variable access failures back into standard `Error`
 * values for legacy promise-based callers.
 *
 * @param error The typed access error.
 * @returns A standard `Error` carrying the same message.
 * @remarks This compatibility shim should disappear as variable flows move fully to Effect.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function toThrownProjectVariableAccessError(
  error: AuthError | ExternalServiceError,
): Error {
  return new Error(error.message);
}

/**
 * Resolves the current active organization when a request may proceed
 * anonymously or without an active org context.
 *
 * @param ctx The Convex context carrying the auth resolver.
 * @param expectedOrgSlug The workspace slug expected by the caller.
 * @returns An Effect that yields the active organization claims or `null`.
 * @remarks This is the Effect-native optional workspace access helper for variable reads.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function getCurrentOrgAccessOrNullEffect(
  ctx: AuthCtxLike,
  expectedOrgSlug: string,
): Effect.Effect<ActiveOrgIdClaims | null, ExternalServiceError> {
  return Effect.gen(function* () {
    const identity = yield* Effect.tryPromise({
      try: () => ctx.auth.getUserIdentity(),
      catch: (error) =>
        new ExternalServiceError({
          message:
            error instanceof Error
              ? error.message
              : "Failed to resolve workspace access identity.",
          cause: error,
        }),
    });
    if (identity === null) {
      return null;
    }

    const activeOrg = getActiveOrgIdClaimsOrNull(identity);
    if (activeOrg === null) {
      return null;
    }

    if (activeOrg.orgSlug !== null && activeOrg.orgSlug !== expectedOrgSlug) {
      return null;
    }

    return activeOrg;
  });
}

/**
 * Resolves the current active organization when a request may proceed
 * anonymously or without an active org context.
 *
 * @param ctx The Convex context carrying the auth resolver.
 * @param expectedOrgSlug The workspace slug expected by the caller.
 * @returns The active organization claims or `null` when no matching org context is active.
 * @remarks This is used by read-only flows that should fail closed by returning no data.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function getCurrentOrgAccessOrNull(
  ctx: AuthCtxLike,
  expectedOrgSlug: string,
): Promise<ActiveOrgIdClaims | null> {
  return await Effect.runPromise(
    getCurrentOrgAccessOrNullEffect(ctx, expectedOrgSlug).pipe(
      Effect.mapError(toThrownProjectVariableAccessError),
    ),
  );
}

/**
 * Resolves and validates the current active organization for a workspace-scoped
 * mutation or action.
 *
 * @param ctx The Convex context carrying the auth resolver.
 * @param expectedOrgSlug The workspace slug expected by the caller.
 * @returns An Effect that yields the validated active organization claims.
 * @remarks This is the preferred variable access helper for Effect-based mutations and actions.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function requireCurrentOrgAccessEffect(
  ctx: AuthCtxLike,
  expectedOrgSlug: string,
): Effect.Effect<ActiveOrgIdClaims, AuthError> {
  return Effect.gen(function* () {
    const identity = yield* requireIdentityEffect(ctx);
    const activeOrg = yield* requireActiveOrgIdClaimsEffect(identity);
    if (activeOrg.orgSlug !== null) {
      yield* assertExpectedOrgSlugEffect(activeOrg, expectedOrgSlug);
    }
    return activeOrg;
  });
}

/**
 * Resolves and validates the current active organization for a workspace-scoped
 * mutation or action.
 *
 * @param ctx The Convex context carrying the auth resolver.
 * @param expectedOrgSlug The workspace slug expected by the caller.
 * @returns The validated active organization claims.
 * @remarks This throws when the caller is unauthenticated or points at a different active workspace.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function requireCurrentOrgAccess(
  ctx: AuthCtxLike,
  expectedOrgSlug: string,
): Promise<ActiveOrgIdClaims> {
  return await Effect.runPromise(
    requireCurrentOrgAccessEffect(ctx, expectedOrgSlug).pipe(
      Effect.mapError(toThrownProjectVariableAccessError),
    ),
  );
}
