import { Effect } from "effect";

import type { Doc, Id } from "../../../_generated/dataModel";
import type { MutationCtx, ActionCtx } from "../../../_generated/server";
import { dbGetEffect } from "../../../lib/convex/db";
import { runMutationEffect } from "../../../lib/convex/functions";
import {
  markScheduleAppliedInternalReference,
  markScheduleFailedInternalReference,
} from "../../refs";
import { toScheduleExternalServiceError } from "../../errors";
import type { MarkScheduleFailedArgs } from "../types";

/**
 * Loads a schedule row directly from storage for execution state transitions.
 *
 * @param ctx The Convex mutation context.
 * @param scheduleId The schedule id to load.
 * @returns The schedule row, or `null`.
 * @remarks This is shared by the mark-applied and mark-failed status transitions.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function getScheduledExecutionRowEffect(
  ctx: MutationCtx,
  scheduleId: Id<"projectVariableSchedules">,
) {
  return dbGetEffect<Doc<"projectVariableSchedules">, ReturnType<typeof toScheduleExternalServiceError>>(
    ctx,
    scheduleId,
    (error) => toScheduleExternalServiceError("Failed to load the scheduled batch.", error),
  );
}

/**
 * Marks a scheduled batch as applied through the internal mutation boundary.
 *
 * @param ctx The Convex action context.
 * @param scheduleId The schedule id to mark applied.
 * @returns An Effect that completes after the mutation runs.
 * @remarks This keeps the action-side execution flow from owning the generated mutation ref.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function markScheduledBatchAppliedEffect(
  ctx: ActionCtx,
  scheduleId: Id<"projectVariableSchedules">,
) {
  return runMutationEffect<unknown, ReturnType<typeof toScheduleExternalServiceError>>(
    ctx,
    markScheduleAppliedInternalReference,
    {
      scheduleId,
    },
    (error) =>
      toScheduleExternalServiceError("Failed to mark the scheduled batch as applied.", error),
  );
}

/**
 * Marks a scheduled batch as failed through the internal mutation boundary.
 *
 * @param ctx The Convex action context.
 * @param input The schedule id and failure message.
 * @returns An Effect that completes after the mutation runs.
 * @remarks This keeps scheduler failure handling behind a named execution gateway.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function markScheduledBatchFailedEffect(
  ctx: ActionCtx,
  input: MarkScheduleFailedArgs,
) {
  return runMutationEffect<unknown, ReturnType<typeof toScheduleExternalServiceError>>(
    ctx,
    markScheduleFailedInternalReference,
    input,
    (error) =>
      toScheduleExternalServiceError("Failed to mark the scheduled batch as failed.", error),
  );
}
