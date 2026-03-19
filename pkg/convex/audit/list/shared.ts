import { Effect } from "effect";

import type { QueryCtx } from "../../_generated/server";
import { BarekeyConfectQueryCtx } from "../../confect";
import { getActiveOrgIdClaimsOrNull } from "../../lib/auth";
import { ExternalServiceError } from "../../lib/errors/effect";
import { toAuditEventRow } from "../normalization";
import type { AuditEventRow, AuditListArgs } from "../types";

export type AuditListPage = {
  items: Array<ReturnType<typeof toAuditEventRow>>;
  nextBeforeOccurredAtMs: number | null;
  hasMore: boolean;
};

/**
 * Builds the standard empty audit page used by fail-closed audit query paths.
 *
 * @returns The empty audit page shape expected by the UI.
 * @remarks Unauthorized and transient-failure audit queries intentionally fall back to this value.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function emptyAuditListPage(): AuditListPage {
  return {
    items: [],
    nextBeforeOccurredAtMs: null,
    hasMore: false,
  };
}

/**
 * Normalizes audit list query failures into shared typed service errors.
 *
 * @param error The unknown failure value.
 * @returns A typed external-service error.
 * @remarks Audit list boundaries use this before applying their fail-closed fallback.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function toAuditListError(error: unknown): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : "Failed to load audit events.",
    cause: error,
  });
}

/**
 * Resolves the active Confect query context and runs one async audit query handler.
 *
 * @param handler The async handler to run against the underlying Convex query context.
 * @param args The handler arguments.
 * @returns An Effect wrapping the async audit query handler.
 * @remarks Audit queries remain small by delegating their context plumbing to this helper.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function withAuditQueryCtx<Args, Result>(
  handler: (runtimeCtx: QueryCtx, args: Args) => Promise<Result>,
  args: Args,
): Effect.Effect<Result, ExternalServiceError, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectQueryCtx;
    const runtimeCtx = confectCtx.ctx as unknown as QueryCtx;
    return yield* Effect.tryPromise({
      try: () => handler(runtimeCtx, args),
      catch: toAuditListError,
    });
  });
}

/**
 * Collects a filtered page of audit events for an organization.
 *
 * @param runtimeCtx The audit query context.
 * @param args The organization, filter, and pagination options.
 * @returns The matching audit rows plus a flag indicating whether more rows remain.
 * @remarks This over-fetches and post-filters to support the current index layout without changing the public query surface.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function collectAuditEventsPage(
  runtimeCtx: QueryCtx,
  args: AuditListArgs,
): Promise<{
  items: Array<AuditEventRow>;
  hasMore: boolean;
}> {
  const batchSize = Math.min(Math.max(args.limit * 3, 24), 120);
  const items: Array<AuditEventRow> = [];
  let cursor = args.beforeOccurredAtMs;
  let hasMore = false;
  const db = runtimeCtx.db;

  for (let attempt = 0; attempt < 5 && items.length < args.limit; attempt += 1) {
    let queryBuilder;
    if (args.projectSlug !== null) {
      queryBuilder = db
        .query("auditEvents")
        .withIndex("by_org_id_and_project_slug_and_occurred_at_ms", (q) => {
          const scoped = q.eq("orgId", args.orgId).eq("projectSlug", args.projectSlug);
          return cursor === null ? scoped : scoped.lt("occurredAtMs", cursor);
        });
    } else if (args.category !== null) {
      const category = args.category;
      queryBuilder = db
        .query("auditEvents")
        .withIndex("by_org_id_and_category_and_occurred_at_ms", (q) => {
          const scoped = q.eq("orgId", args.orgId).eq("category", category);
          return cursor === null ? scoped : scoped.lt("occurredAtMs", cursor);
        });
    } else {
      queryBuilder = db
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

export { getActiveOrgIdClaimsOrNull, toAuditEventRow };
