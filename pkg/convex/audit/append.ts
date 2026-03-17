import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { internalMutation } from "../confect";
import { insertAuditEventWithMutationCtx } from "./record_insert";
import { appendAuditEventArgsValidator, type AuditEventInput } from "./types";

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
  handler: async (ctx, args) => await insertAuditEventWithMutationCtx(ctx, args),
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
      const id = await insertAuditEventWithMutationCtx(ctx, event);
      ids.push(id);
    }
    return ids;
  },
});
