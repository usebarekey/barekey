import { Effect } from "effect";
import { v } from "convex/values";

import { effectInternalQuery } from "../../confect";
import { dbCollectEffect, dbUniqueEffect } from "../../lib/convex/db";
import {
  mapVariableResolverRow,
  type VariableStorageRow,
  variableResolverRowValidator,
} from "../../lib/project_variables/rows";
import { validateVariableName } from "../../lib/project_variables/validation";
import { findProjectStageByOrgSlugAndSlug } from "../../lib/projects/scope";
import { type PublicVariableResolution, withProjectVariableQueryCtx } from "./shared";

/**
 * Resolves public variables by name or lists every public variable for a stage.
 *
 * @param runtimeCtx The Convex internal query context.
 * @param args The organization slug, project, stage, and optional names to resolve.
 * @returns The owning organization ID plus the resolved public variable rows, or `null` when the stage does not exist.
 * @remarks Anonymous public env evaluation depends on this boundary, so it never exposes private rows.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const resolvePublicVariableRowsForOrgProjectStageInternal = effectInternalQuery<
  {
    orgSlug: string;
    projectSlug: string;
    stageSlug: string;
    names?: Array<string>;
  },
  PublicVariableResolution,
  any
>({
  args: {
    orgSlug: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
    names: v.optional(v.array(v.string())),
  },
  returns: v.union(
    v.object({
      orgId: v.string(),
      rows: v.array(variableResolverRowValidator),
    }),
    v.null(),
  ),
  handler: (args) =>
    withProjectVariableQueryCtx(async (runtimeCtx, innerArgs) => {
      const db = runtimeCtx.db;
      const projectStage = await findProjectStageByOrgSlugAndSlug(db, {
        orgSlug: innerArgs.orgSlug,
        projectSlug: innerArgs.projectSlug,
        stageSlug: innerArgs.stageSlug,
      });
      if (projectStage === null) {
        return null;
      }

      const normalizedNames = innerArgs.names?.map((name) => validateVariableName(name));
      const rows =
        normalizedNames === undefined
          ? await Effect.runPromise(
              dbCollectEffect<VariableStorageRow, unknown>(
                runtimeCtx,
                "projectVariables",
                (query) =>
                  query.withIndex("by_project_id_and_stage_slug_and_visibility", (indexQuery) =>
                    indexQuery
                      .eq("projectId", projectStage.project._id)
                      .eq("stageSlug", projectStage.stage.slug)
                      .eq("visibility", "public"),
                  ),
                (error) => error,
              ),
            )
          : await Promise.all(
              normalizedNames.map(async (name) => {
                return await Effect.runPromise(
                  dbUniqueEffect<VariableStorageRow, unknown>(
                    runtimeCtx,
                    "projectVariables",
                    (query) =>
                      query.withIndex(
                        "by_project_id_and_stage_slug_and_visibility_and_name",
                        (indexQuery) =>
                          indexQuery
                            .eq("projectId", projectStage.project._id)
                            .eq("stageSlug", projectStage.stage.slug)
                            .eq("visibility", "public")
                            .eq("name", name),
                      ),
                    (error) => error,
                  ),
                );
              }),
            );

      const resolvedRows = rows
        .filter((row): row is NonNullable<(typeof rows)[number]> => row !== null)
        .map(mapVariableResolverRow);

      return {
        orgId: projectStage.project.orgId,
        rows:
          normalizedNames === undefined
            ? resolvedRows.sort((left, right) => left.name.localeCompare(right.name))
            : normalizedNames
                .map((name) => resolvedRows.find((row) => row.name === name) ?? null)
                .filter((row): row is (typeof resolvedRows)[number] => row !== null),
      };
    }, args),
});
