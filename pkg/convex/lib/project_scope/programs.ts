import { Effect } from "effect";

import type { Doc } from "../../_generated/dataModel";
import type { DatabaseReader } from "../../_generated/server";
import { ExternalServiceError, NotFoundError } from "../effect_errors";
import { toThrownProjectScopeError } from "./errors";
import {
  findProjectByOrgIdAndSlugEffect,
  findProjectByOrgSlugAndSlugEffect,
  findStageByProjectIdAndSlugEffect,
} from "./readers";

/**
 * Finds a project/stage pair by organization ID and slugs as an Effect program.
 *
 * @param db The Convex database reader.
 * @param args The organization/project/stage lookup arguments.
 * @returns An Effect that succeeds with the project/stage pair or `null` when either row is missing.
 * @remarks This composes the smaller project and stage lookup programs without mutating state.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function findProjectStageByOrgIdAndSlugEffect(
  db: DatabaseReader,
  args: { orgId: string; projectSlug: string; stageSlug: string },
): Effect.Effect<
  { project: Doc<"projects">; stage: Doc<"projectStages"> } | null,
  ExternalServiceError
> {
  return Effect.gen(function* () {
    const project = yield* findProjectByOrgIdAndSlugEffect(db, {
      orgId: args.orgId,
      projectSlug: args.projectSlug,
    });
    if (project === null) {
      return null;
    }

    const stage = yield* findStageByProjectIdAndSlugEffect(db, {
      projectId: project._id,
      stageSlug: args.stageSlug,
    });
    if (stage === null) {
      return null;
    }

    return { project, stage };
  });
}

/**
 * Finds a project/stage pair by organization ID and slugs for existing promise-based callers.
 *
 * @param db The Convex database reader.
 * @param args The organization/project/stage lookup arguments.
 * @returns A promise for the project/stage pair or `null`.
 * @remarks This compatibility wrapper rethrows typed project-scope errors as standard `Error` values.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function findProjectStageByOrgIdAndSlug(
  db: DatabaseReader,
  args: { orgId: string; projectSlug: string; stageSlug: string },
): Promise<{ project: Doc<"projects">; stage: Doc<"projectStages"> } | null> {
  return await Effect.runPromise(
    findProjectStageByOrgIdAndSlugEffect(db, args).pipe(
      Effect.mapError(toThrownProjectScopeError),
    ),
  );
}

/**
 * Finds a project/stage pair by organization slug and slugs as an Effect program.
 *
 * @param db The Convex database reader.
 * @param args The organization/project/stage lookup arguments.
 * @returns An Effect that succeeds with the project/stage pair or `null` when either row is missing.
 * @remarks This composes the smaller project and stage lookup programs without mutating state.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function findProjectStageByOrgSlugAndSlugEffect(
  db: DatabaseReader,
  args: { orgSlug: string; projectSlug: string; stageSlug: string },
): Effect.Effect<
  { project: Doc<"projects">; stage: Doc<"projectStages"> } | null,
  ExternalServiceError
> {
  return Effect.gen(function* () {
    const project = yield* findProjectByOrgSlugAndSlugEffect(db, {
      orgSlug: args.orgSlug,
      projectSlug: args.projectSlug,
    });
    if (project === null) {
      return null;
    }

    const stage = yield* findStageByProjectIdAndSlugEffect(db, {
      projectId: project._id,
      stageSlug: args.stageSlug,
    });
    if (stage === null) {
      return null;
    }

    return { project, stage };
  });
}

/**
 * Finds a project/stage pair by organization slug and slugs for existing promise-based callers.
 *
 * @param db The Convex database reader.
 * @param args The organization/project/stage lookup arguments.
 * @returns A promise for the project/stage pair or `null`.
 * @remarks This compatibility wrapper rethrows typed project-scope errors as standard `Error` values.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function findProjectStageByOrgSlugAndSlug(
  db: DatabaseReader,
  args: { orgSlug: string; projectSlug: string; stageSlug: string },
): Promise<{ project: Doc<"projects">; stage: Doc<"projectStages"> } | null> {
  return await Effect.runPromise(
    findProjectStageByOrgSlugAndSlugEffect(db, args).pipe(
      Effect.mapError(toThrownProjectScopeError),
    ),
  );
}

/**
 * Requires a project/stage pair by organization ID and slugs as an Effect program.
 *
 * @param db The Convex database reader.
 * @param args The organization/project/stage lookup arguments.
 * @returns An Effect that succeeds with the required project/stage pair.
 * @remarks This fails with `NotFoundError` when the project or stage is missing.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function requireProjectStageByOrgIdAndSlugEffect(
  db: DatabaseReader,
  args: { orgId: string; projectSlug: string; stageSlug: string },
): Effect.Effect<
  { project: Doc<"projects">; stage: Doc<"projectStages"> },
  ExternalServiceError | NotFoundError
> {
  return Effect.gen(function* () {
    const project = yield* findProjectByOrgIdAndSlugEffect(db, {
      orgId: args.orgId,
      projectSlug: args.projectSlug,
    });
    if (project === null) {
      return yield* Effect.fail(new NotFoundError({ message: "Project not found." }));
    }

    const stage = yield* findStageByProjectIdAndSlugEffect(db, {
      projectId: project._id,
      stageSlug: args.stageSlug,
    });
    if (stage === null) {
      return yield* Effect.fail(new NotFoundError({ message: "Stage not found." }));
    }

    return { project, stage };
  });
}

/**
 * Requires a project/stage pair by organization ID and slugs for existing promise-based callers.
 *
 * @param db The Convex database reader.
 * @param args The organization/project/stage lookup arguments.
 * @returns A promise for the required project/stage pair.
 * @remarks This compatibility wrapper rethrows typed project-scope errors as standard `Error` values.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function requireProjectStageByOrgIdAndSlug(
  db: DatabaseReader,
  args: { orgId: string; projectSlug: string; stageSlug: string },
): Promise<{ project: Doc<"projects">; stage: Doc<"projectStages"> }> {
  return await Effect.runPromise(
    requireProjectStageByOrgIdAndSlugEffect(db, args).pipe(
      Effect.mapError(toThrownProjectScopeError),
    ),
  );
}
