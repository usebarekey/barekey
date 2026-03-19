import { Effect } from "effect";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";

import type { ActionCtx, MutationCtx } from "../_generated/server";
import {
  BarekeyConfectActionCtx,
  BarekeyConfectMutationCtx,
  effectInternalAction,
  effectInternalMutation,
} from "../confect";
import { dbDeleteEffect } from "../lib/convex/db";
import { runMutationEffect } from "../lib/convex/functions";
import { ExternalServiceError } from "../lib/errors/effect";

type PruneBatchArgs = {
  nowMs: number;
  batchSize: number;
};

type PruneBatchResult = {
  deletedCount: number;
  hasMore: boolean;
};

type PruneResult = {
  deletedCount: number;
};

const pruneExpiredEventsBatchInternalReference = makeFunctionReference<
  "mutation",
  PruneBatchArgs,
  PruneBatchResult
>("audit/prune:pruneExpiredEventsBatchInternal") as unknown;

/**
 * Normalizes audit prune failures into typed external-service errors.
 *
 * @param fallbackMessage The fallback message to use when the failure is not an `Error`.
 * @param error The unknown failure value.
 * @returns A typed external-service error.
 * @remarks Audit pruning is maintenance infrastructure and should stay on the shared Effect error channel.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function toAuditPruneError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}

/**
 * Deletes one bounded batch of expired audit events.
 *
 * @param runtimeCtx The Convex mutation context.
 * @param args The current time and requested batch size.
 * @returns An Effect that succeeds with the deleted count and whether another batch likely remains.
 * @remarks This clamps the batch size to a safe range and deletes rows one by one.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function pruneExpiredEventsBatchInternalEffect(
  runtimeCtx: MutationCtx,
  args: PruneBatchArgs,
): Effect.Effect<PruneBatchResult, ExternalServiceError> {
  return Effect.gen(function* () {
    const safeBatchSize = Math.min(Math.max(args.batchSize, 1), 500);
    const db = runtimeCtx.db;
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .query("auditEvents")
          .withIndex("by_expires_at_ms", (q) => q.lt("expiresAtMs", args.nowMs))
          .take(safeBatchSize),
      catch: (error) =>
        toAuditPruneError("Failed to load expired audit events for pruning.", error),
    });

    yield* Effect.forEach(
      rows,
      (row) => dbDeleteEffect(runtimeCtx, row._id, (error) =>
        toAuditPruneError("Failed to delete an expired audit event.", error),
      ),
      { concurrency: 1, discard: true },
    );

    return {
      deletedCount: rows.length,
      hasMore: rows.length === safeBatchSize,
    };
  });
}

/**
 * Prunes expired audit events across multiple internal batches.
 *
 * @param runtimeCtx The Convex action context.
 * @returns An Effect that succeeds with the total number of deleted audit events.
 * @remarks This loops through at most 20 internal prune batches per invocation.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function pruneExpiredEventsInternalEffect(
  runtimeCtx: ActionCtx,
): Effect.Effect<PruneResult, ExternalServiceError> {
  return Effect.gen(function* () {
    let deletedCount = 0;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const batch = yield* runMutationEffect<PruneBatchResult, ExternalServiceError>(
        runtimeCtx,
        pruneExpiredEventsBatchInternalReference,
        {
          nowMs: Date.now(),
          batchSize: 250,
        },
        (error) => toAuditPruneError("Failed to run an internal audit prune batch.", error),
      );
      deletedCount += batch.deletedCount;
      if (!batch.hasMore) {
        break;
      }
    }

    return {
      deletedCount,
    };
  });
}

/**
 * Deletes one batch of expired audit events.
 *
 * @param runtimeCtx The Convex internal mutation context.
 * @param args The current time and requested batch size.
 * @returns The number of deleted events plus whether another batch likely remains.
 * @remarks This mutates `auditEvents` and clamps the batch size to a safe range.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const pruneExpiredEventsBatchInternal = effectInternalMutation<
  PruneBatchArgs,
  PruneBatchResult,
  any
>({
  args: {
    nowMs: v.number(),
    batchSize: v.number(),
  },
  returns: v.object({
    deletedCount: v.number(),
    hasMore: v.boolean(),
  }),
  handler: (args) =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectMutationCtx;
      const runtimeCtx = confectCtx.ctx as unknown as MutationCtx;
      return yield* pruneExpiredEventsBatchInternalEffect(runtimeCtx, args);
    }),
});

/**
 * Prunes expired audit events across multiple internal batches.
 *
 * @param runtimeCtx The Convex internal action context.
 * @returns The total number of deleted audit events.
 * @remarks This loops through at most 20 internal prune batches per invocation.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const pruneExpiredEventsInternal = effectInternalAction<{}, PruneResult, any>({
  args: {},
  returns: v.object({
    deletedCount: v.number(),
  }),
  handler: () =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectActionCtx;
      const runtimeCtx = confectCtx.ctx as unknown as ActionCtx;
      return yield* pruneExpiredEventsInternalEffect(runtimeCtx);
    }),
});
