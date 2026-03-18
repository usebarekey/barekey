import { Effect } from "effect";
import { v } from "convex/values";

import type { MutationCtx } from "./_generated/server";
import { BarekeyConfectMutationCtx, effectInternalMutation } from "./confect";
import { ExternalServiceError } from "./lib/errors/effect";

type WipeEncryptedDataArgs = {
  confirm: "wipe_encrypted_data";
};

type WipeEncryptedDataResult = {
  projectKeyCount: number;
  projectVariableCount: number;
  projectVariableScheduleCount: number;
  orgStorageUsageCount: number;
  cancelledScheduledFunctionCount: number;
  completedAtMs: number;
};

/**
 * Normalizes destructive cutover failures into typed external-service errors.
 *
 * @param fallbackMessage The fallback message to use when the failure is not an `Error`.
 * @param error The unknown failure value.
 * @returns A typed external-service error.
 * @remarks The cutover mutation is destructive infrastructure and should stay on the shared Effect error channel.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function toCutoverError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}

/**
 * One-time cutover helper for destructive encryption migrations.
 *
 * @param ctx The Convex mutation context.
 * @returns An Effect that succeeds with the destructive wipe counts and completion timestamp.
 * @remarks This removes only the data whose ciphertext or wrapping format changed.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function wipeEncryptedDataInternalEffect(
  ctx: MutationCtx,
): Effect.Effect<WipeEncryptedDataResult, ExternalServiceError> {
  return Effect.gen(function* () {
    const schedules = yield* Effect.tryPromise({
      try: () => ctx.db.query("projectVariableSchedules").collect(),
      catch: (error) =>
        toCutoverError("Failed to load scheduled variable writes for cutover.", error),
    });
    let cancelledScheduledFunctionCount = 0;
    for (const schedule of schedules) {
      if (schedule.scheduledFunctionId === null) {
        continue;
      }
      const scheduledFunctionId = schedule.scheduledFunctionId;

      const cancelled = yield* Effect.catchAll(
        Effect.tryPromise({
          try: () => ctx.scheduler.cancel(scheduledFunctionId),
          catch: (error) =>
            toCutoverError("Failed to cancel a scheduled variable write during cutover.", error),
        }).pipe(Effect.as(true)),
        (error) =>
          Effect.sync(() => {
            console.error("Failed to cancel scheduled variable write during cutover.", {
              error,
              scheduleId: String(schedule._id),
              scheduledFunctionId: String(schedule.scheduledFunctionId),
            });
            return false;
          }),
      );
      if (cancelled) {
        cancelledScheduledFunctionCount += 1;
      }
    }

    const [projectVariables, projectKeys, orgStorageUsageRows] = yield* Effect.all([
      Effect.tryPromise({
        try: () => ctx.db.query("projectVariables").collect(),
        catch: (error) =>
          toCutoverError("Failed to load project variables for cutover.", error),
      }),
      Effect.tryPromise({
        try: () => ctx.db.query("projectKeys").collect(),
        catch: (error) =>
          toCutoverError("Failed to load project keys for cutover.", error),
      }),
      Effect.tryPromise({
        try: () => ctx.db.query("orgStorageUsage").collect(),
        catch: (error) =>
          toCutoverError("Failed to load storage mirror rows for cutover.", error),
      }),
    ]);

    yield* Effect.forEach(
      schedules,
      (schedule) =>
        Effect.tryPromise({
          try: () => ctx.db.delete(schedule._id),
          catch: (error) =>
            toCutoverError("Failed to delete a scheduled variable write during cutover.", error),
        }),
      { concurrency: 1, discard: true },
    );
    yield* Effect.forEach(
      projectVariables,
      (row) =>
        Effect.tryPromise({
          try: () => ctx.db.delete(row._id),
          catch: (error) =>
            toCutoverError("Failed to delete a project variable during cutover.", error),
        }),
      { concurrency: 1, discard: true },
    );
    yield* Effect.forEach(
      projectKeys,
      (row) =>
        Effect.tryPromise({
          try: () => ctx.db.delete(row._id),
          catch: (error) =>
            toCutoverError("Failed to delete a project key during cutover.", error),
        }),
      { concurrency: 1, discard: true },
    );
    yield* Effect.forEach(
      orgStorageUsageRows,
      (row) =>
        Effect.tryPromise({
          try: () => ctx.db.delete(row._id),
          catch: (error) =>
            toCutoverError("Failed to delete a storage mirror row during cutover.", error),
        }),
      { concurrency: 1, discard: true },
    );

    return {
      projectKeyCount: projectKeys.length,
      projectVariableCount: projectVariables.length,
      projectVariableScheduleCount: schedules.length,
      orgStorageUsageCount: orgStorageUsageRows.length,
      cancelledScheduledFunctionCount,
      completedAtMs: Date.now(),
    };
  });
}

/**
 * One-time cutover helper for destructive encryption migrations.
 *
 * This removes only the data whose ciphertext/wrapping format changed:
 * project variable payloads, wrapped DEKs, scheduled variable writes, and the
 * mirrored encrypted-byte counters derived from those records.
 *
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const wipeEncryptedDataInternal = effectInternalMutation<
  WipeEncryptedDataArgs,
  WipeEncryptedDataResult,
  any
>({
  args: {
    confirm: v.literal("wipe_encrypted_data"),
  },
  returns: v.object({
    projectKeyCount: v.number(),
    projectVariableCount: v.number(),
    projectVariableScheduleCount: v.number(),
    orgStorageUsageCount: v.number(),
    cancelledScheduledFunctionCount: v.number(),
    completedAtMs: v.number(),
  }),
  handler: () =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectMutationCtx;
      const ctx = confectCtx.ctx as unknown as MutationCtx;
      return yield* wipeEncryptedDataInternalEffect(ctx);
    }),
});
