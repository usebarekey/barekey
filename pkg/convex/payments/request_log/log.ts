import { Effect } from "effect";
import { v } from "convex/values";

import type { MutationCtx } from "../../_generated/server";
import { BarekeyConfectMutationCtx, effectInternalMutation } from "../../confect";
import { pickCanonicalRow } from "../../lib/payments/state";
import {
  deleteBillingRequestLogRowEffect,
  insertBillingRequestLogRowEffect,
  listBillingRequestLogRowsEffect,
} from "./repo";

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
 * Logs a billing request key for idempotency and deduplicates concurrent inserts.
 *
 * @param ctx The Convex mutation context.
 * @param args The organization, request key, feature, and unit count to log.
 * @returns An Effect that succeeds with whether the request key was newly inserted.
 * @remarks This mutates `billingRequestLog` and deletes duplicate rows when races occur.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
function logBillingRequestInternalEffect(
  ctx: MutationCtx,
  args: BillingRequestLogArgs,
) {
  return Effect.gen(function* () {
    const existing = yield* listBillingRequestLogRowsEffect(ctx, {
      orgId: args.orgId,
      requestKey: args.requestKey,
    });
    if (existing.length > 0) {
      return { inserted: false } satisfies BillingRequestLogResult;
    }

    const rowId = yield* insertBillingRequestLogRowEffect(ctx, {
      orgId: args.orgId,
      requestKey: args.requestKey,
      featureId: args.featureId,
      units: args.units,
      createdAtMs: Date.now(),
    });
    const rows = yield* listBillingRequestLogRowsEffect(ctx, {
      orgId: args.orgId,
      requestKey: args.requestKey,
    });
    const canonical = pickCanonicalRow(rows);
    if (canonical === null) {
      return { inserted: false } satisfies BillingRequestLogResult;
    }
    if (canonical._id !== rowId) {
      yield* deleteBillingRequestLogRowEffect(ctx, {
        rowId,
        failureMessage: "Failed to remove the duplicate billing request log row.",
      });
      return { inserted: false } satisfies BillingRequestLogResult;
    }

    yield* Effect.forEach(
      rows,
      (row) =>
        row._id === canonical._id
          ? Effect.void
          : deleteBillingRequestLogRowEffect(ctx, {
              rowId: row._id,
              failureMessage: "Failed to remove a duplicate billing request log row.",
            }),
      { concurrency: 1, discard: true },
    );
    return { inserted: true } satisfies BillingRequestLogResult;
  });
}

/**
 * Logs a billing request key for idempotency and deduplicates concurrent inserts.
 *
 * @param args The organization, request key, feature, and unit count to log.
 * @returns Whether the request key was newly inserted.
 * @remarks This public internal mutation delegates to the Effect-native request-log program.
 * @lastModified 2026-03-18
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
