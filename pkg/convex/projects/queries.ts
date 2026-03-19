import { Effect } from "effect";
import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { BarekeyConfectQueryCtx, effectQuery } from "../confect";
import { dbCollectEffect, dbUniqueEffect } from "../lib/convex/db";
import { ExternalServiceError } from "../lib/errors/effect";
import { getActiveOrgIdClaimsOrNull } from "../lib/auth";
import {
  projectListItemValidator,
  projectSummaryValidator,
} from "./types";

function toProjectQueryError(error: unknown): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : "Failed to load project query data.",
    cause: error,
  });
}

function withProjectQueryCtx<Args, Result>(
  handler: (ctx: QueryCtx, args: Args) => Promise<Result>,
  args: Args,
): Effect.Effect<Result, ExternalServiceError, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectQueryCtx;
    const ctx = confectCtx.ctx as unknown as QueryCtx;
    return yield* Effect.tryPromise({
      try: () => handler(ctx, args),
      catch: toProjectQueryError,
    });
  });
}

/**
 * Lists projects for the current authenticated organization.
 *
 * @param ctx The Convex query context.
 * @param args The expected organization slug.
 * @returns The project list with per-project secret counts.
 * @remarks Missing or drifting org claims intentionally return an empty list during org-switch transitions.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const listForCurrentOrg = effectQuery<
  {
    expectedOrgSlug: string;
  },
  Array<{
    id: string;
    orgId: string;
    orgSlug: string;
    name: string;
    slug: string;
    slugBase: string;
    createdByClerkUserId: string;
    createdAtMs: number;
    updatedAtMs: number;
    secretCount: number;
  }>,
  any
>({
  args: {
    expectedOrgSlug: v.string(),
  },
  returns: v.array(projectListItemValidator),
  handler: (args) =>
    withProjectQueryCtx(async (ctx, innerArgs) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return [];
    }

    const activeOrg = getActiveOrgIdClaimsOrNull(identity);
    if (activeOrg === null) {
      return [];
    }

    if (activeOrg.orgSlug !== null && activeOrg.orgSlug !== innerArgs.expectedOrgSlug) {
      return [];
    }

    const rows = await Effect.runPromise(
      dbCollectEffect<Doc<"projects">, ExternalServiceError>(
        ctx,
        "projects",
        (query) =>
          query.withIndex("by_org_id_and_created_at_ms", (indexQuery) =>
            indexQuery.eq("orgId", activeOrg.orgId),
          ).order("desc"),
        toProjectQueryError,
      ),
    );

    return Promise.all(
      rows.map(async (row) => {
        const secretCount = (
          await Effect.runPromise(
            dbCollectEffect<Doc<"projectVariables">, ExternalServiceError>(
              ctx,
              "projectVariables",
              (query) =>
                query.withIndex("by_org_id_and_project_id", (indexQuery) =>
                  indexQuery.eq("orgId", activeOrg.orgId).eq("projectId", row._id),
                ),
              toProjectQueryError,
            ),
          )
        ).length;

        return {
          id: row._id,
          orgId: row.orgId,
          orgSlug: row.orgSlug,
          name: row.name,
          slug: row.slug,
          slugBase: row.slugBase,
          createdByClerkUserId: row.createdByClerkUserId,
          createdAtMs: row.createdAtMs,
          updatedAtMs: row.updatedAtMs,
          secretCount,
        };
      }),
    );
  }, args),
});

/**
 * Looks up a single project for the current authenticated organization by slug.
 *
 * @param ctx The Convex query context.
 * @param args The expected organization slug and project slug.
 * @returns The matching project summary, or `null`.
 * @remarks Missing or drifting org claims intentionally return `null` during org-switch transitions.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const getBySlugForCurrentOrg = effectQuery<
  {
    expectedOrgSlug: string;
    projectSlug: string;
  },
  {
    id: string;
    orgId: string;
    orgSlug: string;
    name: string;
    slug: string;
    slugBase: string;
    createdByClerkUserId: string;
    createdAtMs: number;
    updatedAtMs: number;
  } | null,
  any
>({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
  },
  returns: v.union(projectSummaryValidator, v.null()),
  handler: (args) =>
    withProjectQueryCtx(async (ctx, innerArgs) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }

    const activeOrg = getActiveOrgIdClaimsOrNull(identity);
    if (activeOrg === null) {
      return null;
    }

    if (activeOrg.orgSlug !== null && activeOrg.orgSlug !== innerArgs.expectedOrgSlug) {
      return null;
    }

    const row = await Effect.runPromise(
      dbUniqueEffect<Doc<"projects">, ExternalServiceError>(
        ctx,
        "projects",
        (query) =>
          query.withIndex("by_org_id_and_slug", (indexQuery) =>
            indexQuery.eq("orgId", activeOrg.orgId).eq("slug", innerArgs.projectSlug),
          ),
        toProjectQueryError,
      ),
    );

    if (row === null) {
      return null;
    }

    return {
      id: row._id,
      orgId: row.orgId,
      orgSlug: row.orgSlug,
      name: row.name,
      slug: row.slug,
      slugBase: row.slugBase,
      createdByClerkUserId: row.createdByClerkUserId,
      createdAtMs: row.createdAtMs,
      updatedAtMs: row.updatedAtMs,
    };
  }, args),
});
