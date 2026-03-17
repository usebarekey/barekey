import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation } from "../confect";
import {
  expiresAtMsForRetention,
  retentionTierFromCurrentTier,
  sanitizeAuditPayload,
  type AuditRetentionTier,
} from "../lib/audit";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { safeParseJson } from "./normalization";
import { appendAuditEventArgsValidator, type AuditEventInput } from "./types";

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
  const rows = await ctx.db
    .query("users")
    .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
    .collect();
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

  const snapshot = await ctx.db
    .query("orgBillingSnapshots")
    .withIndex("by_org_id", (q) => q.eq("orgId", args.orgId))
    .unique();

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

/**
 * Appends a single audit event row.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The audit event payload to insert.
 * @returns The inserted audit event id.
 * @remarks This is the canonical write path for individual audit events.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const appendEventInternal = internalMutation({
  args: appendAuditEventArgsValidator,
  returns: v.id("auditEvents"),
  handler: async (ctx, args) => await insertAuditEvent(ctx, args),
});

/**
 * Appends multiple audit event rows in sequence.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The batch of audit event payloads to insert.
 * @returns The inserted audit event ids in input order.
 * @remarks This writes `auditEvents` once per input item and preserves insertion order.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
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
