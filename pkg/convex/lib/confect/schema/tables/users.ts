import { defineTable } from "@rjdellecese/confect/server";
import { Schema } from "effect";

export const users = defineTable(
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
  .index("by_slug", ["slug"]);

export const userFreePlanCredits = defineTable(
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
  .index("by_assigned_org_id", ["assignedOrgId"]);

export const userPreferences = defineTable(
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
).index("by_clerk_user_id", ["clerkUserId"]);
