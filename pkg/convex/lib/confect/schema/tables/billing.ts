import { defineTable } from "@rjdellecese/confect/server";
import { Schema } from "effect";

export const orgStorageUsage = defineTable(
  Schema.Struct({
    orgId: Schema.String,
    encryptedBytes: Schema.Number,
    createdAtMs: Schema.Number,
    updatedAtMs: Schema.Number,
  }),
).index("by_org_id", ["orgId"]);

export const orgBillingSnapshots = defineTable(
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
).index("by_org_id", ["orgId"]);

export const billingRequestLog = defineTable(
  Schema.Struct({
    orgId: Schema.String,
    requestKey: Schema.String,
    featureId: Schema.String,
    units: Schema.Number,
    createdAtMs: Schema.Number,
  }),
)
  .index("by_org_id_and_request_key", ["orgId", "requestKey"])
  .index("by_org_id_and_created_at_ms", ["orgId", "createdAtMs"]);
