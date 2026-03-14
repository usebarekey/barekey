import { v } from "convex/values";

import { declaredTypeValidator } from "./declared_types";
import { rolloutFunctionValidator, rolloutMilestoneValidator } from "./rollout";
import { variableVisibilityValidator } from "./visibility";

export const projectVariableScheduleStatusValidator = v.union(
  v.literal("scheduled"),
  v.literal("applied"),
  v.literal("failed"),
  v.literal("canceled"),
);

export const projectVariableScheduleUpdateTargetValidator = v.object({
  id: v.id("projectVariables"),
  name: v.string(),
});

export const projectVariableScheduleCreateEntryValidator = v.union(
  v.object({
    name: v.string(),
    visibility: variableVisibilityValidator,
    kind: v.literal("secret"),
    declaredType: declaredTypeValidator,
    value: v.string(),
  }),
  v.object({
    name: v.string(),
    visibility: variableVisibilityValidator,
    kind: v.literal("ab_roll"),
    declaredType: declaredTypeValidator,
    valueA: v.string(),
    valueB: v.string(),
    chance: v.number(),
  }),
  v.object({
    name: v.string(),
    visibility: variableVisibilityValidator,
    kind: v.literal("rollout"),
    declaredType: declaredTypeValidator,
    valueA: v.string(),
    valueB: v.string(),
    rolloutFunction: rolloutFunctionValidator,
    rolloutMilestones: v.array(rolloutMilestoneValidator),
  }),
);

export const projectVariableScheduleUpdateEntryValidator = v.union(
  v.object({
    id: v.id("projectVariables"),
    visibility: variableVisibilityValidator,
    kind: v.literal("secret"),
    declaredType: declaredTypeValidator,
    value: v.string(),
  }),
  v.object({
    id: v.id("projectVariables"),
    visibility: variableVisibilityValidator,
    kind: v.literal("ab_roll"),
    declaredType: declaredTypeValidator,
    valueA: v.string(),
    valueB: v.string(),
    chance: v.number(),
  }),
  v.object({
    id: v.id("projectVariables"),
    visibility: variableVisibilityValidator,
    kind: v.literal("rollout"),
    declaredType: declaredTypeValidator,
    valueA: v.string(),
    valueB: v.string(),
    rolloutFunction: rolloutFunctionValidator,
    rolloutMilestones: v.array(rolloutMilestoneValidator),
  }),
);

export const projectVariablePreparedCreateValidator = v.union(
  v.object({
    name: v.string(),
    visibility: variableVisibilityValidator,
    kind: v.literal("secret"),
    declaredType: declaredTypeValidator,
    encryptedValue: v.string(),
    encryptedValueA: v.null(),
    encryptedValueB: v.null(),
    chance: v.null(),
    rolloutFunction: v.null(),
    rolloutMilestones: v.null(),
  }),
  v.object({
    name: v.string(),
    visibility: variableVisibilityValidator,
    kind: v.literal("ab_roll"),
    declaredType: declaredTypeValidator,
    encryptedValue: v.null(),
    encryptedValueA: v.string(),
    encryptedValueB: v.string(),
    chance: v.number(),
    rolloutFunction: v.null(),
    rolloutMilestones: v.null(),
  }),
  v.object({
    name: v.string(),
    visibility: variableVisibilityValidator,
    kind: v.literal("rollout"),
    declaredType: declaredTypeValidator,
    encryptedValue: v.null(),
    encryptedValueA: v.string(),
    encryptedValueB: v.string(),
    chance: v.null(),
    rolloutFunction: rolloutFunctionValidator,
    rolloutMilestones: v.array(rolloutMilestoneValidator),
  }),
);

export const projectVariablePreparedUpdateValidator = v.union(
  v.object({
    id: v.id("projectVariables"),
    visibility: variableVisibilityValidator,
    kind: v.literal("secret"),
    declaredType: declaredTypeValidator,
    encryptedValue: v.string(),
    encryptedValueA: v.null(),
    encryptedValueB: v.null(),
    chance: v.null(),
    rolloutFunction: v.null(),
    rolloutMilestones: v.null(),
  }),
  v.object({
    id: v.id("projectVariables"),
    visibility: variableVisibilityValidator,
    kind: v.literal("ab_roll"),
    declaredType: declaredTypeValidator,
    encryptedValue: v.null(),
    encryptedValueA: v.string(),
    encryptedValueB: v.string(),
    chance: v.number(),
    rolloutFunction: v.null(),
    rolloutMilestones: v.null(),
  }),
  v.object({
    id: v.id("projectVariables"),
    visibility: variableVisibilityValidator,
    kind: v.literal("rollout"),
    declaredType: declaredTypeValidator,
    encryptedValue: v.null(),
    encryptedValueA: v.string(),
    encryptedValueB: v.string(),
    chance: v.null(),
    rolloutFunction: rolloutFunctionValidator,
    rolloutMilestones: v.array(rolloutMilestoneValidator),
  }),
);
