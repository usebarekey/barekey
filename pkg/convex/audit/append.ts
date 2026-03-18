import { Effect } from "effect";
import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { BarekeyConfectMutationCtx, effectInternalMutation } from "../confect";
import { ExternalServiceError } from "../lib/errors/effect";
import { insertAuditEventWithMutationCtx } from "./record_insert";
import {
  appendAuditEventArgsFields,
  appendAuditEventArgsValidator,
  type AuditEventInput,
} from "./types";

type AppendEventsArgs = {
  events: Array<AuditEventInput>;
};

/**
 * Normalizes audit append failures into typed external-service errors.
 *
 * @param fallbackMessage The fallback message to use when the failure is not an `Error`.
 * @param error The unknown failure value.
 * @returns A typed external-service error.
 * @remarks Audit appenders are infrastructure writers and should stay on the shared Effect error channel.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function toAuditAppendError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}

/**
 * Inserts one normalized audit event row.
 *
 * @param ctx The Convex mutation context.
 * @param event The audit event payload.
 * @returns An Effect that succeeds with the inserted audit event id.
 * @remarks This wraps the canonical audit insert helper in the shared Effect error model.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function appendEventInternalEffect(
  ctx: MutationCtx,
  event: AuditEventInput,
): Effect.Effect<Id<"auditEvents">, ExternalServiceError> {
  return Effect.tryPromise({
    try: () => insertAuditEventWithMutationCtx(ctx, event),
    catch: (error) =>
      toAuditAppendError("Failed to append the audit event.", error),
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
export const appendEventInternal = effectInternalMutation<AuditEventInput, Id<"auditEvents">, any>({
  args: appendAuditEventArgsFields,
  returns: v.id("auditEvents"),
  handler: (args) =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectMutationCtx;
      const ctx = confectCtx.ctx as unknown as MutationCtx;
      return yield* appendEventInternalEffect(ctx, args);
    }),
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
export const appendEventsInternal = effectInternalMutation<
  AppendEventsArgs,
  Array<Id<"auditEvents">>,
  any
>({
  args: {
    events: v.array(appendAuditEventArgsValidator),
  },
  returns: v.array(v.id("auditEvents")),
  handler: (args) =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectMutationCtx;
      const ctx = confectCtx.ctx as unknown as MutationCtx;
      return yield* Effect.forEach(args.events, (event) => appendEventInternalEffect(ctx, event), {
        concurrency: 1,
      });
    }),
});
