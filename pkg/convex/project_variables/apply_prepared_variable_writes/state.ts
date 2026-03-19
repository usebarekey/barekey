import { Effect } from "effect";

import type { MutationCtx } from "../../_generated/server";
import {
  listProjectVariableRowsForStageEffect,
  requireProjectStageByOrgIdAndSlugEffect,
} from "../../lib/projects/scope";

/**
 * Loads the current project, stage, and variable rows for one prepared write.
 *
 * @param runtimeCtx The Convex mutation context.
 * @param args The org, project, and stage selector.
 * @returns An Effect that succeeds with the loaded stage state.
 * @remarks Prepared writes measure and apply against the same state shape to reduce duplicated lookup code.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function loadPreparedWriteStageStateEffect(
  runtimeCtx: MutationCtx,
  args: { orgId: string; projectSlug: string; stageSlug: string },
) {
  return Effect.gen(function* () {
    const db = runtimeCtx.db;
    const { project, stage } = yield* requireProjectStageByOrgIdAndSlugEffect(db, {
      orgId: args.orgId,
      projectSlug: args.projectSlug,
      stageSlug: args.stageSlug,
    });
    const existingRows = yield* listProjectVariableRowsForStageEffect(db, {
      projectId: project._id,
      stageSlug: stage.slug,
    });

    return {
      project,
      stage,
      existingRows,
    };
  });
}
