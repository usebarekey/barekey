import { Effect } from "effect";
import type { Doc } from "../../_generated/dataModel";
import type { ActiveOrgIdClaims } from "../../lib/auth";
import {
  assertExpectedOrgSlugEffect,
  getActiveOrgIdClaimsOrNull,
  requireActiveOrgIdClaimsEffect,
  requireIdentityEffect,
} from "../../lib/auth";
import { AuthError, ExternalServiceError, NotFoundError } from "../../lib/errors/effect";
import { findProjectByOrgIdAndSlugEffect } from "../../lib/projects/scope";
import { AuthDbCtxLike, runScheduleAccessPromise } from "./shared";

/**
 * Resolves the active organization and project for read-only flows that may
 * return an empty result instead of failing.
 *
 * @param convexCtx The Convex context carrying auth and database access.
 * @param expectedOrgSlug The active workspace slug expected by the caller.
 * @param projectSlug The project slug to resolve within the active organization.
 * @returns An Effect that yields the active org and project or `null`.
 * @remarks This is the Effect-native access path for schedule list reads.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function getCurrentOrgProjectAccessOrNullEffect(
  convexCtx: AuthDbCtxLike,
  expectedOrgSlug: string,
  projectSlug: string,
): Effect.Effect<
  | {
      activeOrg: ActiveOrgIdClaims;
      project: Doc<"projects">;
    }
  | null,
  ExternalServiceError
> {
  return Effect.gen(function* () {
    const identity = yield* Effect.tryPromise({
      try: () => convexCtx.auth.getUserIdentity(),
      catch: (error) =>
        new ExternalServiceError({
          message:
            error instanceof Error
              ? error.message
              : "Failed to resolve user identity for schedule access.",
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

    const project = yield* findProjectByOrgIdAndSlugEffect(convexCtx.db, {
      orgId: activeOrg.orgId,
      projectSlug,
    });
    if (project === null) {
      return null;
    }

    return { activeOrg, project };
  });
}

/**
 * Resolves the active organization and project for read-only flows that may
 * return an empty result instead of throwing.
 *
 * @param convexCtx The Convex context carrying auth and database access.
 * @param expectedOrgSlug The active workspace slug expected by the caller.
 * @param projectSlug The project slug to resolve within the active organization.
 * @returns The active org and project, or `null` when unavailable or mismatched.
 * @remarks This is used by the list flow so unauthorized callers fail closed with no schedule data.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export async function getCurrentOrgProjectAccessOrNull(
  convexCtx: AuthDbCtxLike,
  expectedOrgSlug: string,
  projectSlug: string,
): Promise<
  | {
      activeOrg: ActiveOrgIdClaims;
      project: Doc<"projects">;
    }
  | null
> {
  return await Effect.runPromise(getCurrentOrgProjectAccessOrNullEffect(convexCtx, expectedOrgSlug, projectSlug));
}

/**
 * Resolves and validates the active organization and project for a workspace
 * mutation or action.
 *
 * @param convexCtx The Convex context carrying auth and database access.
 * @param expectedOrgSlug The active workspace slug expected by the caller.
 * @param projectSlug The project slug to resolve within the active organization.
 * @returns An Effect that yields the validated active org and project.
 * @remarks This is the preferred schedule access helper for Effect-based mutations and actions.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function requireCurrentOrgProjectAccessEffect(
  convexCtx: AuthDbCtxLike,
  expectedOrgSlug: string,
  projectSlug: string,
): Effect.Effect<
  {
    activeOrg: ActiveOrgIdClaims;
    project: Doc<"projects">;
  },
  AuthError | ExternalServiceError | NotFoundError
> {
  return Effect.gen(function* () {
    const identity = yield* requireIdentityEffect(convexCtx);
    const activeOrg = yield* requireActiveOrgIdClaimsEffect(identity);
    if (activeOrg.orgSlug !== null) {
      yield* assertExpectedOrgSlugEffect(activeOrg, expectedOrgSlug);
    }

    const project = yield* findProjectByOrgIdAndSlugEffect(convexCtx.db, {
      orgId: activeOrg.orgId,
      projectSlug,
    });
    if (project === null) {
      return yield* Effect.fail(new NotFoundError({ message: "Project not found." }));
    }

    return { activeOrg, project };
  });
}

/**
 * Resolves and validates the active organization and project for a workspace
 * mutation or action.
 *
 * @param convexCtx The Convex context carrying auth and database access.
 * @param expectedOrgSlug The active workspace slug expected by the caller.
 * @param projectSlug The project slug to resolve within the active organization.
 * @returns The validated active org and project.
 * @remarks This throws when auth, org, or project scope validation fails.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export async function requireCurrentOrgProjectAccess(
  convexCtx: AuthDbCtxLike,
  expectedOrgSlug: string,
  projectSlug: string,
): Promise<{
  activeOrg: ActiveOrgIdClaims;
  project: Doc<"projects">;
}> {
  return await runScheduleAccessPromise(
    requireCurrentOrgProjectAccessEffect(convexCtx, expectedOrgSlug, projectSlug),
  );
}
