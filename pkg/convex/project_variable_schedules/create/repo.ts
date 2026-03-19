import { Effect } from "effect";

import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { dbGetEffect, dbInsertEffect } from "../../lib/convex/db";
import { executeScheduledVariableScheduleInternalReference } from "../refs";
import { toScheduleExternalServiceError } from "../errors";

/**
 * Inserts a new scheduled variable batch row.
 *
 * @param ctx The Convex mutation context.
 * @param input The schedule row fields to persist.
 * @returns The new schedule id.
 * @remarks This writes the prepared schedule snapshot before the scheduler handle is attached.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function insertScheduledBatchEffect(
  ctx: MutationCtx,
  input: {
    projectId: string;
    orgId: string;
    stageSlug: string;
    timezone: string;
    runAtMs: number;
    preparedCreates: Array<unknown>;
    preparedUpdates: Array<unknown>;
    updateTargets: Array<unknown>;
    createdCount: number;
    updatedCount: number;
    clerkUserId: string;
    now: number;
  },
) {
  return dbInsertEffect<Id<"projectVariableSchedules">, ReturnType<typeof toScheduleExternalServiceError>>(
    ctx,
    "projectVariableSchedules",
    {
      projectId: input.projectId as never,
      orgId: input.orgId,
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
      createdByClerkUserId: input.clerkUserId,
      updatedByClerkUserId: input.clerkUserId,
      createdAtMs: input.now,
      updatedAtMs: input.now,
      executedAtMs: null,
      canceledAtMs: null,
      failedAtMs: null,
      failureMessage: null,
    },
    (error) =>
      toScheduleExternalServiceError("Failed to create the scheduled variable batch.", error),
  );
}

/**
 * Schedules the execution function for one scheduled batch.
 *
 * @param ctx The Convex mutation context.
 * @param input The run time and schedule id to execute.
 * @returns The created scheduled function id.
 * @remarks This delegates to Convex scheduler using the existing execution action.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function scheduleScheduledBatchExecutionEffect(
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
      toScheduleExternalServiceError("Failed to schedule the variable batch execution.", error),
  });
}

/**
 * Reloads a scheduled batch row after scheduling.
 *
 * @param ctx The Convex mutation context.
 * @param scheduleId The schedule id to reload.
 * @returns The schedule row, or `null`.
 * @remarks This is used when the scheduled-function attachment helper returns `null`.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function getScheduledBatchEffect(
  ctx: MutationCtx,
  scheduleId: string,
): Effect.Effect<Doc<"projectVariableSchedules"> | null, ReturnType<typeof toScheduleExternalServiceError>> {
  return dbGetEffect<Doc<"projectVariableSchedules">, ReturnType<typeof toScheduleExternalServiceError>>(
    ctx,
    scheduleId,
    (error) =>
      toScheduleExternalServiceError(
        "Failed to reload the scheduled batch after scheduling it.",
        error,
      ),
  );
}
