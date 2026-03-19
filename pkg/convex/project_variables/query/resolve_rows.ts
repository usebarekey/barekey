import { v } from "convex/values";
import { Effect } from "effect";

import { effectInternalQuery } from "../../confect";
import { dbUniqueEffect } from "../../lib/convex/db";
import {
  mapVariableResolverRow,
  type VariableStorageRow,
  variableResolverRowValidator,
} from "../../lib/project_variables/rows";
import { validateVariableName } from "../../lib/project_variables/validation";
import { findProjectStageByOrgIdAndSlug } from "../../lib/projects/scope";
import { type VariableResolverRow, withProjectVariableQueryCtx } from "./shared";

/**
 * Resolves stage variables by name for internal HTTP and SDK evaluation flows.
 *
 * @param runtimeCtx The Convex internal query context.
 * @param args The organization, project, stage, and variable names to resolve.
 * @returns Resolved variable rows in the same name order requested by the caller.
 * @remarks Missing names are omitted from the result while preserving the order of those that exist.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const resolveVariableRowsForOrgProjectStageInternal = effectInternalQuery<
  {
    orgId: string;
    projectSlug: string;
    stageSlug: string;
    names: Array<string>;
  },
  Array<VariableResolverRow>,
  any
>({
  args: {
    orgId: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
    names: v.array(v.string()),
  },
  returns: v.array(variableResolverRowValidator),
  handler: (args) =>
    withProjectVariableQueryCtx(async (runtimeCtx, innerArgs) => {
      const db = runtimeCtx.db;
      const projectStage = await findProjectStageByOrgIdAndSlug(db, {
        orgId: innerArgs.orgId,
        projectSlug: innerArgs.projectSlug,
        stageSlug: innerArgs.stageSlug,
      });
      if (projectStage === null) {
        return [];
      }

      const normalizedNames = innerArgs.names.map((name) => validateVariableName(name));
      const rowsByName = new Map<string, VariableResolverRow>();
      for (const name of normalizedNames) {
        if (rowsByName.has(name)) {
          continue;
        }

        const row = await Effect.runPromise(
          dbUniqueEffect<VariableStorageRow, unknown>(
            runtimeCtx,
            "projectVariables",
            (query) =>
              query.withIndex("by_project_id_and_stage_slug_and_name", (indexQuery) =>
                indexQuery
                  .eq("projectId", projectStage.project._id)
                  .eq("stageSlug", projectStage.stage.slug)
                  .eq("name", name),
              ),
            (error) => error,
          ),
        );
        if (row !== null) {
          rowsByName.set(name, mapVariableResolverRow(row));
        }
      }

      const ordered: Array<VariableResolverRow> = [];
      for (const name of normalizedNames) {
        const resolved = rowsByName.get(name);
        if (resolved !== undefined) {
          ordered.push(resolved);
        }
      }
      return ordered;
    }, args),
});
