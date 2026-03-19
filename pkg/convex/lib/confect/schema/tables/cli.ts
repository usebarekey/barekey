import { defineTable } from "@rjdellecese/confect/server";
import { Schema } from "effect";

export const cliDeviceCodes = defineTable(
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
  .index("by_status_and_expires_at_ms", ["status", "expiresAtMs"]);

export const cliSessions = defineTable(
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
  .index("by_clerk_user_id_and_org_id", ["clerkUserId", "orgId"]);
