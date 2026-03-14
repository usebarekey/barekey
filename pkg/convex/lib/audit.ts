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
  | Array<JsonLike>
  | {
      [key: string]: JsonLike;
    };

const SECRETISH_KEY_PATTERN =
  /(value|secret|cipher|encrypt|decrypt|plaintext|payload|token|rolloutmilestones|rolloutfunction)/i;

function normalizeJsonLike(value: unknown): JsonLike {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeJsonLike(entry));
  }

  if (typeof value === "object") {
    const result: Record<string, JsonLike> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (SECRETISH_KEY_PATTERN.test(key)) {
        continue;
      }
      result[key] = normalizeJsonLike(entry);
    }
    return result;
  }

  return String(value);
}

export function sanitizeAuditPayload(payload: unknown): string {
  return JSON.stringify(normalizeJsonLike(payload));
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
