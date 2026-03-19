import { Effect } from "effect";
import type { Doc } from "../../_generated/dataModel";
import { ExternalServiceError, NotFoundError } from "../../lib/errors/effect";
import { findStageByProjectIdAndSlugEffect } from "../../lib/projects/scope";
import { runScheduleAccessPromise } from "./shared";

/**
 * Resolves a stage within a project by slug.
 *
 * @param convexCtx The Convex context carrying database access.
 * @param projectId The project identifier.
 * @param stageSlug The stage slug to resolve.
 * @returns An Effect that yields the matching stage row.
 * @remarks This is the Effect-native stage lookup helper for schedule programs.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function requireStageInProjectEffect(
  convexCtx: { db: any },
  projectId: Doc<"projects">["_id"],
  stageSlug: string,
): Effect.Effect<Doc<"projectStages">, ExternalServiceError | NotFoundError> {
  return Effect.gen(function* () {
    const stage = yield* findStageByProjectIdAndSlugEffect(convexCtx.db, {
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
 * @param convexCtx The Convex context carrying database access.
 * @param projectId The project identifier.
 * @param stageSlug The stage slug to resolve.
 * @returns The matching stage row.
 * @remarks This throws when the stage does not exist in the given project.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export async function requireStageInProject(
  convexCtx: { db: any },
  projectId: Doc<"projects">["_id"],
  stageSlug: string,
): Promise<Doc<"projectStages">> {
  return await runScheduleAccessPromise(
    requireStageInProjectEffect(convexCtx, projectId, stageSlug),
  );
}
