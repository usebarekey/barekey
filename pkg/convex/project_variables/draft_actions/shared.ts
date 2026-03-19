import { Id as ConfectId } from "@rjdellecese/confect/server";
import { Schema } from "effect";
import { v } from "convex/values";

import type { Id } from "../../_generated/dataModel";
import type { DeclaredVariableType } from "../../lib/declared/types";
import type { RolloutFunction, RolloutMilestone } from "../../lib/rollout";
import {
  draftUpdateValidator,
  writeEntryValidator,
} from "../../lib/project_variables/contracts";
import type { VariableVisibility } from "../../lib/visibility";
import {
  declaredTypeSchema,
  rolloutFunctionSchema,
  rolloutMilestoneSchema,
  variableVisibilitySchema,
} from "../../lib/confect/schema/common";
import type { DraftWriteResult } from "../types";

export type ApplyDraftArgs = {
  expectedOrgSlug: string;
  projectSlug: string;
  stageSlug: string;
  creates: ReadonlyArray<{
    name: string;
    visibility: VariableVisibility;
    kind: "secret" | "ab_roll" | "rollout";
    declaredType: DeclaredVariableType;
    value?: string;
    valueA?: string;
    valueB?: string;
    chance?: number;
    rolloutFunction?: RolloutFunction;
    rolloutMilestones?: ReadonlyArray<RolloutMilestone>;
  }>;
  updates: ReadonlyArray<{
    id: Id<"projectVariables">;
    visibility: VariableVisibility;
    kind: "secret" | "ab_roll" | "rollout";
    declaredType: DeclaredVariableType;
    value?: string;
    valueA?: string;
    valueB?: string;
    chance?: number;
    rolloutFunction?: RolloutFunction;
    rolloutMilestones?: ReadonlyArray<RolloutMilestone>;
  }>;
  deletes: ReadonlyArray<Id<"projectVariables">>;
};

export type DraftTouchedEntry = {
  operation: "create" | "update" | "delete";
  name: string;
  kind: "secret" | "ab_roll" | "rollout";
  visibility: VariableVisibility;
  declaredType: DeclaredVariableType;
};

export const applyDraftArgs = {
  expectedOrgSlug: v.string(),
  projectSlug: v.string(),
  stageSlug: v.string(),
  creates: v.array(writeEntryValidator),
  updates: v.array(draftUpdateValidator),
  deletes: v.array(v.id("projectVariables")),
} as const;

const draftCreateSchema = Schema.Union(
  Schema.Struct({
    name: Schema.String,
    visibility: variableVisibilitySchema,
    kind: Schema.Literal("secret"),
    declaredType: declaredTypeSchema,
    value: Schema.String,
  }),
  Schema.Struct({
    name: Schema.String,
    visibility: variableVisibilitySchema,
    kind: Schema.Literal("ab_roll"),
    declaredType: declaredTypeSchema,
    valueA: Schema.String,
    valueB: Schema.String,
    chance: Schema.Number,
  }),
  Schema.Struct({
    name: Schema.String,
    visibility: variableVisibilitySchema,
    kind: Schema.Literal("rollout"),
    declaredType: declaredTypeSchema,
    valueA: Schema.String,
    valueB: Schema.String,
    rolloutFunction: rolloutFunctionSchema,
    rolloutMilestones: Schema.Array(rolloutMilestoneSchema),
  }),
);

const draftUpdateSchema = Schema.Union(
  Schema.Struct({
    id: ConfectId.Id("projectVariables"),
    visibility: variableVisibilitySchema,
    kind: Schema.Literal("secret"),
    declaredType: declaredTypeSchema,
    value: Schema.String,
  }),
  Schema.Struct({
    id: ConfectId.Id("projectVariables"),
    visibility: variableVisibilitySchema,
    kind: Schema.Literal("ab_roll"),
    declaredType: declaredTypeSchema,
    valueA: Schema.String,
    valueB: Schema.String,
    chance: Schema.Number,
  }),
  Schema.Struct({
    id: ConfectId.Id("projectVariables"),
    visibility: variableVisibilitySchema,
    kind: Schema.Literal("rollout"),
    declaredType: declaredTypeSchema,
    valueA: Schema.String,
    valueB: Schema.String,
    rolloutFunction: rolloutFunctionSchema,
    rolloutMilestones: Schema.Array(rolloutMilestoneSchema),
  }),
);

export const applyDraftArgsSchema = Schema.Struct({
  expectedOrgSlug: Schema.String,
  projectSlug: Schema.String,
  stageSlug: Schema.String,
  creates: Schema.Array(draftCreateSchema),
  updates: Schema.Array(draftUpdateSchema),
  deletes: Schema.Array(ConfectId.Id("projectVariables")),
});

export const draftWriteResultValidator = v.object({
  createdCount: v.number(),
  updatedCount: v.number(),
  deletedCount: v.number(),
});

export const draftWriteResultSchema = Schema.Struct({
  createdCount: Schema.Number,
  updatedCount: Schema.Number,
  deletedCount: Schema.Number,
});

export type { DraftWriteResult };
