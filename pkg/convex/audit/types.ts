import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import {
  auditActorSourceValidator,
  auditCategoryValidator,
  auditRetentionTierValidator,
  auditSeverityValidator,
  auditSubjectTypeValidator,
  type AuditActorSource,
  type AuditCategory,
  type AuditRetentionTier,
  type AuditSeverity,
  type AuditSubjectType,
} from "../lib/audit";

export const appendAuditEventArgsFields = {
  orgId: v.string(),
  orgSlug: v.string(),
  projectId: v.union(v.id("projects"), v.null()),
  projectSlug: v.union(v.string(), v.null()),
  stageSlug: v.union(v.string(), v.null()),
  eventType: v.string(),
  category: auditCategoryValidator,
  actorSource: auditActorSourceValidator,
  actorClerkUserId: v.union(v.string(), v.null()),
  actorDisplayName: v.union(v.string(), v.null()),
  actorEmail: v.union(v.string(), v.null()),
  subjectType: auditSubjectTypeValidator,
  subjectId: v.union(v.string(), v.null()),
  subjectName: v.union(v.string(), v.null()),
  title: v.string(),
  description: v.string(),
  severity: auditSeverityValidator,
  payloadJson: v.string(),
  retentionTierOverride: v.optional(v.union(auditRetentionTierValidator, v.null())),
  occurredAtMs: v.optional(v.number()),
} as const;

export const appendAuditEventArgsValidator = v.object(appendAuditEventArgsFields);

export type AuditEventInput = {
  orgId: string;
  orgSlug: string;
  projectId: Id<"projects"> | null;
  projectSlug: string | null;
  stageSlug: string | null;
  eventType: string;
  category: AuditCategory;
  actorSource: AuditActorSource;
  actorClerkUserId: string | null;
  actorDisplayName: string | null;
  actorEmail: string | null;
  subjectType: AuditSubjectType;
  subjectId: string | null;
  subjectName: string | null;
  title: string;
  description: string;
  severity: AuditSeverity;
  payloadJson: string;
  retentionTierOverride?: AuditRetentionTier | null;
  occurredAtMs?: number;
};

export type AuditEventRow = Doc<"auditEvents">;

export type AuditListArgs = {
  orgId: string;
  beforeOccurredAtMs: number | null;
  limit: number;
  category: AuditCategory | null;
  projectSlug: string | null;
  actorSource: AuditActorSource | null;
  sensitiveOnly: boolean;
};
