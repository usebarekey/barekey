import type { ReactNode } from "react";

import {
  IconBolt,
  IconBriefcase,
  IconClockCog,
  IconCreditCard,
  IconKey,
  IconLayersIntersect,
  IconListDetails,
  IconShieldHalfFilled,
  IconUsers,
} from "@tabler/icons-react";

type AuditCategory =
  | "workspace"
  | "project"
  | "stage"
  | "variable"
  | "schedule"
  | "membership"
  | "invitation"
  | "billing"
  | "cli";

type AuditActorSource = "barekey_user" | "clerk_webhook" | "system" | "scheduler" | "cli";

export type AuditEventRow = {
  id: string;
  orgId: string;
  orgSlug: string;
  projectId: string | null;
  projectSlug: string | null;
  stageSlug: string | null;
  eventType: string;
  category: AuditCategory;
  occurredAtMs: number;
  actorSource: AuditActorSource;
  actorClerkUserId: string | null;
  actorDisplayName: string | null;
  actorEmail: string | null;
  subjectType: string;
  subjectId: string | null;
  subjectName: string | null;
  title: string;
  description: string;
  severity: "info" | "warning" | "sensitive";
  payloadJson: string;
  retentionTier: "free_30d" | "pro_180d" | "max_forever";
  expiresAtMs: number | null;
};

export const auditCategoryOptions: Array<{
  value: AuditCategory;
  label: string;
}> = [
  { value: "workspace", label: "Workspace" },
  { value: "project", label: "Project" },
  { value: "stage", label: "Stage" },
  { value: "variable", label: "Variable" },
  { value: "schedule", label: "Schedule" },
  { value: "membership", label: "Membership" },
  { value: "invitation", label: "Invitation" },
  { value: "billing", label: "Billing" },
  { value: "cli", label: "CLI" },
];

export const auditActorSourceOptions: Array<{
  value: AuditActorSource;
  label: string;
}> = [
  { value: "barekey_user", label: "Barekey user" },
  { value: "clerk_webhook", label: "Clerk webhook" },
  { value: "system", label: "System" },
  { value: "scheduler", label: "Scheduler" },
  { value: "cli", label: "CLI" },
];

export function formatAuditActor(event: AuditEventRow): string {
  return (
    event.actorDisplayName ??
    event.actorEmail ??
    (event.actorSource === "barekey_user"
      ? "Workspace member"
      : event.actorSource === "clerk_webhook"
        ? "Clerk"
        : event.actorSource === "scheduler"
          ? "Scheduler"
          : event.actorSource === "cli"
            ? "CLI"
            : "System")
  );
}

export function getAuditCategoryLabel(category: AuditCategory): string {
  return auditCategoryOptions.find((option) => option.value === category)?.label ?? category;
}

export function getAuditActorSourceLabel(source: AuditActorSource): string {
  return auditActorSourceOptions.find((option) => option.value === source)?.label ?? source;
}

export function getAuditEventIcon(category: AuditCategory): ReactNode {
  const className = "size-4";
  switch (category) {
    case "workspace":
      return <IconLayersIntersect className={className} />;
    case "project":
      return <IconBriefcase className={className} />;
    case "stage":
      return <IconListDetails className={className} />;
    case "variable":
      return <IconKey className={className} />;
    case "schedule":
      return <IconClockCog className={className} />;
    case "membership":
    case "invitation":
      return <IconUsers className={className} />;
    case "billing":
      return <IconCreditCard className={className} />;
    case "cli":
      return <IconBolt className={className} />;
  }
}

export function formatAuditRelativeTime(timestampMs: number): string {
  const diffMs = timestampMs - Date.now();
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const absSeconds = Math.abs(diffMs) / 1000;
  if (absSeconds < 60) {
    return rtf.format(Math.round(diffMs / 1000), "second");
  }
  const absMinutes = absSeconds / 60;
  if (absMinutes < 60) {
    return rtf.format(Math.round(diffMs / 60_000), "minute");
  }
  const absHours = absMinutes / 60;
  if (absHours < 24) {
    return rtf.format(Math.round(diffMs / 3_600_000), "hour");
  }
  const absDays = absHours / 24;
  if (absDays < 30) {
    return rtf.format(Math.round(diffMs / 86_400_000), "day");
  }
  const absMonths = absDays / 30;
  if (absMonths < 12) {
    return rtf.format(Math.round(diffMs / (30 * 86_400_000)), "month");
  }
  return rtf.format(Math.round(diffMs / (365 * 86_400_000)), "year");
}

export function formatAuditAbsoluteTime(timestampMs: number): string {
  return new Date(timestampMs).toLocaleString();
}

export function parseAuditPayload(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export function hasAuditPayload(event: AuditEventRow): boolean {
  const payload = parseAuditPayload(event.payloadJson);
  return payload !== null && Object.keys(payload).length > 0;
}

export function getAuditSeverityBadgeLabel(severity: AuditEventRow["severity"]): string {
  if (severity === "sensitive") {
    return "Sensitive";
  }
  if (severity === "warning") {
    return "Warning";
  }
  return "Info";
}

export function getAuditSeverityTone(severity: AuditEventRow["severity"]): "default" | "outline" | "secondary" {
  if (severity === "sensitive") {
    return "default";
  }
  if (severity === "warning") {
    return "secondary";
  }
  return "outline";
}

export function getAuditEmptyStateLabel(): ReactNode {
  return (
    <>
      Events will appear here once workspace activity starts flowing through project changes,
      schedules, billing, and membership actions.
    </>
  );
}

export function getAuditSeverityIcon(severity: AuditEventRow["severity"]): ReactNode {
  if (severity === "sensitive") {
    return <IconShieldHalfFilled className="size-4" />;
  }
  if (severity === "warning") {
    return <IconClockCog className="size-4" />;
  }
  return null;
}

/**
 * Converts a camelCase or snake_case payload key into a human-readable label.
 * Strips common noise suffixes like "Id" and "Slug" that aren't meaningful to users.
 */
export function formatPayloadKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ");

  const trimmed = spaced
    .replace(/\s+id$/i, "")
    .replace(/\s+slug$/i, "");

  const label = trimmed.length > 0 ? trimmed : spaced;
  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
}

/**
 * Formats a payload value for display. Converts snake_case identifiers
 * into readable text and capitalises the first word.
 */
export function formatPayloadValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "number") {
    return value.toLocaleString();
  }
  if (typeof value !== "string") {
    return JSON.stringify(value, null, 2);
  }

  if (/^[a-z0-9]+(_[a-z0-9]+)+$/.test(value)) {
    const spaced = value.replace(/_/g, " ");
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }

  return value;
}
