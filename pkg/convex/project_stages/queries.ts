import { Effect } from "effect";
import { v } from "convex/values";

import type { QueryCtx } from "../_generated/server";
import { BarekeyConfectQueryCtx, effectQuery } from "../confect";
import { getActiveOrgIdClaimsOrNull } from "../lib/auth";
import { ExternalServiceError } from "../lib/errors/effect";
import {
  countVariablesForStageEffect,
  findProjectBySlugForOrgEffect,
} from "./access";
import { stageSummaryValidator } from "./types";

function toProjectStageQueryError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
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
    id: string;
    projectId: string;
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
    const ctx = confectCtx.ctx as unknown as QueryCtx;
    const identity = yield* Effect.tryPromise({
      try: () => ctx.auth.getUserIdentity(),
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

    const project = yield* findProjectBySlugForOrgEffect(ctx, {
      orgId: activeOrg.orgId,
      projectSlug: args.projectSlug,
    });
    if (project === null) {
      return [];
    }

    const stages = yield* Effect.tryPromise({
      try: () =>
        ctx.db
          .query("projectStages")
          .withIndex("by_project_id", (q) => q.eq("projectId", project._id))
          .collect(),
      catch: (error) =>
        toProjectStageQueryError("Failed to load project stages.", error),
    });

    return yield* Effect.forEach(stages, (stage) =>
      countVariablesForStageEffect(ctx, {
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
 * @param ctx The Convex query context.
 * @param args The expected org slug and project slug.
 * @returns The stage summaries for the project.
 * @remarks Missing or drifting org claims intentionally return an empty list during org-switch transitions.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const listForCurrentOrgProject = effectQuery({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
  },
  returns: v.array(stageSummaryValidator),
  handler: listForCurrentOrgProjectEffect,
});
