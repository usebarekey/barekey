import { defineTable, Id } from "@rjdellecese/confect/server";
import { Schema } from "effect";

export const auditEvents = defineTable(
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
  .index("by_expires_at_ms", ["expiresAtMs"]);
