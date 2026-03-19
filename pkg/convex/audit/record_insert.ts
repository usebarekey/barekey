import { Effect } from "effect";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { dbCollectEffect, dbInsertEffect, dbUniqueEffect } from "../lib/convex/db";
import {
  expiresAtMsForRetention,
  retentionTierFromCurrentTier,
  sanitizeAuditPayload,
  type AuditRetentionTier,
} from "../lib/audit";
import { safeParseJson } from "./normalization";
import type { AuditEventInput } from "./types";

/**
 * Finds the canonical user row for a Clerk user id.
 *
 * @param ctx The audit query or mutation context.
 * @param clerkUserId The Clerk user id to resolve.
 * @returns The earliest matching user row, or `null`.
 * @remarks This keeps audit actor enrichment stable even when duplicate user rows exist.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
async function findCanonicalUserByClerkUserId(
  ctx: QueryCtx | MutationCtx,
  clerkUserId: string,
): Promise<Doc<"users"> | null> {
  const rows = await Effect.runPromise(
    dbCollectEffect<Doc<"users">, Error>(
      ctx,
      "users",
      (query) =>
        query.withIndex("by_clerk_user_id", (indexQuery) =>
          indexQuery.eq("clerkUserId", clerkUserId),
        ),
      (error) =>
        error instanceof Error ? error : new Error("Failed to load audit actor user rows."),
    ),
  );
  return rows.sort((left, right) => left.createdAtMs - right.createdAtMs)[0] ?? null;
}

/**
 * Resolves the audit retention tier for an organization.
 *
 * @param ctx The audit mutation context.
 * @param args The organization id and optional override.
 * @returns The effective audit retention tier.
 * @remarks Explicit overrides win; otherwise the current billing snapshot drives retention.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
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

  const snapshot = await Effect.runPromise(
    dbUniqueEffect<Doc<"orgBillingSnapshots">, Error>(
      ctx,
      "orgBillingSnapshots",
      (query) =>
        query.withIndex("by_org_id", (indexQuery) => indexQuery.eq("orgId", args.orgId)),
      (error) =>
        error instanceof Error
          ? error
          : new Error("Failed to load the organization billing snapshot for audit retention."),
    ),
  );

  return retentionTierFromCurrentTier(snapshot?.currentTier ?? null);
}

/**
 * Inserts a single normalized audit event row.
 *
 * @param ctx The audit mutation context.
 * @param args The audit event input payload.
 * @returns The inserted audit event id.
 * @remarks This writes `auditEvents` and enriches actor metadata from the canonical user row when available.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function insertAuditEventWithMutationCtx(
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

  return await Effect.runPromise(
    dbInsertEffect<Id<"auditEvents">, Error>(
      ctx,
      "auditEvents",
      {
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
      },
      (error) =>
        error instanceof Error ? error : new Error("Failed to insert the audit event row."),
    ),
  );
}
