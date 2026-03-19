import { Effect } from "effect";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { dbCollectEffect, dbGetEffect, dbInsertEffect, dbUniqueEffect } from "../lib/convex/db";
import { defaultStages, toBootstrapExternalServiceError } from "./shared";

/**
 * Loads an existing config project by org slug and project slug.
 *
 * @param ctx The Convex mutation context.
 * @param input The workspace and project slug to resolve.
 * @returns The existing project row, or `null`.
 * @remarks This isolates the bootstrap project lookup from the orchestration layer.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function findBootstrapProjectEffect(
  ctx: MutationCtx,
  input: {
    orgSlug: string;
    projectSlug: string;
  },
) {
  return dbUniqueEffect<Doc<"projects">, ReturnType<typeof toBootstrapExternalServiceError>>(
    ctx,
    "projects",
    (query) =>
      query.withIndex("by_org_slug_and_slug", (indexQuery) =>
        indexQuery.eq("orgSlug", input.orgSlug).eq("slug", input.projectSlug),
      ),
    (error) => toBootstrapExternalServiceError("Failed to look up the config project.", error),
  );
}

/**
 * Inserts a new config project row.
 *
 * @param ctx The Convex mutation context.
 * @param input The project row fields to insert.
 * @returns The inserted project id.
 * @remarks This writes the config project when it does not already exist.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function insertBootstrapProjectEffect(
  ctx: MutationCtx,
  input: {
    orgId: string;
    orgSlug: string;
    clerkUserId: string;
    projectSlug: string;
    projectName: string;
    now: number;
  },
) {
  return dbInsertEffect<Id<"projects">, ReturnType<typeof toBootstrapExternalServiceError>>(
    ctx,
    "projects",
    {
      orgId: input.orgId,
      orgSlug: input.orgSlug,
      name: input.projectName,
      slug: input.projectSlug,
      slugBase: input.projectSlug,
      createdByClerkUserId: input.clerkUserId,
      createdAtMs: input.now,
      updatedAtMs: input.now,
    },
    (error) => toBootstrapExternalServiceError("Failed to create the config project.", error),
  );
}

/**
 * Reloads one config project row by id.
 *
 * @param ctx The Convex mutation context.
 * @param projectId The project id to load.
 * @returns The project row, or `null`.
 * @remarks This is used after insertion to confirm bootstrap persistence succeeded.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function getBootstrapProjectEffect(ctx: MutationCtx, projectId: string) {
  return dbGetEffect<Doc<"projects">, ReturnType<typeof toBootstrapExternalServiceError>>(
    ctx,
    projectId,
    (error) => toBootstrapExternalServiceError("Failed to reload the config project.", error),
  );
}

/**
 * Loads all stages for a config project.
 *
 * @param ctx The Convex mutation context.
 * @param projectId The owning project id.
 * @returns The existing project stage rows.
 * @remarks This powers default-stage backfill during config project bootstrap.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function listBootstrapProjectStagesEffect(ctx: MutationCtx, projectId: string) {
  return dbCollectEffect<
    Doc<"projectStages">,
    ReturnType<typeof toBootstrapExternalServiceError>
  >(
    ctx,
    "projectStages",
    (query) =>
      query.withIndex("by_project_id", (indexQuery) =>
        indexQuery.eq("projectId", projectId as never),
      ),
    (error) => toBootstrapExternalServiceError("Failed to load config project stages.", error),
  );
}

/**
 * Ensures the canonical default stages exist for a config project.
 *
 * @param ctx The Convex mutation context.
 * @param input The project/org scope and current timestamp.
 * @returns An Effect that completes after any missing default stages are inserted.
 * @remarks This backfills missing default stages without touching existing ones.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function ensureBootstrapProjectStagesEffect(
  ctx: MutationCtx,
  input: {
    projectId: string;
    orgId: string;
    now: number;
  },
) {
  return Effect.gen(function* () {
    const stages = yield* listBootstrapProjectStagesEffect(ctx, input.projectId);
    const existingStageSlugs = new Set(stages.map((stage) => stage.slug));

    for (const stage of defaultStages) {
      if (existingStageSlugs.has(stage.slug)) {
        continue;
      }

      yield* dbInsertEffect<Id<"projectStages">, ReturnType<typeof toBootstrapExternalServiceError>>(
        ctx,
        "projectStages",
        {
          projectId: input.projectId as never,
          orgId: input.orgId,
          slug: stage.slug,
          name: stage.name,
          isDefault: stage.slug === "development",
          createdAtMs: input.now,
          updatedAtMs: input.now,
        },
        (error) =>
          toBootstrapExternalServiceError(
            `Failed to create config project stage ${stage.slug}.`,
            error,
          ),
      );
    }
  });
}
