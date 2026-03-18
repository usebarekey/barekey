import { v } from "convex/values";

import { declaredTypeValidator } from "../declared/types";
import {
  rolloutFunctionValidator,
  rolloutMilestoneValidator,
} from "../rollout";
import { variableVisibilityValidator } from "../visibility";

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
