import { Effect } from "effect";
import { v } from "convex/values";

import type { MutationCtx } from "./_generated/server";
import { BarekeyConfectMutationCtx, effectInternalMutation } from "./confect";
import {
  fallbackDeclaredType,
  toExactTypeScriptTypeForNormalizedValue,
  toTypeScriptTypeForDeclaredType,
  type DeclaredVariableType,
} from "./lib/declared/types";
import { decryptSecretValueForProject } from "./lib/encryption";
import { ExternalServiceError } from "./lib/errors/effect";
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

type TypegenArgs = {
  orgId: string;
  projectSlug: string;
  stageSlug: string;
};

export type TypegenVariable = {
  name: string;
  visibility: "private" | "public";
  kind: "secret" | "ab_roll" | "rollout";
  declaredType: DeclaredVariableType;
  required: boolean;
  updatedAtMs: number;
  typeScriptType: string;
  valueATypeScriptType: string | null;
  valueBTypeScriptType: string | null;
  rolloutFunction: "linear" | "step" | "ease_in_out" | null;
  rolloutMilestones: Array<{ at: string; percentage: number }> | null;
};

export type TypegenManifest = {
  orgId: string;
  orgSlug: string;
  projectSlug: string;
  stageSlug: string;
  generatedAtMs: number;
  variables: Array<TypegenVariable>;
} | null;

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
 * Normalizes typegen manifest failures into typed external-service errors.
 *
 * @param fallbackMessage The fallback message to use when the failure is not an `Error`.
 * @param error The unknown failure value.
 * @returns A typed external-service error.
 * @remarks Typegen reads and decryption failures stay on the shared Effect error channel.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function toTypegenError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}

/**
 * Builds the typegen manifest for one project stage.
 *
 * @param ctx The Convex mutation context.
 * @param args The organization, project, and stage selector.
 * @returns An Effect that succeeds with the stage manifest, or `null` when the project or stage is missing.
 * @remarks JSON variables infer exact plaintext shapes from the currently stored normalized decrypted values.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function buildManifestForOrgProjectStageInternalEffect(
  ctx: MutationCtx,
  args: TypegenArgs,
): Effect.Effect<TypegenManifest, ExternalServiceError> {
  return Effect.tryPromise({
    try: async () => {
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
        rows.map(async (row): Promise<TypegenVariable> => {
        const declaredType = getDeclaredType(row);
        if (row.kind === "secret") {
          let normalizedJsonValue: string | null = null;
          if (declaredType === "json" && row.encryptedValue !== null) {
            normalizedJsonValue = await decryptSecretValueForProject(ctx, {
              projectId: project._id,
              orgId: project.orgId,
              encryptedValue: row.encryptedValue,
            });
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

        const normalizedValues = await Promise.all(
          [row.encryptedValueA, row.encryptedValueB].map(async (encryptedValue) => {
            if (encryptedValue === null) {
              return null;
            }

            return await decryptSecretValueForProject(ctx, {
              projectId: project._id,
              orgId: project.orgId,
              encryptedValue,
            });
          }),
        );

        const normalizedValueA = normalizedValues[0] ?? null;
        const normalizedValueB = normalizedValues[1] ?? null;
        const fallbackTypeScriptType = toTypeScriptTypeForDeclaredType({
          declaredType,
          normalizedJsonValue:
            declaredType === "json" ? normalizedValueA ?? normalizedValueB ?? null : undefined,
        });
        const valueATypeScriptType =
          normalizedValueA === null
            ? fallbackTypeScriptType
            : toExactTypeScriptTypeForNormalizedValue({
                declaredType,
                normalizedValue: normalizedValueA,
              });
        const valueBTypeScriptType =
          normalizedValueB === null
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
    catch: (error) => toTypegenError("Failed to build the typegen manifest.", error),
  });
}

/**
 * Builds the typegen manifest for one stage, including exact inferred JSON
 * shapes from the currently stored normalized JSON plaintext.
 *
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const buildManifestForOrgProjectStageInternal = effectInternalMutation<
  TypegenArgs,
  TypegenManifest,
  any
>({
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
  handler: (args) =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectMutationCtx;
      const ctx = confectCtx.ctx as unknown as MutationCtx;
      return yield* buildManifestForOrgProjectStageInternalEffect(ctx, args);
    }),
});
