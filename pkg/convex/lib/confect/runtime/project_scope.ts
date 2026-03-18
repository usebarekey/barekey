import { Effect } from "effect";

import { ExternalServiceError, NotFoundError } from "../../errors/effect";
import {
  findProjectByOrgSlugAndSlugEffect,
  findProjectStageByOrgIdAndSlugEffect,
  findProjectStageByOrgSlugAndSlugEffect,
  findStageByProjectIdAndSlugEffect,
  requireProjectStageByOrgIdAndSlugEffect,
} from "../../projects/scope";
import type { ProjectScopeLookup, ProjectStageScope } from "../services";
import type { BarekeyRuntimeCtx } from "./context";
import { hasDatabaseReader } from "./context";

/**
 * Finds a project/stage pair using direct database access from the current runtime context.
 *
 * @param ctx The active Convex runtime context.
 * @param payload The organization/project/stage lookup input.
 * @returns An Effect that succeeds with the project/stage pair or `null`.
 * @remarks This currently requires query or mutation DB access and fails for action-only contexts.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function findProjectStageWithRuntimeCtx(
  ctx: BarekeyRuntimeCtx,
  payload: ProjectScopeLookup,
) {
  if (!hasDatabaseReader(ctx)) {
    return Effect.fail(
      new ExternalServiceError({
        message: "Project scope resolution requires database access.",
      }),
    );
  }

  if (payload.scope === "orgId") {
    return findProjectStageByOrgIdAndSlugEffect(ctx.db, {
      orgId: payload.orgId,
      projectSlug: payload.projectSlug,
      stageSlug: payload.stageSlug,
    });
  }

  return findProjectStageByOrgSlugAndSlugEffect(ctx.db, {
    orgSlug: payload.orgSlug,
    projectSlug: payload.projectSlug,
    stageSlug: payload.stageSlug,
  });
}

/**
 * Requires a project/stage pair using direct database access from the current runtime context.
 *
 * @param ctx The active Convex runtime context.
 * @param payload The organization/project/stage lookup input.
 * @returns An Effect that succeeds with the required project/stage pair.
 * @remarks This currently requires query or mutation DB access and fails for action-only contexts.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function requireProjectStageWithRuntimeCtx(
  ctx: BarekeyRuntimeCtx,
  payload: ProjectScopeLookup,
) {
  if (!hasDatabaseReader(ctx)) {
    return Effect.fail(
      new ExternalServiceError({
        message: "Project scope resolution requires database access.",
      }),
    );
  }

  if (payload.scope === "orgId") {
    return requireProjectStageByOrgIdAndSlugEffect(ctx.db, {
      orgId: payload.orgId,
      projectSlug: payload.projectSlug,
      stageSlug: payload.stageSlug,
    });
  }

  return Effect.gen(function* () {
    const project = yield* findProjectByOrgSlugAndSlugEffect(ctx.db, {
      orgSlug: payload.orgSlug,
      projectSlug: payload.projectSlug,
    });
    if (project === null) {
      return yield* Effect.fail(new NotFoundError({ message: "Project not found." }));
    }

    const stage = yield* findStageByProjectIdAndSlugEffect(ctx.db, {
      projectId: project._id,
      stageSlug: payload.stageSlug,
    });
    if (stage === null) {
      return yield* Effect.fail(new NotFoundError({ message: "Stage not found." }));
    }

    return { project, stage } satisfies ProjectStageScope;
  });
}
