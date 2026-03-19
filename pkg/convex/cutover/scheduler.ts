import { Effect } from "effect";

import { toCutoverError } from "./shared";

/**
 * Cancels scheduled functions attached to scheduled variable writes during cutover.
 *
 * @param schedules The scheduled variable write rows.
 * @param cancel The scheduler cancellation function.
 * @returns An Effect that yields the number of successfully cancelled scheduled functions.
 * @remarks Individual cancellation failures are logged and suppressed so data wipe can still proceed.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function cancelScheduledCutoverFunctionsEffect(
  schedules: Array<{
    _id: string;
    scheduledFunctionId: string | null;
  }>,
  cancel: (scheduledFunctionId: string) => Promise<void>,
) {
  return Effect.gen(function* () {
    let cancelledScheduledFunctionCount = 0;
    for (const schedule of schedules) {
      if (schedule.scheduledFunctionId === null) {
        continue;
      }

      const scheduledFunctionId = schedule.scheduledFunctionId;
      const cancelled = yield* Effect.catchAll(
        Effect.tryPromise({
          try: () => cancel(scheduledFunctionId),
          catch: (error) =>
            toCutoverError("Failed to cancel a scheduled variable write during cutover.", error),
        }).pipe(Effect.as(true)),
        (error) =>
          Effect.sync(() => {
            console.error("Failed to cancel scheduled variable write during cutover.", {
              error,
              scheduleId: String(schedule._id),
              scheduledFunctionId,
            });
            return false;
          }),
      );

      if (cancelled) {
        cancelledScheduledFunctionCount += 1;
      }
    }

    return cancelledScheduledFunctionCount;
  });
}
