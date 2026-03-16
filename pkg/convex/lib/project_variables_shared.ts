import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import {
  declaredTypeValidator,
  fallbackDeclaredType,
  type DeclaredVariableType,
} from "./declared_types";
import {
  rolloutFunctionValidator,
  rolloutMilestoneValidator,
  type RolloutFunction,
  type RolloutMilestone,
  validateRolloutMilestones,
} from "./rollout";
import {
  getVariableVisibility,
  type VariableVisibility,
  variableVisibilityValidator,
} from "./visibility";

export function validateVariableName(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error("Variable name is required.");
  }

  if (trimmed.length > 160) {
    throw new Error("Variable name must be 160 characters or fewer.");
  }

  return trimmed;
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export { variableVisibilityValidator };

export const variableKindValidator = v.union(
  v.literal("secret"),
  v.literal("ab_roll"),
  v.literal("rollout"),
);

const secretVariableMetadataValidator = v.object({
  id: v.id("projectVariables"),
  projectId: v.id("projects"),
  orgId: v.string(),
  stageSlug: v.string(),
  name: v.string(),
  visibility: variableVisibilityValidator,
  kind: v.literal("secret"),
  declaredType: declaredTypeValidator,
  createdAtMs: v.number(),
  updatedAtMs: v.number(),
  chance: v.null(),
  rolloutFunction: v.null(),
  rolloutMilestones: v.null(),
});

const abRollVariableMetadataValidator = v.object({
  id: v.id("projectVariables"),
  projectId: v.id("projects"),
  orgId: v.string(),
  stageSlug: v.string(),
  name: v.string(),
  visibility: variableVisibilityValidator,
  kind: v.literal("ab_roll"),
  declaredType: declaredTypeValidator,
  createdAtMs: v.number(),
  updatedAtMs: v.number(),
  chance: v.number(),
  rolloutFunction: v.null(),
  rolloutMilestones: v.null(),
});

const rolloutVariableMetadataValidator = v.object({
  id: v.id("projectVariables"),
  projectId: v.id("projects"),
  orgId: v.string(),
  stageSlug: v.string(),
  name: v.string(),
  visibility: variableVisibilityValidator,
  kind: v.literal("rollout"),
  declaredType: declaredTypeValidator,
  createdAtMs: v.number(),
  updatedAtMs: v.number(),
  chance: v.null(),
  rolloutFunction: rolloutFunctionValidator,
  rolloutMilestones: v.array(rolloutMilestoneValidator),
});

export const variableMetadataValidator = v.union(
  secretVariableMetadataValidator,
  abRollVariableMetadataValidator,
  rolloutVariableMetadataValidator,
);

export const preparedDraftCreateValidator = v.object({
  name: v.string(),
  visibility: variableVisibilityValidator,
  kind: v.literal("secret"),
  declaredType: declaredTypeValidator,
  encryptedValue: v.string(),
});

export const preparedDraftUpdateValidator = v.object({
  id: v.id("projectVariables"),
  visibility: variableVisibilityValidator,
  kind: v.literal("secret"),
  declaredType: declaredTypeValidator,
  encryptedValue: v.string(),
});

export const writeModeValidator = v.union(v.literal("create_only"), v.literal("upsert"));

const writeSecretEntryValidator = v.object({
  name: v.string(),
  visibility: variableVisibilityValidator,
  kind: v.literal("secret"),
  declaredType: declaredTypeValidator,
  value: v.string(),
});

const writeAbRollEntryValidator = v.object({
  name: v.string(),
  visibility: variableVisibilityValidator,
  kind: v.literal("ab_roll"),
  declaredType: declaredTypeValidator,
  valueA: v.string(),
  valueB: v.string(),
  chance: v.number(),
});

const writeRolloutEntryValidator = v.object({
  name: v.string(),
  visibility: variableVisibilityValidator,
  kind: v.literal("rollout"),
  declaredType: declaredTypeValidator,
  valueA: v.string(),
  valueB: v.string(),
  rolloutFunction: rolloutFunctionValidator,
  rolloutMilestones: v.array(rolloutMilestoneValidator),
});

export const writeEntryValidator = v.union(
  writeSecretEntryValidator,
  writeAbRollEntryValidator,
  writeRolloutEntryValidator,
);

const draftUpdateSecretValidator = v.object({
  id: v.id("projectVariables"),
  visibility: variableVisibilityValidator,
  kind: v.literal("secret"),
  declaredType: declaredTypeValidator,
  value: v.string(),
});

const draftUpdateAbRollValidator = v.object({
  id: v.id("projectVariables"),
  visibility: variableVisibilityValidator,
  kind: v.literal("ab_roll"),
  declaredType: declaredTypeValidator,
  valueA: v.string(),
  valueB: v.string(),
  chance: v.number(),
});

const draftUpdateRolloutValidator = v.object({
  id: v.id("projectVariables"),
  visibility: variableVisibilityValidator,
  kind: v.literal("rollout"),
  declaredType: declaredTypeValidator,
  valueA: v.string(),
  valueB: v.string(),
  rolloutFunction: rolloutFunctionValidator,
  rolloutMilestones: v.array(rolloutMilestoneValidator),
});

export const draftUpdateValidator = v.union(
  draftUpdateSecretValidator,
  draftUpdateAbRollValidator,
  draftUpdateRolloutValidator,
);

export function validateChance(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("ab_roll chance must be a finite number between 0 and 1.");
  }
  return value;
}

export function encryptedPayloadByteLength(input: {
  encryptedValue: string | null;
  encryptedValueA: string | null;
  encryptedValueB: string | null;
}): number {
  let total = 0;
  if (input.encryptedValue !== null) {
    total += utf8ByteLength(input.encryptedValue);
  }
  if (input.encryptedValueA !== null) {
    total += utf8ByteLength(input.encryptedValueA);
  }
  if (input.encryptedValueB !== null) {
    total += utf8ByteLength(input.encryptedValueB);
  }
  return total;
}

export function getRowDeclaredType(input: {
  declaredType?: string | null;
}): DeclaredVariableType {
  return fallbackDeclaredType(input.declaredType);
}

export type VariableStorageRow = {
  _id: Id<"projectVariables">;
  projectId: Id<"projects">;
  orgId: string;
  stageSlug: string;
  name: string;
  visibility?: VariableVisibility | null;
  kind: "secret" | "ab_roll" | "rollout";
  declaredType?: string | null;
  createdAtMs: number;
  updatedAtMs: number;
  chance?: number | null;
  rolloutFunction?: RolloutFunction | null;
  rolloutMilestones?: Array<RolloutMilestone> | null;
};

export const variableResolverRowValidator = v.object({
  id: v.id("projectVariables"),
  projectId: v.id("projects"),
  orgId: v.string(),
  stageSlug: v.string(),
  name: v.string(),
  visibility: variableVisibilityValidator,
  kind: variableKindValidator,
  declaredType: declaredTypeValidator,
});

export function mapVariableResolverRow(row: VariableStorageRow) {
  return {
    id: row._id,
    projectId: row.projectId,
    orgId: row.orgId,
    stageSlug: row.stageSlug,
    name: row.name,
    visibility: getVariableVisibility(row),
    kind: row.kind,
    declaredType: getRowDeclaredType(row),
  };
}

export function mapVariableMetadataRow(row: VariableStorageRow) {
  const visibility = getVariableVisibility(row);
  if (row.kind === "secret") {
    return {
      id: row._id,
      projectId: row.projectId,
      orgId: row.orgId,
      stageSlug: row.stageSlug,
      name: row.name,
      visibility,
      kind: "secret" as const,
      declaredType: getRowDeclaredType(row),
      createdAtMs: row.createdAtMs,
      updatedAtMs: row.updatedAtMs,
      chance: null,
      rolloutFunction: null,
      rolloutMilestones: null,
    };
  }

  if (row.kind === "ab_roll") {
    return {
      id: row._id,
      projectId: row.projectId,
      orgId: row.orgId,
      stageSlug: row.stageSlug,
      name: row.name,
      visibility,
      kind: "ab_roll" as const,
      declaredType: getRowDeclaredType(row),
      createdAtMs: row.createdAtMs,
      updatedAtMs: row.updatedAtMs,
      chance: validateChance(row.chance ?? 0),
      rolloutFunction: null,
      rolloutMilestones: null,
    };
  }

  return {
    id: row._id,
    projectId: row.projectId,
    orgId: row.orgId,
    stageSlug: row.stageSlug,
    name: row.name,
    visibility,
    kind: "rollout" as const,
    declaredType: getRowDeclaredType(row),
    createdAtMs: row.createdAtMs,
    updatedAtMs: row.updatedAtMs,
    chance: null,
    rolloutFunction: row.rolloutFunction ?? "linear",
    rolloutMilestones: validateRolloutMilestones(row.rolloutMilestones ?? []),
  };
}
