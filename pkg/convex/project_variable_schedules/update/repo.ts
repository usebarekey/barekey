import { Effect } from "effect";

import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { dbGetEffect, dbPatchEffect } from "../../lib/convex/db";
import { executeScheduledVariableScheduleInternalReference } from "../refs";
import { toScheduleExternalServiceError } from "../errors";

/**
 * Loads one scheduled batch row for editing.
 *
 * @param ctx The Convex mutation context.
 * @param scheduleId The schedule id to load.
 * @returns The scheduled batch row, or `null`.
 * @remarks This isolates the editable-schedule lookup from the update orchestration layer.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function getEditableScheduledBatchEffect(ctx: MutationCtx, scheduleId: string) {
  return dbGetEffect<Doc<"projectVariableSchedules">, ReturnType<typeof toScheduleExternalServiceError>>(
    ctx,
    scheduleId,
    (error) =>
      toScheduleExternalServiceError("Failed to load the scheduled variable batch.", error),
  );
}

/**
 * Cancels an existing scheduled execution handle.
 *
 * @param ctx The Convex mutation context.
 * @param scheduledFunctionId The scheduler handle to cancel.
 * @returns An Effect that completes after the existing scheduled execution is cancelled.
 * @remarks This is used when editing a pending scheduled batch.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function cancelScheduledBatchExecutionEffect(
  ctx: MutationCtx,
  scheduledFunctionId: string,
) {
  return Effect.tryPromise({
    try: () => ctx.scheduler.cancel(scheduledFunctionId as never),
    catch: (error) =>
      toScheduleExternalServiceError(
        "Failed to cancel the existing scheduled execution.",
        error,
      ),
  });
}

/**
 * Creates a new scheduled execution handle for an edited batch.
 *
 * @param ctx The Convex mutation context.
 * @param input The run time and schedule id to execute.
 * @returns The created scheduled function id.
 * @remarks This reschedules the batch after its snapshot has been rebuilt.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function rescheduleScheduledBatchExecutionEffect(
  ctx: MutationCtx,
  input: {
    runAtMs: number;
    scheduleId: string;
  },
) {
  return Effect.tryPromise({
    try: () =>
      ctx.scheduler.runAt(
        input.runAtMs,
        executeScheduledVariableScheduleInternalReference,
        {
          scheduleId: input.scheduleId as never,
        },
      ),
    catch: (error) =>
      toScheduleExternalServiceError("Failed to reschedule the variable batch execution.", error),
  });
}

/**
 * Patches a scheduled batch row with an updated prepared snapshot.
 *
 * @param ctx The Convex mutation context.
 * @param input The persisted schedule row id plus updated schedule state.
 * @returns An Effect that completes after the row is patched.
 * @remarks This resets terminal timestamps and scheduler linkage before the new handle is attached.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function patchScheduledBatchEffect(
  ctx: MutationCtx,
  input: {
    scheduleId: string;
    stageSlug: string;
    timezone: string;
    runAtMs: number;
    preparedCreates: Array<unknown>;
    preparedUpdates: Array<unknown>;
    updateTargets: Array<unknown>;
    createdCount: number;
    updatedCount: number;
    clerkUserId: string;
    updatedAtMs: number;
  },
) {
  return dbPatchEffect(
    ctx,
    input.scheduleId,
    {
      stageSlug: input.stageSlug,
      timezone: input.timezone,
      runAtMs: input.runAtMs,
      status: "scheduled",
      scheduledFunctionId: null,
      preparedCreates: input.preparedCreates as never,
      preparedUpdates: input.preparedUpdates as never,
      updateTargets: input.updateTargets as never,
      createdCount: input.createdCount,
      updatedCount: input.updatedCount,
      updatedByClerkUserId: input.clerkUserId,
      updatedAtMs: input.updatedAtMs,
      executedAtMs: null,
      canceledAtMs: null,
      failedAtMs: null,
      failureMessage: null,
    },
    (error) =>
      toScheduleExternalServiceError("Failed to update the scheduled variable batch.", error),
  );
}
