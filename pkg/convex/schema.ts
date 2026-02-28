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
});
