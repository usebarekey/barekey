import { Effect } from "effect";
import { v } from "convex/values";

import { effectQuery } from "../../confect";
import { auditActorSourceValidator, auditCategoryValidator, type AuditActorSource, type AuditCategory } from "../../lib/audit";
import { collectAuditEventsPage, emptyAuditListPage, getActiveOrgIdClaimsOrNull, type AuditListPage, toAuditEventRow, withAuditQueryCtx } from "./shared";

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
export const listEventsForCurrentOrg = effectQuery<
  {
    expectedOrgSlug: string;
    beforeOccurredAtMs: number | null;
    limit: number;
    category: AuditCategory | null;
    projectSlug: string | null;
    actorSource: AuditActorSource | null;
    sensitiveOnly: boolean;
  },
  AuditListPage,
  any
>({
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
  handler: (args) =>
    withAuditQueryCtx(async (ctx, innerArgs) => {
      const identity = await ctx.auth.getUserIdentity();
      if (identity === null) {
        return emptyAuditListPage();
      }

      const activeOrg = getActiveOrgIdClaimsOrNull(identity);
      if (activeOrg === null) {
        return emptyAuditListPage();
      }

      if (activeOrg.orgSlug !== null && activeOrg.orgSlug !== innerArgs.expectedOrgSlug) {
        return emptyAuditListPage();
      }

      const page = await collectAuditEventsPage(ctx, {
        orgId: activeOrg.orgId,
        beforeOccurredAtMs: innerArgs.beforeOccurredAtMs,
        limit: Math.min(Math.max(innerArgs.limit, 1), 50),
        category: innerArgs.category,
        projectSlug: innerArgs.projectSlug,
        actorSource: innerArgs.actorSource,
        sensitiveOnly: innerArgs.sensitiveOnly,
      });

      return {
        items: page.items.map(toAuditEventRow),
        nextBeforeOccurredAtMs: page.items[page.items.length - 1]?.occurredAtMs ?? null,
        hasMore: page.hasMore,
      };
    }, args).pipe(Effect.catchAll(() => Effect.succeed(emptyAuditListPage()))),
});
