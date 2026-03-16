import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  query,
} from "./confect";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  auditActorSourceValidator,
  auditCategoryValidator,
  auditRetentionTierValidator,
  auditSeverityValidator,
  auditSubjectTypeValidator,
  expiresAtMsForRetention,
  retentionTierFromCurrentTier,
  sanitizeAuditPayload,
  type AuditActorSource,
  type AuditCategory,
  type AuditRetentionTier,
  type AuditSeverity,
  type AuditSubjectType,
} from "./lib/audit";
import {
  getActiveOrgIdClaimsOrNull,
} from "./lib/auth";

const appendAuditEventArgsValidator = v.object({
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
});

type AuditEventInput = {
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

type AuditEventRow = Doc<"auditEvents">;

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

type AuditListArgs = {
  orgId: string;
  beforeOccurredAtMs: number | null;
  limit: number;
  category: AuditCategory | null;
  projectSlug: string | null;
  actorSource: AuditActorSource | null;
  sensitiveOnly: boolean;
};

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return {
      raw: value,
    };
  }
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readOptionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizePayloadJson(value: unknown): string {
  if (typeof value === "string") {
    return sanitizeAuditPayload(safeParseJson(value));
  }

  return sanitizeAuditPayload(value);
}

function toAuditEventRow(row: AuditEventRow & { _id: Id<"auditEvents">; _creationTime?: number }) {
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

async function findCanonicalUserByClerkUserId(
  ctx: QueryCtx | MutationCtx,
  clerkUserId: string,
): Promise<Doc<"users"> | null> {
  const rows = await ctx.db
    .query("users")
    .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
    .collect();
  return rows.sort((left, right) => left.createdAtMs - right.createdAtMs)[0] ?? null;
}

async function readRetentionTierForOrg(
  ctx: MutationCtx,
  args: {
    orgId: string;
    retentionTierOverride?: AuditRetentionTier | null;
  },
): Promise<AuditRetentionTier> {
  if (args.retentionTierOverride) {
    return args.retentionTierOverride;
  }

  const snapshot = await ctx.db
    .query("orgBillingSnapshots")
    .withIndex("by_org_id", (q) => q.eq("orgId", args.orgId))
    .unique();

  return retentionTierFromCurrentTier(snapshot?.currentTier ?? null);
}

async function insertAuditEvent(
  ctx: MutationCtx,
  args: AuditEventInput,
): Promise<Id<"auditEvents">> {
  const actorRecord =
    args.actorClerkUserId === null
      ? null
      : await findCanonicalUserByClerkUserId(ctx, args.actorClerkUserId);
  const occurredAtMs = args.occurredAtMs ?? Date.now();
  const retentionTier = await readRetentionTierForOrg(ctx, args);
  const payloadJson = sanitizeAuditPayload(safeParseJson(args.payloadJson));

  return await ctx.db.insert("auditEvents", {
    orgId: args.orgId,
    orgSlug: args.orgSlug,
    projectId: args.projectId,
    projectSlug: args.projectSlug,
    stageSlug: args.stageSlug,
    eventType: args.eventType,
    category: args.category,
    occurredAtMs,
    actorSource: args.actorSource,
    actorClerkUserId: args.actorClerkUserId,
    actorDisplayName: args.actorDisplayName ?? actorRecord?.displayName ?? null,
    actorEmail: args.actorEmail ?? actorRecord?.email ?? null,
    subjectType: args.subjectType,
    subjectId: args.subjectId,
    subjectName: args.subjectName,
    title: args.title,
    description: args.description,
    severity: args.severity,
    payloadJson,
    retentionTier,
    expiresAtMs: expiresAtMsForRetention(retentionTier, occurredAtMs),
  });
}

async function collectAuditEventsPage(
  ctx: QueryCtx,
  args: AuditListArgs,
): Promise<{
  items: Array<AuditEventRow>;
  hasMore: boolean;
}> {
  const batchSize = Math.min(Math.max(args.limit * 3, 24), 120);
  const items: Array<AuditEventRow> = [];
  let cursor = args.beforeOccurredAtMs;
  let hasMore = false;

  for (let attempt = 0; attempt < 5 && items.length < args.limit; attempt += 1) {
    let queryBuilder;
    if (args.projectSlug !== null) {
      queryBuilder = ctx.db
        .query("auditEvents")
        .withIndex("by_org_id_and_project_slug_and_occurred_at_ms", (q) => {
          const scoped = q.eq("orgId", args.orgId).eq("projectSlug", args.projectSlug);
          return cursor === null ? scoped : scoped.lt("occurredAtMs", cursor);
        });
    } else if (args.category !== null) {
      const category = args.category;
      queryBuilder = ctx.db
        .query("auditEvents")
        .withIndex("by_org_id_and_category_and_occurred_at_ms", (q) => {
          const scoped = q.eq("orgId", args.orgId).eq("category", category);
          return cursor === null ? scoped : scoped.lt("occurredAtMs", cursor);
        });
    } else {
      queryBuilder = ctx.db
        .query("auditEvents")
        .withIndex("by_org_id_and_occurred_at_ms", (q) => {
          const scoped = q.eq("orgId", args.orgId);
          return cursor === null ? scoped : scoped.lt("occurredAtMs", cursor);
        });
    }

    const batch = await queryBuilder.order("desc").take(batchSize);
    if (batch.length === 0) {
      break;
    }

    const filtered = batch.filter((row) => {
      if (args.category !== null && row.category !== args.category) {
        return false;
      }
      if (args.projectSlug !== null && row.projectSlug !== args.projectSlug) {
        return false;
      }
      if (args.actorSource !== null && row.actorSource !== args.actorSource) {
        return false;
      }
      if (args.sensitiveOnly && row.severity !== "sensitive") {
        return false;
      }
      return true;
    });

    for (const row of filtered) {
      if (items.length >= args.limit) {
        hasMore = true;
        break;
      }
      items.push(row);
    }

    if (items.length >= args.limit) {
      break;
    }

    if (batch.length < batchSize) {
      break;
    }

    hasMore = true;
    cursor = batch[batch.length - 1]?.occurredAtMs ?? null;
  }

  return {
    items,
    hasMore,
  };
}

export const appendEventInternal = internalMutation({
  args: appendAuditEventArgsValidator,
  returns: v.id("auditEvents"),
  handler: async (ctx, args) => await insertAuditEvent(ctx, args),
});

export const appendEventsInternal = internalMutation({
  args: {
    events: v.array(appendAuditEventArgsValidator),
  },
  returns: v.array(v.id("auditEvents")),
  handler: async (ctx, args) => {
    const ids: Array<Id<"auditEvents">> = [];
    for (const event of args.events) {
      const id = await insertAuditEvent(ctx, event);
      ids.push(id);
    }
    return ids;
  },
});

export const listEventsForCurrentOrg = query({
  args: {
    expectedOrgSlug: v.string(),
    beforeOccurredAtMs: v.union(v.number(), v.null()),
    limit: v.number(),
    category: v.union(auditCategoryValidator, v.null()),
    projectSlug: v.union(v.string(), v.null()),
    actorSource: v.union(auditActorSourceValidator, v.null()),
    sensitiveOnly: v.boolean(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    try {
      const identity = await ctx.auth.getUserIdentity();
      if (identity === null) {
        return {
          items: [],
          nextBeforeOccurredAtMs: null,
          hasMore: false,
        };
      }

      const activeOrg = getActiveOrgIdClaimsOrNull(identity);
      if (activeOrg === null) {
        return {
          items: [],
          nextBeforeOccurredAtMs: null,
          hasMore: false,
        };
      }

      if (activeOrg.orgSlug !== null && activeOrg.orgSlug !== args.expectedOrgSlug) {
        return {
          items: [],
          nextBeforeOccurredAtMs: null,
          hasMore: false,
        };
      }

      const page = await collectAuditEventsPage(ctx, {
        orgId: activeOrg.orgId,
        beforeOccurredAtMs: args.beforeOccurredAtMs,
        limit: Math.min(Math.max(args.limit, 1), 50),
        category: args.category,
        projectSlug: args.projectSlug,
        actorSource: args.actorSource,
        sensitiveOnly: args.sensitiveOnly,
      });

      return {
        items: page.items.map(toAuditEventRow),
        nextBeforeOccurredAtMs: page.items[page.items.length - 1]?.occurredAtMs ?? null,
        hasMore: page.hasMore,
      };
    } catch {
      return {
        items: [],
        nextBeforeOccurredAtMs: null,
        hasMore: false,
      };
    }
  },
});

export const listEventsForCurrentOrgProject = query({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
    beforeOccurredAtMs: v.union(v.number(), v.null()),
    limit: v.number(),
    category: v.union(auditCategoryValidator, v.null()),
    actorSource: v.union(auditActorSourceValidator, v.null()),
    sensitiveOnly: v.boolean(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    try {
      const identity = await ctx.auth.getUserIdentity();
      if (identity === null) {
        return {
          items: [],
          nextBeforeOccurredAtMs: null,
          hasMore: false,
        };
      }

      const activeOrg = getActiveOrgIdClaimsOrNull(identity);
      if (activeOrg === null || activeOrg.orgSlug !== args.expectedOrgSlug) {
        return {
          items: [],
          nextBeforeOccurredAtMs: null,
          hasMore: false,
        };
      }

      const page = await collectAuditEventsPage(ctx, {
        orgId: activeOrg.orgId,
        beforeOccurredAtMs: args.beforeOccurredAtMs,
        limit: Math.min(Math.max(args.limit, 1), 50),
        category: args.category,
        projectSlug: args.projectSlug,
        actorSource: args.actorSource,
        sensitiveOnly: args.sensitiveOnly,
      });

      return {
        items: page.items.map(toAuditEventRow),
        nextBeforeOccurredAtMs: page.items[page.items.length - 1]?.occurredAtMs ?? null,
        hasMore: page.hasMore,
      };
    } catch {
      return {
        items: [],
        nextBeforeOccurredAtMs: null,
        hasMore: false,
      };
    }
  },
});

export const pruneExpiredEventsBatchInternal = internalMutation({
  args: {
    nowMs: v.number(),
    batchSize: v.number(),
  },
  returns: v.object({
    deletedCount: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("auditEvents")
      .withIndex("by_expires_at_ms", (q) => q.lt("expiresAtMs", args.nowMs))
      .take(Math.min(Math.max(args.batchSize, 1), 500));

    for (const row of rows) {
      await ctx.db.delete(row._id);
    }

    return {
      deletedCount: rows.length,
      hasMore: rows.length === Math.min(Math.max(args.batchSize, 1), 500),
    };
  },
});

export const pruneExpiredEventsInternal = internalAction({
  args: {},
  returns: v.object({
    deletedCount: v.number(),
  }),
  handler: async (ctx) => {
    let deletedCount = 0;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const batch = await ctx.runMutation(internal.audit.pruneExpiredEventsBatchInternal, {
        nowMs: Date.now(),
        batchSize: 250,
      });
      deletedCount += batch.deletedCount;
      if (!batch.hasMore) {
        break;
      }
    }

    return {
      deletedCount,
    };
  },
});

export const getPreviewEventsForCurrentOrg = query({
  args: {
    expectedOrgSlug: v.string(),
    limit: v.number(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    try {
      const identity = await ctx.auth.getUserIdentity();
      if (identity === null) {
        return [];
      }
      const activeOrg = getActiveOrgIdClaimsOrNull(identity);
      if (activeOrg === null || activeOrg.orgSlug !== args.expectedOrgSlug) {
        return [];
      }
      const page = await collectAuditEventsPage(ctx, {
        orgId: activeOrg.orgId,
        beforeOccurredAtMs: null,
        limit: Math.min(Math.max(args.limit, 1), 10),
        category: null,
        projectSlug: null,
        actorSource: null,
        sensitiveOnly: false,
      });
      return page.items.map(toAuditEventRow);
    } catch {
      return [];
    }
  },
});

function readOptionalStringField(
  input: Record<string, unknown>,
  key: string,
): string | null {
  const value = input[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readOrgInfoFromClerkWebhook(data: Record<string, unknown>): {
  orgId: string;
  orgSlug: string;
  orgName: string | null;
} | null {
  const organization =
    typeof data.organization === "object" && data.organization !== null
      ? (data.organization as Record<string, unknown>)
      : null;
  if (organization !== null) {
    const orgId = readOptionalStringField(organization, "id");
    const orgSlug = readOptionalStringField(organization, "slug");
    if (orgId !== null && orgSlug !== null) {
      return {
        orgId,
        orgSlug,
        orgName: readOptionalStringField(organization, "name"),
      };
    }
  }

  const publicOrg =
    typeof data.public_organization_data === "object" && data.public_organization_data !== null
      ? (data.public_organization_data as Record<string, unknown>)
      : null;
  if (publicOrg !== null) {
    const orgId = readOptionalStringField(data, "organization_id");
    const orgSlug = readOptionalStringField(publicOrg, "slug");
    if (orgId !== null && orgSlug !== null) {
      return {
        orgId,
        orgSlug,
        orgName: readOptionalStringField(publicOrg, "name"),
      };
    }
  }

  const orgId = readOptionalStringField(data, "id") ?? readOptionalStringField(data, "organization_id");
  const orgSlug = readOptionalStringField(data, "slug") ?? orgId;
  if (orgId === null || orgSlug === null) {
    return null;
  }

  return {
    orgId,
    orgSlug,
    orgName: readOptionalStringField(data, "name"),
  };
}

function readMembershipSubject(data: Record<string, unknown>): {
  userId: string | null;
  identifier: string | null;
  displayName: string | null;
} {
  const publicUser =
    typeof data.public_user_data === "object" && data.public_user_data !== null
      ? (data.public_user_data as Record<string, unknown>)
      : null;
  if (publicUser === null) {
    return {
      userId: null,
      identifier: null,
      displayName: null,
    };
  }

  const firstName = readOptionalStringField(publicUser, "first_name");
  const lastName = readOptionalStringField(publicUser, "last_name");
  const displayName =
    [firstName, lastName].filter((value) => value !== null).join(" ").trim() || null;

  return {
    userId: readOptionalStringField(publicUser, "user_id"),
    identifier: readOptionalStringField(publicUser, "identifier"),
    displayName,
  };
}

export const ingestClerkWebhookEventInternal = internalAction({
  args: {
    payloadJson: v.string(),
  },
  returns: v.object({
    accepted: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const event = safeParseJson(args.payloadJson);
    if (typeof event !== "object" || event === null) {
      return {
        accepted: false,
      };
    }

    const payload = event as Record<string, unknown>;
    const type = readOptionalStringField(payload, "type");
    const rawData =
      typeof payload.data === "object" && payload.data !== null
        ? (payload.data as Record<string, unknown>)
        : null;
    if (type === null || rawData === null) {
      return {
        accepted: false,
      };
    }

    const org = readOrgInfoFromClerkWebhook(rawData);
    if (org === null) {
      console.warn("Dropping Clerk webhook audit event without resolvable organization.", {
        type,
      });
      return {
        accepted: false,
      };
    }

    let input: AuditEventInput | null = null;
    if (type === "organization.created" || type === "organization.updated" || type === "organization.deleted") {
      const isDeleted = type === "organization.deleted";
      input = {
        orgId: org.orgId,
        orgSlug: org.orgSlug,
        projectId: null,
        projectSlug: null,
        stageSlug: null,
        eventType: type.replace("organization", "workspace"),
        category: "workspace",
        actorSource: "clerk_webhook",
        actorClerkUserId: readOptionalStringField(rawData, "created_by"),
        actorDisplayName: null,
        actorEmail: null,
        subjectType: "workspace",
        subjectId: org.orgId,
        subjectName: org.orgName ?? org.orgSlug,
        title: isDeleted
          ? `Deleted workspace ${org.orgName ?? org.orgSlug}`
          : type === "organization.created"
            ? `Created workspace ${org.orgName ?? org.orgSlug}`
            : `Updated workspace ${org.orgName ?? org.orgSlug}`,
        description: isDeleted
          ? `Workspace ${org.orgName ?? org.orgSlug} was deleted in Clerk.`
          : type === "organization.created"
            ? `Workspace ${org.orgName ?? org.orgSlug} was created in Clerk.`
            : `Workspace ${org.orgName ?? org.orgSlug} profile or image changed in Clerk.`,
        severity: "info",
        payloadJson: JSON.stringify({
          name: org.orgName,
          slug: org.orgSlug,
          hasImage: rawData.has_image,
          imageUrl: readOptionalStringField(rawData, "image_url"),
        }),
      };
    } else if (
      type === "organizationMembership.created" ||
      type === "organizationMembership.updated" ||
      type === "organizationMembership.deleted"
    ) {
      const subject = readMembershipSubject(rawData);
      input = {
        orgId: org.orgId,
        orgSlug: org.orgSlug,
        projectId: null,
        projectSlug: null,
        stageSlug: null,
        eventType: type,
        category: "membership",
        actorSource: "clerk_webhook",
        actorClerkUserId: subject.userId,
        actorDisplayName: subject.displayName,
        actorEmail: subject.identifier,
        subjectType: "membership",
        subjectId: subject.userId,
        subjectName: subject.displayName ?? subject.identifier,
        title:
          type === "organizationMembership.created"
            ? "Added workspace member"
            : type === "organizationMembership.deleted"
              ? "Removed workspace member"
              : "Updated workspace member",
        description: `${subject.displayName ?? subject.identifier ?? "A member"} ${type === "organizationMembership.created" ? "joined" : type === "organizationMembership.deleted" ? "left or was removed from" : "changed role in"} ${org.orgSlug}.`,
        severity: "info",
        payloadJson: JSON.stringify({
          role: readOptionalStringField(rawData, "role"),
          identifier: subject.identifier,
          userId: subject.userId,
        }),
      };
    } else if (
      type === "organizationInvitation.created" ||
      type === "organizationInvitation.revoked" ||
      type === "organizationInvitation.accepted" ||
      type === "organizationInvitation.deleted"
    ) {
      const email = readOptionalStringField(rawData, "email_address");
      input = {
        orgId: org.orgId,
        orgSlug: org.orgSlug,
        projectId: null,
        projectSlug: null,
        stageSlug: null,
        eventType: type,
        category: "invitation",
        actorSource: "clerk_webhook",
        actorClerkUserId: readOptionalStringField(rawData, "user_id"),
        actorDisplayName: null,
        actorEmail: email,
        subjectType: "invitation",
        subjectId: readOptionalStringField(rawData, "id"),
        subjectName: email,
        title:
          type === "organizationInvitation.created"
            ? "Created workspace invitation"
            : type === "organizationInvitation.accepted"
              ? "Accepted workspace invitation"
              : type === "organizationInvitation.deleted"
                ? "Deleted workspace invitation"
                : "Revoked workspace invitation",
        description: `${email ?? "An invite"} was ${type === "organizationInvitation.created" ? "created for" : type === "organizationInvitation.accepted" ? "accepted in" : type === "organizationInvitation.deleted" ? "deleted from" : "revoked from"} ${org.orgSlug}.`,
        severity: "info",
        payloadJson: JSON.stringify({
          email,
          role: readOptionalStringField(rawData, "role"),
          status: readOptionalStringField(rawData, "status"),
        }),
      };
    }

    if (input === null) {
      return {
        accepted: false,
      };
    }

    await ctx.runMutation(internal.audit.appendEventInternal, {
      ...input,
      retentionTierOverride: null,
    });

    return {
      accepted: true,
    };
  },
});
