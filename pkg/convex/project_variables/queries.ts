import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { internalQuery, query } from "../confect";
import { getCurrentOrgAccessOrNull } from "./access";
import type { DeclaredVariableType } from "../lib/declared_types";
import {
  mapVariableMetadataRow,
  mapVariableResolverRow,
  type VariableStorageRow,
  validateVariableName,
  variableMetadataValidator,
  variableResolverRowValidator,
} from "../lib/project_variables_shared";
import {
  findProjectStageByOrgIdAndSlug,
  findProjectStageByOrgSlugAndSlug,
  listProjectVariableRowsForStage,
} from "../lib/project_scope";
import type { VariableVisibility } from "../lib/visibility";

type VariableResolverRow = ReturnType<typeof mapVariableResolverRow>;

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
export const listForCurrentOrgProjectStage = query({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
  },
  returns: v.array(variableMetadataValidator),
  handler: async (ctx, args) => {
    const activeOrg = await getCurrentOrgAccessOrNull(ctx, args.expectedOrgSlug);
    if (activeOrg === null) {
      return [];
    }

    const projectStage = await findProjectStageByOrgIdAndSlug(ctx.db, {
      orgId: activeOrg.orgId,
      projectSlug: args.projectSlug,
      stageSlug: args.stageSlug,
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
  },
});

/**
 * Resolves stage variables by name for internal HTTP and SDK evaluation flows.
 *
 * @param ctx The Convex internal query context.
 * @param args The organization, project, stage, and variable names to resolve.
 * @returns Resolved variable rows in the same name order requested by the caller.
 * @remarks Missing names are omitted from the result while preserving the order of those that exist.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const resolveVariableRowsForOrgProjectStageInternal = internalQuery({
  args: {
    orgId: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
    names: v.array(v.string()),
  },
  returns: v.array(variableResolverRowValidator),
  handler: async (ctx, args) => {
    const projectStage = await findProjectStageByOrgIdAndSlug(ctx.db, {
      orgId: args.orgId,
      projectSlug: args.projectSlug,
      stageSlug: args.stageSlug,
    });
    if (projectStage === null) {
      return [];
    }

    const normalizedNames = args.names.map((name) => validateVariableName(name));
    const rowsByName = new Map<string, VariableResolverRow>();
    for (const name of normalizedNames) {
      if (rowsByName.has(name)) {
        continue;
      }

      const row = await ctx.db
        .query("projectVariables")
        .withIndex("by_project_id_and_stage_slug_and_name", (q) =>
          q
            .eq("projectId", projectStage.project._id)
            .eq("stageSlug", projectStage.stage.slug)
            .eq("name", name),
        )
        .unique();
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
  },
});

/**
 * Resolves public variables by name or lists every public variable for a stage.
 *
 * @param ctx The Convex internal query context.
 * @param args The organization slug, project, stage, and optional names to resolve.
 * @returns The owning organization ID plus the resolved public variable rows, or `null` when the stage does not exist.
 * @remarks Anonymous public env evaluation depends on this boundary, so it never exposes private rows.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const resolvePublicVariableRowsForOrgProjectStageInternal = internalQuery({
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
  handler: async (ctx, args) => {
    const projectStage = await findProjectStageByOrgSlugAndSlug(ctx.db, {
      orgSlug: args.orgSlug,
      projectSlug: args.projectSlug,
      stageSlug: args.stageSlug,
    });
    if (projectStage === null) {
      return null;
    }

    const normalizedNames = args.names?.map((name) => validateVariableName(name));
    const rows =
      normalizedNames === undefined
        ? await ctx.db
            .query("projectVariables")
            .withIndex("by_project_id_and_stage_slug_and_visibility", (q) =>
              q
                .eq("projectId", projectStage.project._id)
                .eq("stageSlug", projectStage.stage.slug)
                .eq("visibility", "public"),
            )
            .collect()
        : await Promise.all(
            normalizedNames.map(async (name) => {
              return await ctx.db
                .query("projectVariables")
                .withIndex("by_project_id_and_stage_slug_and_visibility_and_name", (q) =>
                  q
                    .eq("projectId", projectStage.project._id)
                    .eq("stageSlug", projectStage.stage.slug)
                    .eq("visibility", "public")
                    .eq("name", name),
                )
                .unique();
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
  },
});

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
export const listVariableMetadataForOrgProjectStageInternal = internalQuery({
  args: {
    orgId: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
  },
  returns: v.array(variableMetadataValidator),
  handler: async (ctx, args) => {
    const projectStage = await findProjectStageByOrgIdAndSlug(ctx.db, {
      orgId: args.orgId,
      projectSlug: args.projectSlug,
      stageSlug: args.stageSlug,
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
  },
});
