import { Effect } from "effect";

import type { QueryCtx } from "../_generated/server";
import { ExternalServiceError } from "../lib/errors/effect";
import { toOrgDeletionError } from "./shared";

/**
 * Lists project ids for one organization.
 *
 * @param convexCtx The Convex query context.
 * @param orgId The organization identifier.
 * @returns An Effect that succeeds with the organization project ids.
 * @remarks This is the repo-layer read used by org deletion readiness flows.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function listProjectIdsByOrgIdEffect(
  convexCtx: QueryCtx,
  orgId: string,
): Effect.Effect<Array<{ id: string }>, ExternalServiceError> {
  return Effect.tryPromise({
    try: async () => {
      const rows = await convexCtx.db
        .query("projects")
        .withIndex("by_org_id", (q) => q.eq("orgId", orgId))
        .collect();
      return rows.map((row) => ({
        id: row._id,
      }));
    },
    catch: (error) =>
      toOrgDeletionError("Failed to load organization projects.", error),
  });
}
