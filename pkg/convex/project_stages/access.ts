import { Effect } from "effect";

import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { ExternalServiceError, NotFoundError } from "../lib/errors/effect";

function toProjectStageAccessError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}

/**
 * Finds a project by slug within an organization.
 *
 * @param convexCtx The Convex query or mutation context.
 * @param args The organization id and project slug.
 * @returns The matching project row, or `null`.
 * @remarks This is the shared lookup used by project-stage queries and mutations.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function findProjectBySlugForOrg(
  convexCtx: QueryCtx | MutationCtx,
  args: {
    orgId: string;
    projectSlug: string;
  },
): Promise<Doc<"projects"> | null> {
  return await convexCtx.db
    .query("projects")
    .withIndex("by_org_id_and_slug", (q) => q.eq("orgId", args.orgId).eq("slug", args.projectSlug))
    .unique();
}

/**
 * Finds a project by slug within an organization as an Effect program.
 *
 * @param convexCtx The Convex query or mutation context.
 * @param args The organization id and project slug.
 * @returns An Effect that succeeds with the matching project row, or `null`.
 * @remarks This wraps Convex DB access in the shared external-service error model.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function findProjectBySlugForOrgEffect(
  convexCtx: QueryCtx | MutationCtx,
  args: {
    orgId: string;
    projectSlug: string;
  },
): Effect.Effect<Doc<"projects"> | null, ExternalServiceError> {
  return Effect.tryPromise({
    try: () => findProjectBySlugForOrg(convexCtx, args),
    catch: (error) =>
      toProjectStageAccessError("Failed to look up the requested project.", error),
  });
}

/**
 * Requires a project by slug within an organization as an Effect program.
 *
 * @param convexCtx The Convex query or mutation context.
 * @param args The organization id and project slug.
 * @returns An Effect that succeeds with the matching project row.
 * @remarks This fails with a typed not-found error instead of throwing.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function requireProjectBySlugForOrgEffect(
  convexCtx: QueryCtx | MutationCtx,
  args: {
    orgId: string;
    projectSlug: string;
  },
): Effect.Effect<Doc<"projects">, ExternalServiceError | NotFoundError> {
  return findProjectBySlugForOrgEffect(convexCtx, args).pipe(
    Effect.flatMap((project) =>
      project === null
        ? Effect.fail(new NotFoundError({ message: "Project not found." }))
        : Effect.succeed(project),
    ),
  );
}

/**
 * Counts variables for a project stage.
 *
 * @param convexCtx The Convex query or mutation context.
 * @param args The project id and stage slug.
 * @returns The number of variables assigned to the stage.
 * @remarks Stage list and stage mutation responses use the same count source of truth.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function countVariablesForStage(
  convexCtx: QueryCtx | MutationCtx,
  args: {
    projectId: Doc<"projects">["_id"];
    stageSlug: string;
  },
): Promise<number> {
  return (
    await convexCtx.db
      .query("projectVariables")
      .withIndex("by_project_id_and_stage_slug", (q) =>
        q.eq("projectId", args.projectId).eq("stageSlug", args.stageSlug),
      )
      .collect()
  ).length;
}

/**
 * Counts variables for a project stage as an Effect program.
 *
 * @param convexCtx The Convex query or mutation context.
 * @param args The project id and stage slug.
 * @returns An Effect that succeeds with the number of variables assigned to the stage.
 * @remarks This wraps the shared variable-count lookup in the external-service error model.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function countVariablesForStageEffect(
  convexCtx: QueryCtx | MutationCtx,
  args: {
    projectId: Doc<"projects">["_id"];
    stageSlug: string;
  },
): Effect.Effect<number, ExternalServiceError> {
  return Effect.tryPromise({
    try: () => countVariablesForStage(convexCtx, args),
    catch: (error) =>
      toProjectStageAccessError("Failed to count variables for the stage.", error),
  });
}
