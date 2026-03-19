import { Effect } from "effect";

import type { Doc, Id } from "../../../_generated/dataModel";
import type { DatabaseReader } from "../../../_generated/server";
import { ExternalServiceError } from "../../errors/effect";
import {
  toProjectScopeReadError,
  toThrownProjectScopeError,
} from "./errors";

/**
 * Finds a project by organization ID and project slug as an Effect program.
 *
 * @param db The Convex database reader.
 * @param args The organization/project lookup arguments.
 * @returns An Effect that succeeds with the project row or `null` when no match exists.
 * @remarks This is the Effect-native lookup entrypoint for org ID scoped project reads.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function findProjectByOrgIdAndSlugEffect(
  db: DatabaseReader,
  args: { orgId: string; projectSlug: string },
): Effect.Effect<Doc<"projects"> | null, ExternalServiceError> {
  return Effect.tryPromise({
    try: () =>
      db
        .query("projects")
        .withIndex("by_org_id_and_slug", (q) =>
          q.eq("orgId", args.orgId).eq("slug", args.projectSlug),
        )
        .unique(),
    catch: (error) => toProjectScopeReadError("project by organization ID and slug", error),
  });
}

/**
 * Finds a project by organization ID and project slug for existing promise-based callers.
 *
 * @param db The Convex database reader.
 * @param args The organization/project lookup arguments.
 * @returns A promise for the matching project row or `null`.
 * @remarks This compatibility wrapper rethrows typed project-scope errors as standard `Error` values.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function findProjectByOrgIdAndSlug(
  db: DatabaseReader,
  args: { orgId: string; projectSlug: string },
): Promise<Doc<"projects"> | null> {
  return await Effect.runPromise(
    findProjectByOrgIdAndSlugEffect(db, args).pipe(
      Effect.mapError(toThrownProjectScopeError),
    ),
  );
}

/**
 * Finds a project by organization slug and project slug as an Effect program.
 *
 * @param db The Convex database reader.
 * @param args The organization/project lookup arguments.
 * @returns An Effect that succeeds with the project row or `null` when no match exists.
 * @remarks This is the Effect-native lookup entrypoint for org slug scoped project reads.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function findProjectByOrgSlugAndSlugEffect(
  db: DatabaseReader,
  args: { orgSlug: string; projectSlug: string },
): Effect.Effect<Doc<"projects"> | null, ExternalServiceError> {
  return Effect.tryPromise({
    try: () =>
      db
        .query("projects")
        .withIndex("by_org_slug_and_slug", (q) =>
          q.eq("orgSlug", args.orgSlug).eq("slug", args.projectSlug),
        )
        .unique(),
    catch: (error) => toProjectScopeReadError("project by organization slug and slug", error),
  });
}

/**
 * Finds a project by organization slug and project slug for existing promise-based callers.
 *
 * @param db The Convex database reader.
 * @param args The organization/project lookup arguments.
 * @returns A promise for the matching project row or `null`.
 * @remarks This compatibility wrapper rethrows typed project-scope errors as standard `Error` values.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function findProjectByOrgSlugAndSlug(
  db: DatabaseReader,
  args: { orgSlug: string; projectSlug: string },
): Promise<Doc<"projects"> | null> {
  return await Effect.runPromise(
    findProjectByOrgSlugAndSlugEffect(db, args).pipe(
      Effect.mapError(toThrownProjectScopeError),
    ),
  );
}

/**
 * Finds a project stage by project ID and stage slug as an Effect program.
 *
 * @param db The Convex database reader.
 * @param args The project/stage lookup arguments.
 * @returns An Effect that succeeds with the stage row or `null` when no match exists.
 * @remarks This is the Effect-native lookup entrypoint for stage reads.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function findStageByProjectIdAndSlugEffect(
  db: DatabaseReader,
  args: { projectId: Id<"projects">; stageSlug: string },
): Effect.Effect<Doc<"projectStages"> | null, ExternalServiceError> {
  return Effect.tryPromise({
    try: () =>
      db
        .query("projectStages")
        .withIndex("by_project_id_and_slug", (q) =>
          q.eq("projectId", args.projectId).eq("slug", args.stageSlug),
        )
        .unique(),
    catch: (error) => toProjectScopeReadError("project stage by project ID and slug", error),
  });
}

/**
 * Finds a project stage by project ID and stage slug for existing promise-based callers.
 *
 * @param db The Convex database reader.
 * @param args The project/stage lookup arguments.
 * @returns A promise for the matching stage row or `null`.
 * @remarks This compatibility wrapper rethrows typed project-scope errors as standard `Error` values.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function findStageByProjectIdAndSlug(
  db: DatabaseReader,
  args: { projectId: Id<"projects">; stageSlug: string },
): Promise<Doc<"projectStages"> | null> {
  return await Effect.runPromise(
    findStageByProjectIdAndSlugEffect(db, args).pipe(
      Effect.mapError(toThrownProjectScopeError),
    ),
  );
}

/**
 * Lists all project variable rows for a stage as an Effect program.
 *
 * @param db The Convex database reader.
 * @param args The project/stage lookup arguments.
 * @returns An Effect that succeeds with the collected variable rows.
 * @remarks This is a read-only projection used by variable and scheduling workflows.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function listProjectVariableRowsForStageEffect(
  db: DatabaseReader,
  args: { projectId: Id<"projects">; stageSlug: string },
): Effect.Effect<Array<Doc<"projectVariables">>, ExternalServiceError> {
  return Effect.tryPromise({
    try: () =>
      db
        .query("projectVariables")
        .withIndex("by_project_id_and_stage_slug", (q) =>
          q.eq("projectId", args.projectId).eq("stageSlug", args.stageSlug),
        )
        .collect(),
    catch: (error) => toProjectScopeReadError("project variables for stage", error),
  });
}

/**
 * Lists all project variable rows for a stage for existing promise-based callers.
 *
 * @param db The Convex database reader.
 * @param args The project/stage lookup arguments.
 * @returns A promise for the collected variable rows.
 * @remarks This compatibility wrapper rethrows typed project-scope errors as standard `Error` values.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function listProjectVariableRowsForStage(
  db: DatabaseReader,
  args: { projectId: Id<"projects">; stageSlug: string },
) {
  return await Effect.runPromise(
    listProjectVariableRowsForStageEffect(db, args).pipe(
      Effect.mapError(toThrownProjectScopeError),
    ),
  );
}
