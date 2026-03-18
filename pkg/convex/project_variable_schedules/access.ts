import { Effect } from "effect";
import type { UserIdentity } from "convex/server";

import type { Doc } from "../_generated/dataModel";
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
import { AuthError, ExternalServiceError, NotFoundError } from "../lib/errors/effect";
import {
  findProjectByOrgIdAndSlugEffect,
  findStageByProjectIdAndSlugEffect,
} from "../lib/projects/scope";

type AuthDbCtxLike = {
  auth: {
    getUserIdentity(): Promise<UserIdentity | null>;
  };
  db: any;
};

/**
 * Converts typed schedule access failures back into standard `Error` values for
 * legacy promise-based callers.
 *
 * @param error The typed schedule access error.
 * @returns A standard `Error` carrying the same message.
 * @remarks This compatibility helper should disappear once all schedule flows are Effect-native.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function toThrownScheduleAccessError(
  error: AuthError | ExternalServiceError | NotFoundError,
): Error {
  return new Error(error.message);
}

/**
 * Resolves the active organization and project for read-only flows that may
 * return an empty result instead of failing.
 *
 * @param ctx The Convex context carrying auth and database access.
 * @param expectedOrgSlug The active workspace slug expected by the caller.
 * @param projectSlug The project slug to resolve within the active organization.
 * @returns An Effect that yields the active org and project or `null`.
 * @remarks This is the Effect-native access path for schedule list reads.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function getCurrentOrgProjectAccessOrNullEffect(
  ctx: AuthDbCtxLike,
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
      try: () => ctx.auth.getUserIdentity(),
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

    const project = yield* findProjectByOrgIdAndSlugEffect(ctx.db, {
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
 * @param ctx The Convex context carrying auth and database access.
 * @param expectedOrgSlug The active workspace slug expected by the caller.
 * @param projectSlug The project slug to resolve within the active organization.
 * @returns The active org and project, or `null` when unavailable or mismatched.
 * @remarks This is used by the list flow so unauthorized callers fail closed with no schedule data.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function getCurrentOrgProjectAccessOrNull(
  ctx: AuthDbCtxLike,
  expectedOrgSlug: string,
  projectSlug: string,
): Promise<
  | {
      activeOrg: ActiveOrgIdClaims;
      project: Doc<"projects">;
    }
  | null
> {
  return await Effect.runPromise(
    getCurrentOrgProjectAccessOrNullEffect(ctx, expectedOrgSlug, projectSlug).pipe(
      Effect.mapError(toThrownScheduleAccessError),
    ),
  );
}

/**
 * Resolves and validates the active organization and project for a workspace
 * mutation or action.
 *
 * @param ctx The Convex context carrying auth and database access.
 * @param expectedOrgSlug The active workspace slug expected by the caller.
 * @param projectSlug The project slug to resolve within the active organization.
 * @returns An Effect that yields the validated active org and project.
 * @remarks This is the preferred schedule access helper for Effect-based mutations and actions.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function requireCurrentOrgProjectAccessEffect(
  ctx: AuthDbCtxLike,
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
    const identity = yield* requireIdentityEffect(ctx);
    const activeOrg = yield* requireActiveOrgIdClaimsEffect(identity);
    if (activeOrg.orgSlug !== null) {
      yield* assertExpectedOrgSlugEffect(activeOrg, expectedOrgSlug);
    }

    const project = yield* findProjectByOrgIdAndSlugEffect(ctx.db, {
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
 * @param ctx The Convex context carrying auth and database access.
 * @param expectedOrgSlug The active workspace slug expected by the caller.
 * @param projectSlug The project slug to resolve within the active organization.
 * @returns The validated active org and project.
 * @remarks This throws when auth, org, or project scope validation fails.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function requireCurrentOrgProjectAccess(
  ctx: AuthDbCtxLike,
  expectedOrgSlug: string,
  projectSlug: string,
): Promise<{
  activeOrg: ReturnType<typeof requireActiveOrgIdClaims>;
  project: Doc<"projects">;
}> {
  return await Effect.runPromise(
    requireCurrentOrgProjectAccessEffect(ctx, expectedOrgSlug, projectSlug).pipe(
      Effect.mapError(toThrownScheduleAccessError),
    ),
  );
}

/**
 * Resolves a stage within a project by slug.
 *
 * @param ctx The Convex context carrying database access.
 * @param projectId The project identifier.
 * @param stageSlug The stage slug to resolve.
 * @returns An Effect that yields the matching stage row.
 * @remarks This is the Effect-native stage lookup helper for schedule programs.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function requireStageInProjectEffect(
  ctx: Pick<AuthDbCtxLike, "db">,
  projectId: Doc<"projects">["_id"],
  stageSlug: string,
): Effect.Effect<Doc<"projectStages">, ExternalServiceError | NotFoundError> {
  return Effect.gen(function* () {
    const stage = yield* findStageByProjectIdAndSlugEffect(ctx.db, {
      projectId,
      stageSlug,
    });
    if (stage === null) {
      return yield* Effect.fail(new NotFoundError({ message: "Stage not found." }));
    }

    return stage;
  });
}

/**
 * Resolves a stage within a project by slug.
 *
 * @param ctx The Convex context carrying database access.
 * @param projectId The project identifier.
 * @param stageSlug The stage slug to resolve.
 * @returns The matching stage row.
 * @remarks This throws when the stage does not exist in the given project.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function requireStageInProject(
  ctx: Pick<AuthDbCtxLike, "db">,
  projectId: Doc<"projects">["_id"],
  stageSlug: string,
): Promise<Doc<"projectStages">> {
  return await Effect.runPromise(
    requireStageInProjectEffect(ctx, projectId, stageSlug).pipe(
      Effect.mapError(toThrownScheduleAccessError),
    ),
  );
}
