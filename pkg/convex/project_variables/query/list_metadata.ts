import { v } from "convex/values";

import { effectInternalQuery } from "../../confect";
import { variableMetadataValidator } from "../../lib/project_variables/contracts";
import { mapVariableMetadataRow } from "../../lib/project_variables/rows";
import { findProjectStageByOrgIdAndSlug, listProjectVariableRowsForStage } from "../../lib/projects/scope";
import { type VariableMetadataRow, withProjectVariableQueryCtx } from "./shared";

/**
 * Lists raw variable metadata for HTTP and CLI flows in a fixed stage order.
 *
 * @param ctx The Convex internal query context.
 * @param args The organization, project, and stage selector.
 * @returns Sorted variable metadata for the requested stage.
 * @remarks This internal boundary is the canonical source for stage variable metadata outside the UI.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const listVariableMetadataForOrgProjectStageInternal = effectInternalQuery<
  {
    orgId: string;
    projectSlug: string;
    stageSlug: string;
  },
  Array<VariableMetadataRow>,
  any
>({
  args: {
    orgId: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
  },
  returns: v.array(variableMetadataValidator),
  handler: (args) =>
    withProjectVariableQueryCtx(async (ctx, innerArgs) => {
      const projectStage = await findProjectStageByOrgIdAndSlug(ctx.db, {
        orgId: innerArgs.orgId,
        projectSlug: innerArgs.projectSlug,
        stageSlug: innerArgs.stageSlug,
      });
      if (projectStage === null) {
        return [];
      }

      const rows = await listProjectVariableRowsForStage(ctx.db, {
        projectId: projectStage.project._id,
        stageSlug: projectStage.stage.slug,
      });

      return rows
        .map(mapVariableMetadataRow)
        .sort((left, right) => left.name.localeCompare(right.name));
    }, args),
});
