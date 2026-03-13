import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import {
  fallbackDeclaredType,
  toExactTypeScriptTypeForNormalizedValue,
  toTypeScriptTypeForDeclaredType,
  type DeclaredVariableType,
} from "./lib/declared_types";
import { decryptSecretValueForProject } from "./lib/encryption";
import { rolloutFunctionValidator, rolloutMilestoneValidator } from "./lib/rollout";
import { getVariableVisibility, variableVisibilityValidator } from "./lib/visibility";

const typegenVariableValidator = v.object({
  name: v.string(),
  visibility: variableVisibilityValidator,
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
  valueATypeScriptType: v.union(v.string(), v.null()),
  valueBTypeScriptType: v.union(v.string(), v.null()),
  rolloutFunction: v.union(rolloutFunctionValidator, v.null()),
  rolloutMilestones: v.union(v.array(rolloutMilestoneValidator), v.null()),
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
        if (row.kind === "secret") {
          let normalizedJsonValue: string | null = null;
          if (declaredType === "json" && row.encryptedValue !== null) {
            const plaintext = await decryptSecretValueForProject(ctx, {
              projectId: project._id,
              orgId: project.orgId,
              encryptedValue: row.encryptedValue,
            });
            normalizedJsonValue = plaintext;
          }

          return {
            name: row.name,
            visibility: getVariableVisibility(row),
            kind: row.kind,
            declaredType,
            required: true,
            updatedAtMs: row.updatedAtMs,
            typeScriptType: toTypeScriptTypeForDeclaredType({
              declaredType,
              normalizedJsonValue,
            }),
            valueATypeScriptType: null,
            valueBTypeScriptType: null,
            rolloutFunction: null,
            rolloutMilestones: null,
          };
        }

        const normalizedValues: Array<string> = [];
        for (const encryptedValue of [row.encryptedValueA, row.encryptedValueB]) {
          if (encryptedValue === null) {
            continue;
          }
          normalizedValues.push(
            await decryptSecretValueForProject(ctx, {
              projectId: project._id,
              orgId: project.orgId,
              encryptedValue,
            }),
          );
        }

        const [normalizedValueA, normalizedValueB] = normalizedValues;
        const fallbackTypeScriptType = toTypeScriptTypeForDeclaredType({
          declaredType,
          normalizedJsonValue:
            declaredType === "json" ? (normalizedValueA ?? normalizedValueB ?? null) : undefined,
        });
        const valueATypeScriptType =
          normalizedValueA === undefined
            ? fallbackTypeScriptType
            : toExactTypeScriptTypeForNormalizedValue({
                declaredType,
                normalizedValue: normalizedValueA,
              });
        const valueBTypeScriptType =
          normalizedValueB === undefined
            ? fallbackTypeScriptType
            : toExactTypeScriptTypeForNormalizedValue({
                declaredType,
                normalizedValue: normalizedValueB,
              });

        return {
          name: row.name,
          visibility: getVariableVisibility(row),
          kind: row.kind,
          declaredType,
          required: true,
          updatedAtMs: row.updatedAtMs,
          typeScriptType: collapseTypeNames([valueATypeScriptType, valueBTypeScriptType]),
          valueATypeScriptType,
          valueBTypeScriptType,
          rolloutFunction: row.kind === "rollout" ? (row.rolloutFunction ?? "linear") : null,
          rolloutMilestones: row.kind === "rollout" ? (row.rolloutMilestones ?? []) : null,
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
