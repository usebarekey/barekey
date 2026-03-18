import { Effect } from "effect";

import type { MutationCtx } from "../../_generated/server";
import { BarekeyConfectMutationCtx, ClockService } from "../../confect";
import { toScheduleExternalServiceError } from "../errors";
import type { MarkScheduleAppliedArgs, MarkScheduleFailedArgs } from "./types";

/**
 * Marks a scheduled batch as applied after successful execution.
 *
 * @param args The schedule identifier to mark applied.
 * @returns `null` after the schedule row is updated.
 * @remarks This clears the scheduler handle and stamps the execution timestamp.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function markScheduleAppliedInternalEffect(
  args: MarkScheduleAppliedArgs,
): Effect.Effect<null, unknown, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectMutationCtx;
    const clock = yield* ClockService;
    const ctx = confectCtx.ctx as unknown as MutationCtx;
    const schedule = yield* Effect.tryPromise({
      try: () => ctx.db.get(args.scheduleId),
      catch: (error) =>
        toScheduleExternalServiceError("Failed to load the scheduled batch.", error),
    });
    if (schedule === null) {
      return null;
    }

    const now = clock.nowMs();
    yield* Effect.tryPromise({
      try: () =>
        ctx.db.patch(schedule._id, {
          status: "applied",
          scheduledFunctionId: null,
          updatedAtMs: now,
          executedAtMs: now,
          failedAtMs: null,
          failureMessage: null,
        }),
      catch: (error) =>
        toScheduleExternalServiceError("Failed to mark the scheduled batch as applied.", error),
    });
    return null;
  });
}

/**
 * Marks a scheduled batch as failed after unsuccessful execution.
 *
 * @param args The schedule identifier and failure message.
 * @returns `null` after the schedule row is updated.
 * @remarks This clears the scheduler handle, stamps the failure timestamp, and stores the failure message.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function markScheduleFailedInternalEffect(
  args: MarkScheduleFailedArgs,
): Effect.Effect<null, unknown, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectMutationCtx;
    const clock = yield* ClockService;
    const ctx = confectCtx.ctx as unknown as MutationCtx;
    const schedule = yield* Effect.tryPromise({
      try: () => ctx.db.get(args.scheduleId),
      catch: (error) =>
        toScheduleExternalServiceError("Failed to load the scheduled batch.", error),
    });
    if (schedule === null) {
      return null;
    }

    const now = clock.nowMs();
    yield* Effect.tryPromise({
      try: () =>
        ctx.db.patch(schedule._id, {
          status: "failed",
          scheduledFunctionId: null,
          updatedAtMs: now,
          failedAtMs: now,
          failureMessage: args.failureMessage,
        }),
      catch: (error) =>
        toScheduleExternalServiceError("Failed to mark the scheduled batch as failed.", error),
    });
    return null;
  });
}
