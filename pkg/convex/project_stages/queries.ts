import { Either, Effect, Schema } from "effect";

import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { BarekeyConfectQueryCtx, schemaEffectQuery } from "../confect";
import { getActiveOrgIdClaimsOrNull } from "../lib/auth";
import { ExternalServiceError } from "../lib/errors/effect";
import {
  countVariablesForStageEffect,
  findProjectBySlugForOrgEffect,
} from "./access";
import { stageSummarySchema } from "./types";

const listStagesArgsSchema = Schema.Struct({
  expectedOrgSlug: Schema.String,
  projectSlug: Schema.String,
});

function toProjectStageQueryError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  const decodedError = Schema.decodeUnknownEither(Schema.instanceOf(Error))(error);
  return new ExternalServiceError({
    message: Either.isRight(decodedError) ? decodedError.right.message : fallbackMessage,
    cause: error,
  });
}

function listForCurrentOrgProjectEffect(
  args: {
    expectedOrgSlug: string;
    projectSlug: string;
  },
): Effect.Effect<
  Array<{
    id: Id<"projectStages">;
    projectId: Id<"projects">;
    orgId: string;
    slug: string;
    name: string;
    isDefault: boolean;
    variableCount: number;
    createdAtMs: number;
    updatedAtMs: number;
  }>,
  ExternalServiceError,
  any
> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectQueryCtx;
    const runtimeCtx = confectCtx.ctx as unknown as QueryCtx;
    const identity = yield* Effect.tryPromise({
      try: () => runtimeCtx.auth.getUserIdentity(),
      catch: (error) =>
        toProjectStageQueryError("Failed to resolve user identity for stage listing.", error),
    });
    if (identity === null) {
      return [];
    }

    const activeOrg = getActiveOrgIdClaimsOrNull(identity);
    if (activeOrg === null) {
      return [];
    }

    if (activeOrg.orgSlug !== null && activeOrg.orgSlug !== args.expectedOrgSlug) {
      return [];
    }

    const project = yield* findProjectBySlugForOrgEffect(runtimeCtx, {
      orgId: activeOrg.orgId,
      projectSlug: args.projectSlug,
    });
    if (project === null) {
      return [];
    }

    const stages = yield* Effect.tryPromise({
      try: () =>
        runtimeCtx.db
          .query("projectStages")
          .withIndex("by_project_id", (q) => q.eq("projectId", project._id))
          .collect(),
      catch: (error) =>
        toProjectStageQueryError("Failed to load project stages.", error),
    });

    return yield* Effect.forEach(stages, (stage) =>
      countVariablesForStageEffect(runtimeCtx, {
        projectId: project._id,
        stageSlug: stage.slug,
      }).pipe(
        Effect.map((variableCount) => ({
          id: stage._id,
          projectId: stage.projectId,
          orgId: stage.orgId,
          slug: stage.slug,
          name: stage.name,
          isDefault: stage.isDefault,
          variableCount,
          createdAtMs: stage.createdAtMs,
          updatedAtMs: stage.updatedAtMs,
        })),
      ),
    );
  });
}

/**
 * Lists stages for a project, including per-stage variable counts.
 *
 * @param runtimeCtx The Convex query context.
 * @param args The expected org slug and project slug.
 * @returns The stage summaries for the project.
 * @remarks Missing or drifting org claims intentionally return an empty list during org-switch transitions.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const listForCurrentOrgProject = schemaEffectQuery({
  args: listStagesArgsSchema,
  returns: Schema.Array(stageSummarySchema),
  handler: listForCurrentOrgProjectEffect,
});
