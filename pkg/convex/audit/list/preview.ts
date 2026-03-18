import { Effect } from "effect";
import { v } from "convex/values";

import { effectQuery } from "../../confect";
import { collectAuditEventsPage, getActiveOrgIdClaimsOrNull, toAuditEventRow, withAuditQueryCtx } from "./shared";

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
export const getPreviewEventsForCurrentOrg = effectQuery<
  {
    expectedOrgSlug: string;
    limit: number;
  },
  Array<ReturnType<typeof toAuditEventRow>>,
  any
>({
  args: {
    expectedOrgSlug: v.string(),
    limit: v.number(),
  },
  returns: v.any(),
  handler: (args) =>
    withAuditQueryCtx(async (ctx, innerArgs) => {
      const identity = await ctx.auth.getUserIdentity();
      if (identity === null) {
        return [];
      }
      const activeOrg = getActiveOrgIdClaimsOrNull(identity);
      if (activeOrg === null || activeOrg.orgSlug !== innerArgs.expectedOrgSlug) {
        return [];
      }
      const page = await collectAuditEventsPage(ctx, {
        orgId: activeOrg.orgId,
        beforeOccurredAtMs: null,
        limit: Math.min(Math.max(innerArgs.limit, 1), 10),
        category: null,
        projectSlug: null,
        actorSource: null,
        sensitiveOnly: false,
      });
      return page.items.map(toAuditEventRow);
    }, args).pipe(Effect.catchAll(() => Effect.succeed([]))),
});
