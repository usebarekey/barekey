import { defineTable, Id } from "@rjdellecese/confect/server";
import { Schema } from "effect";

import {
  declaredTypeSchema,
  preparedCreateSchema,
  preparedUpdateSchema,
  rolloutFunctionSchema,
  rolloutMilestoneSchema,
  variableVisibilitySchema,
} from "../common";

export const projects = defineTable(
  Schema.Struct({
    orgId: Schema.String,
    orgSlug: Schema.String,
    name: Schema.String,
    slug: Schema.String,
    slugBase: Schema.String,
    createdByClerkUserId: Schema.String,
    createdAtMs: Schema.Number,
    updatedAtMs: Schema.Number,
  }),
)
  .index("by_org_id", ["orgId"])
  .index("by_org_id_and_created_at_ms", ["orgId", "createdAtMs"])
  .index("by_org_id_and_slug", ["orgId", "slug"])
  .index("by_org_slug_and_slug", ["orgSlug", "slug"]);

export const projectStages = defineTable(
  Schema.Struct({
    projectId: Id.Id("projects"),
    orgId: Schema.String,
    slug: Schema.String,
    name: Schema.String,
    isDefault: Schema.Boolean,
    createdAtMs: Schema.Number,
    updatedAtMs: Schema.Number,
  }),
)
  .index("by_project_id", ["projectId"])
  .index("by_project_id_and_slug", ["projectId", "slug"])
  .index("by_org_id_and_project_id", ["orgId", "projectId"]);

export const projectKeys = defineTable(
  Schema.Struct({
    projectId: Id.Id("projects"),
    orgId: Schema.String,
    encryptedDek: Schema.String,
    dekVersion: Schema.Number,
    rotatedAtMs: Schema.Number,
    createdAtMs: Schema.Number,
    updatedAtMs: Schema.Number,
  }),
)
  .index("by_project_id", ["projectId"])
  .index("by_org_id_and_project_id", ["orgId", "projectId"]);

export const projectVariables = defineTable(
  Schema.Struct({
    projectId: Id.Id("projects"),
    orgId: Schema.String,
    stageSlug: Schema.String,
    name: Schema.String,
    visibility: Schema.optional(variableVisibilitySchema),
    kind: Schema.Union(
      Schema.Literal("secret"),
      Schema.Literal("ab_roll"),
      Schema.Literal("rollout"),
    ),
    declaredType: Schema.optional(declaredTypeSchema),
    encryptedValue: Schema.NullOr(Schema.String),
    encryptedValueA: Schema.NullOr(Schema.String),
    encryptedValueB: Schema.NullOr(Schema.String),
    chance: Schema.NullOr(Schema.Number),
    rolloutFunction: Schema.optional(Schema.NullOr(rolloutFunctionSchema)),
    rolloutMilestones: Schema.optional(Schema.NullOr(Schema.Array(rolloutMilestoneSchema))),
    createdByClerkUserId: Schema.String,
    createdAtMs: Schema.Number,
    updatedAtMs: Schema.Number,
  }),
)
  .index("by_project_id_and_stage_slug", ["projectId", "stageSlug"])
  .index("by_project_id_and_stage_slug_and_name", ["projectId", "stageSlug", "name"])
  .index("by_project_id_and_stage_slug_and_visibility", ["projectId", "stageSlug", "visibility"])
  .index("by_project_id_and_stage_slug_and_visibility_and_name", [
    "projectId",
    "stageSlug",
    "visibility",
    "name",
  ])
  .index("by_org_id_and_project_id", ["orgId", "projectId"]);

export const projectVariableSchedules = defineTable(
  Schema.Struct({
    projectId: Id.Id("projects"),
    orgId: Schema.String,
    stageSlug: Schema.String,
    timezone: Schema.String,
    runAtMs: Schema.Number,
    status: Schema.Union(
      Schema.Literal("scheduled"),
      Schema.Literal("applied"),
      Schema.Literal("canceled"),
      Schema.Literal("failed"),
    ),
    scheduledFunctionId: Schema.NullOr(Id.Id("_scheduled_functions")),
    preparedCreates: Schema.Array(preparedCreateSchema),
    preparedUpdates: Schema.Array(preparedUpdateSchema),
    updateTargets: Schema.Array(Schema.Any),
    createdCount: Schema.Number,
    updatedCount: Schema.Number,
    createdByClerkUserId: Schema.String,
    updatedByClerkUserId: Schema.String,
    createdAtMs: Schema.Number,
    updatedAtMs: Schema.Number,
    executedAtMs: Schema.NullOr(Schema.Number),
    canceledAtMs: Schema.NullOr(Schema.Number),
    failedAtMs: Schema.NullOr(Schema.Number),
    failureMessage: Schema.NullOr(Schema.String),
  }),
)
  .index("by_project_id", ["projectId"])
  .index("by_project_id_and_stage_slug", ["projectId", "stageSlug"])
  .index("by_project_id_and_status", ["projectId", "status"])
  .index("by_project_id_and_run_at_ms", ["projectId", "runAtMs"])
  .index("by_org_id_and_project_id", ["orgId", "projectId"]);
