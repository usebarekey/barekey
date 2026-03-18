import { Effect } from "effect";

import type { MutationCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { type ExternalServiceError } from "../../lib/errors/effect";
import { toScheduleSnapshotExternalError } from "./errors";

type AttachScheduledFunctionIdInput = {
  ctx: MutationCtx;
  scheduleId: Id<"projectVariableSchedules">;
  scheduledFunctionId: Id<"_scheduled_functions">;
};

/**
 * Stores a scheduler function ID only if the schedule is still pending.
 *
 * @param input The mutation context, schedule ID, and scheduled function ID to attach.
 * @returns The latest persisted schedule row after the conditional patch, or `null` if the schedule no longer exists.
 * @remarks This guards against a race where the scheduled action fires before we persist the returned scheduler handle.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function attachScheduledFunctionIdIfStillPendingEffect(
  input: AttachScheduledFunctionIdInput,
): Effect.Effect<Doc<"projectVariableSchedules"> | null, ExternalServiceError> {
  return Effect.gen(function* () {
    const latest = yield* Effect.tryPromise({
      try: () => input.ctx.db.get(input.scheduleId),
      catch: (error) =>
        toScheduleSnapshotExternalError(
          "Failed to load the latest scheduled batch state.",
          error,
        ),
    });
    if (latest === null || latest.status !== "scheduled") {
      return latest;
    }

    yield* Effect.tryPromise({
      try: () =>
        input.ctx.db.patch(input.scheduleId, {
          scheduledFunctionId: input.scheduledFunctionId,
        }),
      catch: (error) =>
        toScheduleSnapshotExternalError(
          "Failed to attach the scheduler function id to the batch.",
          error,
        ),
    });

    return yield* Effect.tryPromise({
      try: () => input.ctx.db.get(input.scheduleId),
      catch: (error) =>
        toScheduleSnapshotExternalError(
          "Failed to reload the scheduled batch after attaching the scheduler handle.",
          error,
        ),
    });
  });
}

/**
 * Stores a scheduler function ID only if the schedule is still pending.
 *
 * @param input The mutation context, schedule ID, and scheduled function ID to attach.
 * @returns The latest persisted schedule row after the conditional patch, or `null` if the schedule no longer exists.
 * @remarks This compatibility wrapper keeps promise-based callers working while the domain moves to Effect.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function attachScheduledFunctionIdIfStillPending(
  input: AttachScheduledFunctionIdInput,
) {
  return await Effect.runPromise(
    attachScheduledFunctionIdIfStillPendingEffect(input).pipe(
      Effect.mapError((error) => new Error(error.message)),
    ),
  );
}
