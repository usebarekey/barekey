import { Effect } from "effect";

import type { MutationCtx } from "../_generated/server";
import { ExternalServiceError } from "../lib/errors/effect";
import { listProjectVariableRowsForStageEffect } from "../lib/projects/scope";
import { findProjectStageByOrgIdAndSlugEffect } from "../lib/projects/scope";
import { buildTypegenVariableEffect } from "./variable";
import type { TypegenArgs, TypegenManifest } from "./shared";

/**
 * Builds the typegen manifest for one project stage.
 *
 * @param runtimeCtx The Convex mutation context.
 * @param args The organization, project, and stage selector.
 * @param generatedAtMs The manifest generation timestamp to stamp into the result.
 * @returns An Effect that succeeds with the stage manifest, or `null` when the project or stage is missing.
 * @remarks JSON variables infer exact plaintext shapes from the currently stored normalized decrypted values.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function buildManifestForOrgProjectStageInternalEffect(
  runtimeCtx: MutationCtx,
  args: TypegenArgs,
  generatedAtMs: number,
): Effect.Effect<TypegenManifest, ExternalServiceError> {
  return Effect.gen(function* () {
    const db = runtimeCtx.db;
    const projectStage = yield* findProjectStageByOrgIdAndSlugEffect(db, args);
    if (projectStage === null) {
      return null;
    }

    const { project, stage } = projectStage;
    const rows = yield* listProjectVariableRowsForStageEffect(db, {
      projectId: project._id,
      stageSlug: stage.slug,
    });
    const variables = yield* Effect.forEach(rows, (row) => buildTypegenVariableEffect(runtimeCtx, project, row));

    return {
      orgId: project.orgId,
      orgSlug: project.orgSlug,
      projectSlug: project.slug,
      stageSlug: stage.slug,
      generatedAtMs,
      variables: variables.sort((left, right) => left.name.localeCompare(right.name)),
    };
  });
}
