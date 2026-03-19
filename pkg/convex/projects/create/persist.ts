import { Effect } from "effect";

import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { dbInsertEffect } from "../../lib/convex/db";
import { DEFAULT_PROJECT_STAGES, type ProjectSummary } from "../types";
import { toProjectWriteError } from "./shared";

/**
 * Inserts the project row and default stages for a newly created workspace project.
 *
 * @param ctx The Convex mutation context.
 * @param input The normalized project identity and timestamps to persist.
 * @returns The created project summary.
 * @remarks This writes the `projects` table and seeds default `projectStages`.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function persistCreatedProjectEffect(
  ctx: MutationCtx,
  input: Omit<ProjectSummary, "id">,
): Effect.Effect<ProjectSummary, ReturnType<typeof toProjectWriteError>> {
  return Effect.gen(function* () {
    const id = yield* dbInsertEffect<Id<"projects">, ReturnType<typeof toProjectWriteError>>(
      ctx,
      "projects",
      {
        orgId: input.orgId,
        orgSlug: input.orgSlug,
        name: input.name,
        slug: input.slug,
        slugBase: input.slugBase,
        createdByClerkUserId: input.createdByClerkUserId,
        createdAtMs: input.createdAtMs,
        updatedAtMs: input.updatedAtMs,
      },
      (error) => toProjectWriteError("Failed to insert the project row.", error),
    );

    yield* Effect.forEach(
      DEFAULT_PROJECT_STAGES,
      (stage) =>
        dbInsertEffect<Id<"projectStages">, ReturnType<typeof toProjectWriteError>>(
          ctx,
          "projectStages",
          {
            projectId: id,
            orgId: input.orgId,
            slug: stage.slug,
            name: stage.name,
            isDefault: true,
            createdAtMs: input.createdAtMs,
            updatedAtMs: input.updatedAtMs,
          },
          (error) =>
            toProjectWriteError(
              `Failed to insert the default ${stage.slug} stage.`,
              error,
            ),
        ),
      { discard: true },
    );

    return {
      id,
      ...input,
    };
  });
}
