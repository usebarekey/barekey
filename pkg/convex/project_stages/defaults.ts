import { Effect, Schema } from "effect";

import type { MutationCtx } from "../_generated/server";
import { BarekeyConfectMutationCtx, schemaEffectMutation } from "../confect";
import {
  assertExpectedOrgSlugEffect,
  requireActiveOrgIdClaimsEffect,
  requireIdentityEffect,
} from "../lib/auth";
import { AuthError, ExternalServiceError, NotFoundError } from "../lib/errors/effect";
import { requireProjectBySlugForOrgEffect } from "./access";
import { toProjectStageExternalServiceError } from "./errors";
import { DEFAULT_STAGE_DEFINITIONS } from "./types";

const defaultStagesArgsSchema = Schema.Struct({
  expectedOrgSlug: Schema.String,
  projectSlug: Schema.String,
});

const defaultStagesResultSchema = Schema.Struct({
  createdCount: Schema.Number,
});

/**
 * Ensures the canonical default stages exist for a project as an Effect program.
 *
 * @param args The expected org slug and project slug.
 * @returns An Effect that succeeds with the number of default stages created.
 * @remarks This is idempotent and backfills missing default `projectStages` rows.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function ensureDefaultStagesForCurrentOrgProjectEffect(
  args: {
    expectedOrgSlug: string;
    projectSlug: string;
  },
): Effect.Effect<
  {
    createdCount: number;
  },
  AuthError | ExternalServiceError | NotFoundError,
  any
> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectMutationCtx;
    const runtimeCtx = confectCtx.ctx as unknown as MutationCtx;
    const identity = yield* requireIdentityEffect(runtimeCtx);
    const activeOrg = yield* requireActiveOrgIdClaimsEffect(identity);
    if (activeOrg.orgSlug !== null) {
      yield* assertExpectedOrgSlugEffect(activeOrg, args.expectedOrgSlug);
    }

    const project = yield* requireProjectBySlugForOrgEffect(runtimeCtx, {
      orgId: activeOrg.orgId,
      projectSlug: args.projectSlug,
    });

    const existingStages = yield* Effect.tryPromise({
      try: () =>
        runtimeCtx.db
          .query("projectStages")
          .withIndex("by_project_id", (q) => q.eq("projectId", project._id))
          .collect(),
      catch: (error) =>
        toProjectStageExternalServiceError("Failed to load existing project stages.", error),
    });
    const existingSlugs = new Set(existingStages.map((stage) => stage.slug));

    let createdCount = 0;
    for (const definition of DEFAULT_STAGE_DEFINITIONS) {
      if (existingSlugs.has(definition.slug)) {
        continue;
      }

      const now = Date.now();
      yield* Effect.tryPromise({
        try: () =>
          runtimeCtx.db.insert("projectStages", {
            projectId: project._id,
            orgId: activeOrg.orgId,
            slug: definition.slug,
            name: definition.name,
            isDefault: true,
            createdAtMs: now,
            updatedAtMs: now,
          }),
        catch: (error) =>
          toProjectStageExternalServiceError(
            `Failed to insert default stage ${definition.slug}.`,
            error,
          ),
      });
      createdCount += 1;
    }

    return {
      createdCount,
    };
  });
}

/**
 * Ensures the canonical default stages exist for a project.
 *
 * @param runtimeCtx The Convex mutation context.
 * @param args The expected org slug and project slug.
 * @returns The number of default stages created.
 * @remarks This is idempotent and backfills missing default `projectStages` rows.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const ensureDefaultStagesForCurrentOrgProject = schemaEffectMutation({
  args: defaultStagesArgsSchema,
  returns: defaultStagesResultSchema,
  handler: ensureDefaultStagesForCurrentOrgProjectEffect,
});
