import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import {
  fallbackDeclaredType,
  inferTypeScriptTypeFromNormalizedJson,
  type DeclaredVariableType,
  validateAndNormalizeDeclaredValue,
} from "./lib/declared_types";
import { decryptSecretValueForProject } from "./lib/encryption";

const typegenVariableValidator = v.object({
  name: v.string(),
  kind: v.union(v.literal("secret"), v.literal("ab_roll"), v.literal("rollout")),
  declaredType: v.union(
    v.literal("string"),
    v.literal("boolean"),
    v.literal("int64"),
    v.literal("float"),
    v.literal("date"),
    v.literal("json"),
  ),
  required: v.boolean(),
  updatedAtMs: v.number(),
  typeScriptType: v.string(),
});

function getDeclaredType(row: { declaredType?: string | null }): DeclaredVariableType {
  return fallbackDeclaredType(row.declaredType);
}

function collapseTypeNames(typeNames: Array<string>): string {
  const unique = Array.from(new Set(typeNames)).sort((left, right) => left.localeCompare(right));
  if (unique.length === 0) {
    return "unknown";
  }
  if (unique.length === 1) {
    return unique[0] ?? "unknown";
  }
  return unique.join(" | ");
}

/**
 * Builds the typegen manifest for one stage, including exact inferred JSON
 * shapes from the currently stored normalized JSON plaintext.
 */
export const buildManifestForOrgProjectStageInternal = internalMutation({
  args: {
    orgId: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
  },
  returns: v.union(
    v.object({
      orgId: v.string(),
      orgSlug: v.string(),
      projectSlug: v.string(),
      stageSlug: v.string(),
      generatedAtMs: v.number(),
      variables: v.array(typegenVariableValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_org_id_and_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", args.projectSlug),
      )
      .unique();
    if (project === null) {
      return null;
    }

    const stage = await ctx.db
      .query("projectStages")
      .withIndex("by_project_id_and_slug", (q) =>
        q.eq("projectId", project._id).eq("slug", args.stageSlug),
      )
      .unique();
    if (stage === null) {
      return null;
    }

    const rows = await ctx.db
      .query("projectVariables")
      .withIndex("by_project_id_and_stage_slug", (q) =>
        q.eq("projectId", project._id).eq("stageSlug", stage.slug),
      )
      .collect();

    const variables = await Promise.all(
      rows.map(async (row) => {
        const declaredType = getDeclaredType(row);
        let typeScriptType =
          declaredType === "string"
            ? "string"
            : declaredType === "boolean"
              ? "boolean"
              : declaredType === "int64"
                ? "bigint"
                : declaredType === "float"
                  ? "number"
                  : declaredType === "date"
                    ? "BarekeyTemporalInstant"
                    : "unknown";

        if (declaredType === "json") {
          const encryptedValues =
            row.kind === "secret"
              ? [row.encryptedValue]
              : [row.encryptedValueA, row.encryptedValueB];
          const inferredTypes: Array<string> = [];
          for (const encryptedValue of encryptedValues) {
            if (encryptedValue === null) {
              continue;
            }
            const plaintext = await decryptSecretValueForProject(ctx, {
              projectId: project._id,
              orgId: project.orgId,
              encryptedValue,
            });
            const normalized = validateAndNormalizeDeclaredValue("json", plaintext);
            inferredTypes.push(inferTypeScriptTypeFromNormalizedJson(normalized));
          }
          typeScriptType = collapseTypeNames(inferredTypes);
        }

        return {
          name: row.name,
          kind: row.kind,
          declaredType,
          required: true,
          updatedAtMs: row.updatedAtMs,
          typeScriptType,
        };
      }),
    );

    return {
      orgId: project.orgId,
      orgSlug: project.orgSlug,
      projectSlug: project.slug,
      stageSlug: stage.slug,
      generatedAtMs: Date.now(),
      variables: variables.sort((left, right) => left.name.localeCompare(right.name)),
    };
  },
});
