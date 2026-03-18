import { Effect } from "effect";
import { v } from "convex/values";

import type { MutationCtx } from "../_generated/server";
import { BarekeyConfectMutationCtx, effectMutation } from "../confect";
import {
  assertExpectedOrgSlugEffect,
  requireActiveOrgIdClaimsEffect,
  requireIdentityEffect,
} from "../lib/auth";
import { AuthError, ExternalServiceError, NotFoundError } from "../lib/errors/effect";
import { requireProjectBySlugForOrgEffect } from "./access";
import { toProjectStageExternalServiceError } from "./errors";
import { DEFAULT_STAGE_DEFINITIONS } from "./types";

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
    const ctx = confectCtx.ctx as unknown as MutationCtx;
    const identity = yield* requireIdentityEffect(ctx);
    const activeOrg = yield* requireActiveOrgIdClaimsEffect(identity);
    if (activeOrg.orgSlug !== null) {
      yield* assertExpectedOrgSlugEffect(activeOrg, args.expectedOrgSlug);
    }

    const project = yield* requireProjectBySlugForOrgEffect(ctx, {
      orgId: activeOrg.orgId,
      projectSlug: args.projectSlug,
    });

    const existingStages = yield* Effect.tryPromise({
      try: () =>
        ctx.db
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
          ctx.db.insert("projectStages", {
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
 * @param ctx The Convex mutation context.
 * @param args The expected org slug and project slug.
 * @returns The number of default stages created.
 * @remarks This is idempotent and backfills missing default `projectStages` rows.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const ensureDefaultStagesForCurrentOrgProject = effectMutation({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
  },
  returns: v.object({
    createdCount: v.number(),
  }),
  handler: ensureDefaultStagesForCurrentOrgProjectEffect,
});
