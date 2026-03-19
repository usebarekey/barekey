import type { Id } from "../_generated/dataModel";
import { sanitizeAuditPayload, type AuditActorSource, type AuditCategory, type AuditRetentionTier, type AuditSeverity, type AuditSubjectType } from "../lib/audit";
import type { AuditEventRow } from "./types";

const VALID_AUDIT_CATEGORIES = new Set<AuditCategory>([
  "workspace",
  "project",
  "stage",
  "variable",
  "schedule",
  "membership",
  "invitation",
  "billing",
  "cli",
]);

const VALID_AUDIT_ACTOR_SOURCES = new Set<AuditActorSource>([
  "barekey_user",
  "clerk_webhook",
  "system",
  "scheduler",
  "cli",
]);

const VALID_AUDIT_SEVERITIES = new Set<AuditSeverity>(["info", "warning", "sensitive"]);

const VALID_AUDIT_SUBJECT_TYPES = new Set<AuditSubjectType>([
  "workspace",
  "project",
  "stage",
  "variable",
  "schedule",
  "membership",
  "invitation",
  "billing",
  "cli_session",
]);

const VALID_AUDIT_RETENTION_TIERS = new Set<AuditRetentionTier>([
  "free_30d",
  "pro_180d",
  "max_forever",
]);

/**
 * Safely parses audit payload JSON and falls back to a raw wrapper when parsing fails.
 *
 * @param value The serialized JSON payload.
 * @returns The parsed value, or a `{ raw }` wrapper when parsing fails.
 * @remarks This is used to keep audit ingestion tolerant of malformed payloads.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return {
      raw: value,
    };
  }
}

/**
 * Reads a nullable non-empty string from an unknown value.
 *
 * @param value The unknown value to inspect.
 * @returns The trimmed string-like value, or `null`.
 * @remarks Empty strings are normalized to `null` for audit shaping.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Reads a nullable finite number from an unknown value.
 *
 * @param value The unknown value to inspect.
 * @returns The numeric value when finite, or `null`.
 * @remarks This guards audit rows that were written before stronger validation existed.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function readOptionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Normalizes audit payload JSON into the sanitized canonical serialized form.
 *
 * @param value The raw payload value or payload JSON string.
 * @returns The sanitized canonical payload JSON string.
 * @remarks Strings are parsed first so legacy rows still benefit from payload sanitization.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function normalizePayloadJson(value: unknown): string {
  if (typeof value === "string") {
    return sanitizeAuditPayload(safeParseJson(value));
  }

  return sanitizeAuditPayload(value);
}

/**
 * Normalizes a stored audit row into the UI-facing event shape.
 *
 * @param row The raw audit row from Convex.
 * @returns The normalized event object used by audit queries and previews.
 * @remarks Invalid enum-like values are coerced back to safe defaults.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function toAuditEventRow(
  row: AuditEventRow & { _id: Id<"auditEvents">; _creationTime?: number },
) {
  const category =
    typeof row.category === "string" && VALID_AUDIT_CATEGORIES.has(row.category)
      ? row.category
      : "workspace";
  const actorSource =
    typeof row.actorSource === "string" && VALID_AUDIT_ACTOR_SOURCES.has(row.actorSource)
      ? row.actorSource
      : "system";
  const subjectType =
    typeof row.subjectType === "string" && VALID_AUDIT_SUBJECT_TYPES.has(row.subjectType)
      ? row.subjectType
      : "workspace";
  const severity =
    typeof row.severity === "string" && VALID_AUDIT_SEVERITIES.has(row.severity)
      ? row.severity
      : "info";
  const retentionTier =
    typeof row.retentionTier === "string" && VALID_AUDIT_RETENTION_TIERS.has(row.retentionTier)
      ? row.retentionTier
      : "free_30d";

  return {
    id: row._id,
    orgId: typeof row.orgId === "string" ? row.orgId : "",
    orgSlug: typeof row.orgSlug === "string" ? row.orgSlug : "",
    projectId: typeof row.projectId === "string" ? row.projectId : null,
    projectSlug: readOptionalString(row.projectSlug),
    stageSlug: readOptionalString(row.stageSlug),
    eventType: typeof row.eventType === "string" ? row.eventType : `${category}.event`,
    category,
    occurredAtMs: readOptionalNumber(row.occurredAtMs) ?? row._creationTime ?? Date.now(),
    actorSource,
    actorClerkUserId: readOptionalString(row.actorClerkUserId),
    actorDisplayName: readOptionalString(row.actorDisplayName),
    actorEmail: readOptionalString(row.actorEmail),
    subjectType,
    subjectId: readOptionalString(row.subjectId),
    subjectName: readOptionalString(row.subjectName),
    title: typeof row.title === "string" ? row.title : "Audit event",
    description:
      typeof row.description === "string"
        ? row.description
        : "No description was stored for this event.",
    severity,
    payloadJson: normalizePayloadJson(row.payloadJson),
    retentionTier,
    expiresAtMs: readOptionalNumber(row.expiresAtMs),
  };
}

/**
 * Reads a nullable non-empty string field from a record.
 *
 * @param input The record to inspect.
 * @param key The field name to read.
 * @returns The non-empty string field value, or `null`.
 * @remarks This is shared by Clerk webhook audit normalization helpers.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function readOptionalStringField(
  input: Record<string, unknown>,
  key: string,
): string | null {
  return readOptionalString(input[key]);
}
