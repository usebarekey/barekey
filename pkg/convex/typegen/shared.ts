import { v } from "convex/values";

import type { DeclaredVariableType } from "../lib/declared/types";
import { rolloutFunctionValidator, rolloutMilestoneValidator } from "../lib/rollout";
import { variableVisibilityValidator } from "../lib/visibility";

export const typegenArgs = {
  orgId: v.string(),
  projectSlug: v.string(),
  stageSlug: v.string(),
} as const;

export const typegenVariableValidator = v.object({
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

export const typegenManifestValidator = v.union(
  v.object({
    orgId: v.string(),
    orgSlug: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
    generatedAtMs: v.number(),
    variables: v.array(typegenVariableValidator),
  }),
  v.null(),
);

export type TypegenArgs = {
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
