import { Either, Schema } from "effect";
import { v } from "convex/values";

export const auditCategoryValidator = v.union(
  v.literal("workspace"),
  v.literal("project"),
  v.literal("stage"),
  v.literal("variable"),
  v.literal("schedule"),
  v.literal("membership"),
  v.literal("invitation"),
  v.literal("billing"),
  v.literal("cli"),
);

export const auditActorSourceValidator = v.union(
  v.literal("barekey_user"),
  v.literal("clerk_webhook"),
  v.literal("system"),
  v.literal("scheduler"),
  v.literal("cli"),
);

export const auditSeverityValidator = v.union(
  v.literal("info"),
  v.literal("warning"),
  v.literal("sensitive"),
);

export const auditSubjectTypeValidator = v.union(
  v.literal("workspace"),
  v.literal("project"),
  v.literal("stage"),
  v.literal("variable"),
  v.literal("schedule"),
  v.literal("membership"),
  v.literal("invitation"),
  v.literal("billing"),
  v.literal("cli_session"),
);

export const auditRetentionTierValidator = v.union(
  v.literal("free_30d"),
  v.literal("pro_180d"),
  v.literal("max_forever"),
);

export type AuditCategory =
  | "workspace"
  | "project"
  | "stage"
  | "variable"
  | "schedule"
  | "membership"
  | "invitation"
  | "billing"
  | "cli";

export type AuditActorSource = "barekey_user" | "clerk_webhook" | "system" | "scheduler" | "cli";

export type AuditSeverity = "info" | "warning" | "sensitive";

export type AuditSubjectType =
  | "workspace"
  | "project"
  | "stage"
  | "variable"
  | "schedule"
  | "membership"
  | "invitation"
  | "billing"
  | "cli_session";

export type AuditRetentionTier = "free_30d" | "pro_180d" | "max_forever";

type JsonLike =
  | null
  | boolean
  | number
  | string
  | ReadonlyArray<JsonLike>
  | {
      [key: string]: JsonLike;
    };

const SECRETISH_KEY_PATTERN =
  /(value|secret|cipher|encrypt|decrypt|plaintext|payload|token|rolloutmilestones|rolloutfunction)/i;

const auditJsonPrimitiveSchema = Schema.Union(
  Schema.Null,
  Schema.Boolean,
  Schema.Finite,
  Schema.String,
);
const auditJsonUnknownArraySchema = Schema.Array(Schema.Unknown);
const auditJsonUnknownRecordSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
});
const auditJsonLikeSchema: Schema.Schema<JsonLike> = Schema.suspend(() =>
  Schema.Union(
    auditJsonPrimitiveSchema,
    Schema.Array(auditJsonLikeSchema),
    Schema.Record({
      key: Schema.String,
      value: auditJsonLikeSchema,
    }),
  ),
);

function sanitizeTypedAuditValue(value: JsonLike): JsonLike {
  const decodedArray = Schema.decodeUnknownEither(Schema.Array(auditJsonLikeSchema))(value);
  if (Either.isRight(decodedArray)) {
    return decodedArray.right.map((entry) => sanitizeTypedAuditValue(entry));
  }

  const decodedRecord = Schema.decodeUnknownEither(
    Schema.Record({
      key: Schema.String,
      value: auditJsonLikeSchema,
    }),
  )(value);
  if (Either.isRight(decodedRecord)) {
    const sanitized: Record<string, JsonLike> = {};
    for (const key in decodedRecord.right) {
      if (SECRETISH_KEY_PATTERN.test(key)) {
        continue;
      }
      sanitized[key] = sanitizeTypedAuditValue(decodedRecord.right[key]);
    }
    return sanitized;
  }

  return value;
}

function sanitizeUnknownAuditValue(value: unknown): JsonLike {
  const decodedJson = Schema.decodeUnknownEither(auditJsonLikeSchema)(value);
  if (Either.isRight(decodedJson)) {
    return sanitizeTypedAuditValue(decodedJson.right);
  }

  const decodedArray = Schema.decodeUnknownEither(auditJsonUnknownArraySchema)(value);
  if (Either.isRight(decodedArray)) {
    return decodedArray.right.map((entry) => sanitizeUnknownAuditValue(entry));
  }

  const decodedRecord = Schema.decodeUnknownEither(auditJsonUnknownRecordSchema)(value);
  if (Either.isRight(decodedRecord)) {
    const sanitized: Record<string, JsonLike> = {};
    for (const key in decodedRecord.right) {
      if (SECRETISH_KEY_PATTERN.test(key)) {
        continue;
      }
      sanitized[key] = sanitizeUnknownAuditValue(decodedRecord.right[key]);
    }
    return sanitized;
  }

  return String(value);
}

export function sanitizeAuditPayload(payload: unknown): string {
  return JSON.stringify(sanitizeUnknownAuditValue(payload));
}

export function retentionTierFromCurrentTier(
  currentTier: "free" | "pro" | "max" | null,
): AuditRetentionTier {
  if (currentTier === "max") {
    return "max_forever";
  }
  if (currentTier === "pro") {
    return "pro_180d";
  }
  return "free_30d";
}

export function expiresAtMsForRetention(
  retentionTier: AuditRetentionTier,
  occurredAtMs: number,
): number | null {
  if (retentionTier === "max_forever") {
    return null;
  }

  const retentionDays = retentionTier === "pro_180d" ? 180 : 30;
  return occurredAtMs + retentionDays * 24 * 60 * 60 * 1000;
}
