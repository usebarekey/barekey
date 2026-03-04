import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
    .index("by_org_id_and_slug", ["orgId", "slug"]),
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
    kind: v.literal("secret"),
    encryptedValue: v.string(),
    createdByClerkUserId: v.string(),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  })
    .index("by_project_id_and_stage_slug", ["projectId", "stageSlug"])
    .index("by_project_id_and_stage_slug_and_name", ["projectId", "stageSlug", "name"])
    .index("by_org_id_and_project_id", ["orgId", "projectId"]),
});
