import { Effect } from "effect";
import { v } from "convex/values";
import type { QueryCtx } from "../../_generated/server";
import {
  BarekeyConfectQueryCtx,
  effectInternalQuery,
} from "../../confect";
import { ExternalServiceError } from "../../lib/errors/effect";
import { pickCanonicalRow } from "../../lib/payments/state";
import {
  orgStorageUsageResultValidator,
  type OrgIdArgs,
  type OrgStorageUsageResult,
  toStorageMirrorError,
} from "./shared";

/**
 * Reads the canonical storage usage mirror row for one organization.
 *
 * @param ctx The Convex query context.
 * @param args The organization identifier.
 * @returns An Effect that succeeds with the mirrored byte count and timestamp, or `null`.
 * @remarks This reads only the mirror table and does not recompute encrypted storage usage.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
function getOrgStorageUsageInternalEffect(
  ctx: QueryCtx,
  args: OrgIdArgs,
): Effect.Effect<OrgStorageUsageResult, ExternalServiceError> {
  return Effect.tryPromise({
    try: async () => {
      const rows = await ctx.db
        .query("orgStorageUsage")
        .withIndex("by_org_id", (q) => q.eq("orgId", args.orgId))
        .collect();
      const row = pickCanonicalRow(rows);
      if (row === null) {
        return null;
      }
      return {
        encryptedBytes: row.encryptedBytes,
        updatedAtMs: row.updatedAtMs,
      };
    },
    catch: (error) =>
      toStorageMirrorError("Failed to read the organization storage mirror.", error),
  });
}

/**
 * Reads the mirrored encrypted storage usage row for an organization.
 *
 * @param ctx The Convex internal query context.
 * @param args The organization identifier.
 * @returns The mirrored encrypted byte count and last update time, or `null`.
 * @remarks This reads the billing mirror table only and does not recompute usage.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const getOrgStorageUsageInternal = effectInternalQuery<OrgIdArgs, OrgStorageUsageResult, any>(
  {
    args: {
      orgId: v.string(),
    },
    returns: orgStorageUsageResultValidator,
    handler: (args) =>
      Effect.gen(function* () {
        const confectCtx = yield* BarekeyConfectQueryCtx;
        const ctx = confectCtx.ctx as unknown as QueryCtx;
        return yield* getOrgStorageUsageInternalEffect(ctx, args);
      }),
  },
);
