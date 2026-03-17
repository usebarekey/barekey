import { v } from "convex/values";

import { query } from "../confect";
import { auditActorSourceValidator, auditCategoryValidator, type AuditActorSource, type AuditCategory } from "../lib/audit";
import { getActiveOrgIdClaimsOrNull } from "../lib/auth";
import type { QueryCtx } from "../_generated/server";
import { toAuditEventRow } from "./normalization";
import type { AuditEventRow, AuditListArgs } from "./types";

/**
 * Collects a filtered page of audit events for an organization.
 *
 * @param ctx The audit query context.
 * @param args The organization, filter, and pagination options.
 * @returns The matching audit rows plus a flag indicating whether more rows remain.
 * @remarks This over-fetches and post-filters to support the current index layout without changing the public query surface.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
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

/**
 * Lists audit events for the current organization.
 *
 * @param ctx The Convex query context.
 * @param args The active-org slug plus pagination and filter options.
 * @returns A normalized page of audit events for the active organization.
 * @remarks Unauthorized or mismatched requests intentionally return an empty page.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
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

/**
 * Lists audit events for a project in the current organization.
 *
 * @param ctx The Convex query context.
 * @param args The active-org slug, project slug, and pagination/filter options.
 * @returns A normalized page of project-scoped audit events.
 * @remarks Unauthorized or mismatched requests intentionally return an empty page.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
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

/**
 * Reads a small preview of recent audit events for the current organization.
 *
 * @param ctx The Convex query context.
 * @param args The active-org slug and requested preview size.
 * @returns A small normalized list of recent audit events.
 * @remarks Unauthorized or mismatched requests intentionally return an empty list.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
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
