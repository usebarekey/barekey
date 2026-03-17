import {
  ConfectActionCtx,
  ConfectMutationCtx,
  ConfectQueryCtx,
  Id,
  type ConfectDataModelFromConfectSchemaDefinition,
  defineSchema,
  defineTable,
} from "@rjdellecese/confect/server";
import { Schema } from "effect";

const variableVisibilitySchema = Schema.Union(Schema.Literal("private"), Schema.Literal("public"));

const declaredTypeSchema = Schema.Union(
  Schema.Literal("string"),
  Schema.Literal("boolean"),
  Schema.Literal("int64"),
  Schema.Literal("float"),
  Schema.Literal("date"),
  Schema.Literal("json"),
);

const rolloutFunctionSchema = Schema.Union(
  Schema.Literal("linear"),
  Schema.Literal("step"),
  Schema.Literal("ease_in_out"),
);

const rolloutMilestoneSchema = Schema.Struct({
  at: Schema.String,
  percentage: Schema.Number,
});

const preparedCreateSchema = Schema.Struct({
  name: Schema.String,
  visibility: variableVisibilitySchema,
  kind: Schema.Union(
    Schema.Literal("secret"),
    Schema.Literal("ab_roll"),
    Schema.Literal("rollout"),
  ),
  declaredType: declaredTypeSchema,
  encryptedValue: Schema.NullOr(Schema.String),
  encryptedValueA: Schema.NullOr(Schema.String),
  encryptedValueB: Schema.NullOr(Schema.String),
  chance: Schema.NullOr(Schema.Number),
  rolloutFunction: Schema.NullOr(rolloutFunctionSchema),
  rolloutMilestones: Schema.NullOr(Schema.Array(rolloutMilestoneSchema)),
});

const preparedUpdateSchema = Schema.Struct({
  id: Id.Id("projectVariables"),
  visibility: variableVisibilitySchema,
  kind: Schema.Union(
    Schema.Literal("secret"),
    Schema.Literal("ab_roll"),
    Schema.Literal("rollout"),
  ),
  declaredType: declaredTypeSchema,
  encryptedValue: Schema.NullOr(Schema.String),
  encryptedValueA: Schema.NullOr(Schema.String),
  encryptedValueB: Schema.NullOr(Schema.String),
  chance: Schema.NullOr(Schema.Number),
  rolloutFunction: Schema.NullOr(rolloutFunctionSchema),
  rolloutMilestones: Schema.NullOr(Schema.Array(rolloutMilestoneSchema)),
});

export const confectSchema = defineSchema({
  users: defineTable(
    Schema.Struct({
      clerkUserId: Schema.String,
      slug: Schema.String,
      slugBase: Schema.String,
      email: Schema.NullOr(Schema.String),
      displayName: Schema.NullOr(Schema.String),
      imageUrl: Schema.NullOr(Schema.String),
      createdAtMs: Schema.Number,
      updatedAtMs: Schema.Number,
      lastSeenAtMs: Schema.Number,
    }),
  )
    .index("by_clerk_user_id", ["clerkUserId"])
    .index("by_slug", ["slug"]),
  userFreePlanCredits: defineTable(
    Schema.Struct({
      clerkUserId: Schema.String,
      totalCredits: Schema.Number,
      remainingCredits: Schema.Number,
      assignedOrgId: Schema.NullOr(Schema.String),
      assignedOrgSlug: Schema.NullOr(Schema.String),
      consumedAtMs: Schema.NullOr(Schema.Number),
      revokedAtMs: Schema.NullOr(Schema.Number),
      revokedReason: Schema.NullOr(Schema.String),
      createdAtMs: Schema.Number,
      updatedAtMs: Schema.Number,
    }),
  )
    .index("by_clerk_user_id", ["clerkUserId"])
    .index("by_assigned_org_id", ["assignedOrgId"]),
  userPreferences: defineTable(
    Schema.Struct({
      clerkUserId: Schema.String,
      preferredTheme: Schema.Union(
        Schema.Literal("system"),
        Schema.Literal("light"),
        Schema.Literal("dark"),
      ),
      defaultOrgSlug: Schema.NullOr(Schema.String),
      landingPreference: Schema.Union(
        Schema.Literal("account_overview"),
        Schema.Literal("default_workspace"),
      ),
      createdAtMs: Schema.Number,
      updatedAtMs: Schema.Number,
    }),
  ).index("by_clerk_user_id", ["clerkUserId"]),
  projects: defineTable(
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
    .index("by_org_slug_and_slug", ["orgSlug", "slug"]),
  projectStages: defineTable(
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
    .index("by_org_id_and_project_id", ["orgId", "projectId"]),
  projectKeys: defineTable(
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
    .index("by_org_id_and_project_id", ["orgId", "projectId"]),
  projectVariables: defineTable(
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
    .index("by_org_id_and_project_id", ["orgId", "projectId"]),
  projectVariableSchedules: defineTable(
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
    .index("by_org_id_and_project_id", ["orgId", "projectId"]),
  orgStorageUsage: defineTable(
    Schema.Struct({
      orgId: Schema.String,
      encryptedBytes: Schema.Number,
      createdAtMs: Schema.Number,
      updatedAtMs: Schema.Number,
    }),
  ).index("by_org_id", ["orgId"]),
  orgBillingSnapshots: defineTable(
    Schema.Struct({
      orgId: Schema.String,
      currentTier: Schema.NullOr(
        Schema.Union(Schema.Literal("free"), Schema.Literal("pro"), Schema.Literal("max")),
      ),
      variablesLimit: Schema.Number,
      variablesUsed: Schema.Number,
      source: Schema.Union(
        Schema.Literal("free"),
        Schema.Literal("polar"),
        Schema.Literal("manual"),
      ),
      polarSubscriptionId: Schema.NullOr(Schema.String),
      planSlug: Schema.NullOr(Schema.String),
      periodEndsAtMs: Schema.NullOr(Schema.Number),
      updatedAtMs: Schema.Number,
    }),
  ).index("by_org_id", ["orgId"]),
  billingRequestLog: defineTable(
    Schema.Struct({
      orgId: Schema.String,
      requestKey: Schema.String,
      featureId: Schema.String,
      units: Schema.Number,
      createdAtMs: Schema.Number,
    }),
  )
    .index("by_org_id_and_request_key", ["orgId", "requestKey"])
    .index("by_org_id_and_created_at_ms", ["orgId", "createdAtMs"]),
  cliDeviceCodes: defineTable(
    Schema.Struct({
      deviceCodeHash: Schema.String,
      userCode: Schema.String,
      status: Schema.Union(
        Schema.Literal("pending"),
        Schema.Literal("approved"),
        Schema.Literal("exchanged"),
        Schema.Literal("expired"),
      ),
      clientName: Schema.NullOr(Schema.String),
      approvedAtMs: Schema.NullOr(Schema.Number),
      approvedByClerkUserId: Schema.NullOr(Schema.String),
      approvedOrgId: Schema.NullOr(Schema.String),
      approvedOrgSlug: Schema.NullOr(Schema.String),
      exchangedAtMs: Schema.NullOr(Schema.Number),
      createdAtMs: Schema.Number,
      updatedAtMs: Schema.Number,
      expiresAtMs: Schema.Number,
      intervalSec: Schema.Number,
    }),
  )
    .index("by_device_code_hash", ["deviceCodeHash"])
    .index("by_user_code_and_status", ["userCode", "status"])
    .index("by_status_and_expires_at_ms", ["status", "expiresAtMs"]),
  cliSessions: defineTable(
    Schema.Struct({
      sessionId: Schema.String,
      clerkUserId: Schema.String,
      orgId: Schema.String,
      orgSlug: Schema.String,
      accessTokenHash: Schema.String,
      refreshTokenHash: Schema.String,
      accessTokenExpiresAtMs: Schema.Number,
      refreshTokenExpiresAtMs: Schema.Number,
      revokedAtMs: Schema.NullOr(Schema.Number),
      createdAtMs: Schema.Number,
      updatedAtMs: Schema.Number,
      lastUsedAtMs: Schema.Number,
    }),
  )
    .index("by_session_id", ["sessionId"])
    .index("by_access_token_hash", ["accessTokenHash"])
    .index("by_refresh_token_hash", ["refreshTokenHash"])
    .index("by_clerk_user_id_and_org_id", ["clerkUserId", "orgId"]),
  auditEvents: defineTable(
    Schema.Struct({
      orgId: Schema.String,
      orgSlug: Schema.String,
      projectId: Schema.NullOr(Id.Id("projects")),
      projectSlug: Schema.NullOr(Schema.String),
      stageSlug: Schema.NullOr(Schema.String),
      eventType: Schema.String,
      category: Schema.Union(
        Schema.Literal("org"),
        Schema.Literal("project"),
        Schema.Literal("stage"),
        Schema.Literal("variable"),
        Schema.Literal("billing"),
        Schema.Literal("auth"),
        Schema.Literal("cli"),
      ),
      occurredAtMs: Schema.Number,
      actorSource: Schema.Union(
        Schema.Literal("barekey_user"),
        Schema.Literal("system"),
        Schema.Literal("clerk"),
        Schema.Literal("cli"),
        Schema.Literal("api"),
      ),
      actorClerkUserId: Schema.NullOr(Schema.String),
      actorDisplayName: Schema.NullOr(Schema.String),
      actorEmail: Schema.NullOr(Schema.String),
      subjectType: Schema.Union(
        Schema.Literal("org"),
        Schema.Literal("project"),
        Schema.Literal("stage"),
        Schema.Literal("variable"),
        Schema.Literal("billing"),
        Schema.Literal("session"),
        Schema.Literal("user"),
      ),
      subjectId: Schema.NullOr(Schema.String),
      subjectName: Schema.NullOr(Schema.String),
      title: Schema.String,
      description: Schema.String,
      severity: Schema.Union(
        Schema.Literal("info"),
        Schema.Literal("warning"),
        Schema.Literal("error"),
      ),
      payloadJson: Schema.String,
      retentionTier: Schema.Union(
        Schema.Literal("free_30d"),
        Schema.Literal("pro_180d"),
        Schema.Literal("max_forever"),
      ),
      expiresAtMs: Schema.NullOr(Schema.Number),
    }),
  )
    .index("by_org_id_and_occurred_at_ms", ["orgId", "occurredAtMs"])
    .index("by_org_id_and_category_and_occurred_at_ms", ["orgId", "category", "occurredAtMs"])
    .index("by_org_id_and_project_slug_and_occurred_at_ms", [
      "orgId",
      "projectSlug",
      "occurredAtMs",
    ])
    .index("by_org_id_and_event_type_and_occurred_at_ms", ["orgId", "eventType", "occurredAtMs"])
    .index("by_expires_at_ms", ["expiresAtMs"]),
});

export type BarekeyConfectDataModel = ConfectDataModelFromConfectSchemaDefinition<
  typeof confectSchema
>;

export const BarekeyConfectQueryCtx = ConfectQueryCtx<BarekeyConfectDataModel>();
export const BarekeyConfectMutationCtx = ConfectMutationCtx<BarekeyConfectDataModel>();
export const BarekeyConfectActionCtx = ConfectActionCtx<BarekeyConfectDataModel>();
