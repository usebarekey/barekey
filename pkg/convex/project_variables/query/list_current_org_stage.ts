import { v } from "convex/values";

import { effectQuery } from "../../confect";
import { variableMetadataValidator } from "../../lib/project_variables/contracts";
import { mapVariableMetadataRow } from "../../lib/project_variables/rows";
import { listProjectVariableRowsForStage } from "../../lib/projects/scope";
import { getCurrentOrgAccessOrNull } from "../access";
import { findProjectStageByOrgIdAndSlug } from "../../lib/projects/scope";
import { type VariableMetadataRow, withProjectVariableQueryCtx } from "./shared";

/**
 * Lists variables for a single project stage.
 *
 * Values remain encrypted at rest and are never returned in plaintext from
 * this listing API; decryption is handled by an explicit per-row action.
 *
 * @param ctx The Convex query context.
 * @param args The workspace, project, and stage selector.
 * @returns Sorted variable metadata for the requested stage, or an empty list when inaccessible.
 * @remarks This returns no data when the caller is unauthenticated or scoped to a different workspace.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const listForCurrentOrgProjectStage = effectQuery<
  {
    expectedOrgSlug: string;
    projectSlug: string;
    stageSlug: string;
  },
  Array<VariableMetadataRow>,
  any
>({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
  },
  returns: v.array(variableMetadataValidator),
  handler: (args) =>
    withProjectVariableQueryCtx(async (ctx, innerArgs) => {
      const activeOrg = await getCurrentOrgAccessOrNull(ctx, innerArgs.expectedOrgSlug);
      if (activeOrg === null) {
        return [];
      }

      const projectStage = await findProjectStageByOrgIdAndSlug(ctx.db, {
        orgId: activeOrg.orgId,
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
