import { Effect } from "effect";
import { v } from "convex/values";

import type { MutationCtx } from "../_generated/server";
import { BarekeyConfectMutationCtx, effectInternalMutation } from "../confect";
import { ExternalServiceError } from "../lib/errors/effect";
import { pickCanonicalRow } from "../lib/payments/state";

type BillingRequestLogArgs = {
  orgId: string;
  requestKey: string;
  featureId: string;
  units: number;
};

type BillingRequestLogResult = {
  inserted: boolean;
};

/**
 * Normalizes billing request-log failures into typed external-service errors.
 *
 * @param fallbackMessage The fallback message to use when the failure is not an `Error`.
 * @param error The unknown failure value.
 * @returns A typed external-service error.
 * @remarks This keeps billing request idempotency flows on the shared Effect error channel.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function toBillingRequestLogError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}

/**
 * Logs a billing request key for idempotency and deduplicates concurrent inserts.
 *
 * @param ctx The Convex mutation context.
 * @param args The organization, request key, feature, and unit count to log.
 * @returns An Effect that succeeds with whether the request key was newly inserted.
 * @remarks This mutates `billingRequestLog` and deletes duplicate rows when races occur.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function logBillingRequestInternalEffect(
  ctx: MutationCtx,
  args: BillingRequestLogArgs,
): Effect.Effect<BillingRequestLogResult, ExternalServiceError> {
  return Effect.gen(function* () {
    const existing = yield* Effect.tryPromise({
      try: () =>
        ctx.db
          .query("billingRequestLog")
          .withIndex("by_org_id_and_request_key", (q) =>
            q.eq("orgId", args.orgId).eq("requestKey", args.requestKey),
          )
          .collect(),
      catch: (error) =>
        toBillingRequestLogError("Failed to load billing request log entries.", error),
    });
    if (existing.length > 0) {
      return { inserted: false };
    }

    const rowId = yield* Effect.tryPromise({
      try: () =>
        ctx.db.insert("billingRequestLog", {
          orgId: args.orgId,
          requestKey: args.requestKey,
          featureId: args.featureId,
          units: args.units,
          createdAtMs: Date.now(),
        }),
      catch: (error) =>
        toBillingRequestLogError("Failed to insert the billing request log entry.", error),
    });
    const rows = yield* Effect.tryPromise({
      try: () =>
        ctx.db
          .query("billingRequestLog")
          .withIndex("by_org_id_and_request_key", (q) =>
            q.eq("orgId", args.orgId).eq("requestKey", args.requestKey),
          )
          .collect(),
      catch: (error) =>
        toBillingRequestLogError("Failed to reload billing request log entries.", error),
    });
    const canonical = pickCanonicalRow(rows);
    if (canonical === null) {
      return { inserted: false };
    }
    if (canonical._id !== rowId) {
      yield* Effect.tryPromise({
        try: () => ctx.db.delete(rowId),
        catch: (error) =>
          toBillingRequestLogError("Failed to remove the duplicate billing request log row.", error),
      });
      return { inserted: false };
    }

    yield* Effect.forEach(
      rows,
      (row) =>
        row._id === canonical._id
          ? Effect.void
          : Effect.tryPromise({
              try: () => ctx.db.delete(row._id),
              catch: (error) =>
                toBillingRequestLogError(
                  "Failed to remove a duplicate billing request log row.",
                  error,
                ),
            }),
      { concurrency: 1, discard: true },
    );
    return { inserted: true };
  });
}

/**
 * Logs a billing request key for idempotency and deduplicates concurrent inserts.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The organization, request key, feature, and unit count to log.
 * @returns Whether the request key was newly inserted.
 * @remarks This mutates `billingRequestLog` and deletes duplicate rows when races occur.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const logBillingRequestInternal = effectInternalMutation<
  BillingRequestLogArgs,
  BillingRequestLogResult,
  any
>({
  args: {
    orgId: v.string(),
    requestKey: v.string(),
    featureId: v.string(),
    units: v.number(),
  },
  returns: v.object({
    inserted: v.boolean(),
  }),
  handler: (args) =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectMutationCtx;
      const ctx = confectCtx.ctx as unknown as MutationCtx;
      return yield* logBillingRequestInternalEffect(ctx, args);
    }),
});
