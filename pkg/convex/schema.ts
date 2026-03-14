import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import { declaredTypeValidator } from "./lib/declared_types";
import {
  projectVariablePreparedCreateValidator,
  projectVariablePreparedUpdateValidator,
  projectVariableScheduleStatusValidator,
  projectVariableScheduleUpdateTargetValidator,
} from "./lib/project_variable_schedules";
import { rolloutFunctionValidator, rolloutMilestoneValidator } from "./lib/rollout";
import { variableVisibilityValidator } from "./lib/visibility";

export default defineSchema({
  users: defineTable({
    clerkUserId: v.string(),
    slug: v.string(),
    slugBase: v.string(),
    email: v.union(v.string(), v.null()),
    displayName: v.union(v.string(), v.null()),
    imageUrl: v.union(v.string(), v.null()),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
    lastSeenAtMs: v.number(),
  })
    .index("by_clerk_user_id", ["clerkUserId"])
    .index("by_slug", ["slug"]),
  userFreePlanCredits: defineTable({
    clerkUserId: v.string(),
    totalCredits: v.number(),
    remainingCredits: v.number(),
    assignedOrgId: v.union(v.string(), v.null()),
    assignedOrgSlug: v.union(v.string(), v.null()),
    consumedAtMs: v.union(v.number(), v.null()),
    revokedAtMs: v.union(v.number(), v.null()),
    revokedReason: v.union(v.string(), v.null()),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  })
    .index("by_clerk_user_id", ["clerkUserId"])
    .index("by_assigned_org_id", ["assignedOrgId"]),
  userPreferences: defineTable({
    clerkUserId: v.string(),
    preferredTheme: v.union(v.literal("system"), v.literal("light"), v.literal("dark")),
    defaultOrgSlug: v.union(v.string(), v.null()),
    landingPreference: v.union(v.literal("account_overview"), v.literal("default_workspace")),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  }).index("by_clerk_user_id", ["clerkUserId"]),
  projects: defineTable({
    orgId: v.string(),
    orgSlug: v.string(),
    name: v.string(),
    slug: v.string(),
    slugBase: v.string(),
    createdByClerkUserId: v.string(),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  })
    .index("by_org_id", ["orgId"])
    .index("by_org_id_and_created_at_ms", ["orgId", "createdAtMs"])
    .index("by_org_id_and_slug", ["orgId", "slug"])
    .index("by_org_slug_and_slug", ["orgSlug", "slug"]),
  projectStages: defineTable({
    projectId: v.id("projects"),
    orgId: v.string(),
    slug: v.string(),
    name: v.string(),
    isDefault: v.boolean(),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  })
    .index("by_project_id", ["projectId"])
    .index("by_project_id_and_slug", ["projectId", "slug"])
    .index("by_org_id_and_project_id", ["orgId", "projectId"]),
  projectKeys: defineTable({
    projectId: v.id("projects"),
    orgId: v.string(),
    encryptedDek: v.string(),
    dekVersion: v.number(),
    rotatedAtMs: v.number(),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  })
    .index("by_project_id", ["projectId"])
    .index("by_org_id_and_project_id", ["orgId", "projectId"]),
  projectVariables: defineTable({
    projectId: v.id("projects"),
    orgId: v.string(),
    stageSlug: v.string(),
    name: v.string(),
    visibility: v.optional(variableVisibilityValidator),
    kind: v.union(v.literal("secret"), v.literal("ab_roll"), v.literal("rollout")),
    declaredType: v.optional(declaredTypeValidator),
    encryptedValue: v.union(v.string(), v.null()),
    encryptedValueA: v.union(v.string(), v.null()),
    encryptedValueB: v.union(v.string(), v.null()),
    chance: v.union(v.number(), v.null()),
    rolloutFunction: v.optional(v.union(rolloutFunctionValidator, v.null())),
    rolloutMilestones: v.optional(v.union(v.array(rolloutMilestoneValidator), v.null())),
    createdByClerkUserId: v.string(),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  })
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
  projectVariableSchedules: defineTable({
    projectId: v.id("projects"),
    orgId: v.string(),
    stageSlug: v.string(),
    timezone: v.string(),
    runAtMs: v.number(),
    status: projectVariableScheduleStatusValidator,
    scheduledFunctionId: v.union(v.id("_scheduled_functions"), v.null()),
    preparedCreates: v.array(projectVariablePreparedCreateValidator),
    preparedUpdates: v.array(projectVariablePreparedUpdateValidator),
    updateTargets: v.array(projectVariableScheduleUpdateTargetValidator),
    createdCount: v.number(),
    updatedCount: v.number(),
    createdByClerkUserId: v.string(),
    updatedByClerkUserId: v.string(),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
    executedAtMs: v.union(v.number(), v.null()),
    canceledAtMs: v.union(v.number(), v.null()),
    failedAtMs: v.union(v.number(), v.null()),
    failureMessage: v.union(v.string(), v.null()),
  })
    .index("by_project_id", ["projectId"])
    .index("by_project_id_and_stage_slug", ["projectId", "stageSlug"])
    .index("by_project_id_and_status", ["projectId", "status"])
    .index("by_project_id_and_run_at_ms", ["projectId", "runAtMs"])
    .index("by_org_id_and_project_id", ["orgId", "projectId"]),
  orgStorageUsage: defineTable({
    orgId: v.string(),
    encryptedBytes: v.number(),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  }).index("by_org_id", ["orgId"]),
  billingRequestLog: defineTable({
    orgId: v.string(),
    requestKey: v.string(),
    featureId: v.string(),
    units: v.number(),
    createdAtMs: v.number(),
  })
    .index("by_org_id_and_request_key", ["orgId", "requestKey"])
    .index("by_org_id_and_created_at_ms", ["orgId", "createdAtMs"]),
  cliDeviceCodes: defineTable({
    deviceCodeHash: v.string(),
    userCode: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("exchanged"),
      v.literal("expired"),
    ),
    clientName: v.union(v.string(), v.null()),
    approvedAtMs: v.union(v.number(), v.null()),
    approvedByClerkUserId: v.union(v.string(), v.null()),
    approvedOrgId: v.union(v.string(), v.null()),
    approvedOrgSlug: v.union(v.string(), v.null()),
    exchangedAtMs: v.union(v.number(), v.null()),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
    expiresAtMs: v.number(),
    intervalSec: v.number(),
  })
    .index("by_device_code_hash", ["deviceCodeHash"])
    .index("by_user_code_and_status", ["userCode", "status"])
    .index("by_status_and_expires_at_ms", ["status", "expiresAtMs"]),
  cliSessions: defineTable({
    sessionId: v.string(),
    clerkUserId: v.string(),
    orgId: v.string(),
    orgSlug: v.string(),
    accessTokenHash: v.string(),
    refreshTokenHash: v.string(),
    accessTokenExpiresAtMs: v.number(),
    refreshTokenExpiresAtMs: v.number(),
    revokedAtMs: v.union(v.number(), v.null()),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
    lastUsedAtMs: v.number(),
  })
    .index("by_session_id", ["sessionId"])
    .index("by_access_token_hash", ["accessTokenHash"])
    .index("by_refresh_token_hash", ["refreshTokenHash"])
    .index("by_clerk_user_id_and_org_id", ["clerkUserId", "orgId"]),
});
