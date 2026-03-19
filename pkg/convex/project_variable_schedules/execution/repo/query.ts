import { Effect } from "effect";

import type { Doc } from "../../../_generated/dataModel";
import type { QueryCtx, ActionCtx } from "../../../_generated/server";
import { dbGetEffect } from "../../../lib/convex/db";
import { runActionEffect, runQueryEffect } from "../../../lib/convex/functions";
import { applyPreparedVariableWritesForOrgProjectStageWithUsageInternalReference } from "../../../project_variables/refs";
import { getScheduleForExecutionInternalReference } from "../../refs";
import { toScheduleExternalServiceError } from "../../errors";
import type { GetScheduleForExecutionArgs, ScheduleExecutionRow } from "../types";

/**
 * Loads the execution payload for one scheduled batch through the internal query boundary.
 *
 * @param ctx The Convex action context.
 * @param args The schedule identifier to load.
 * @returns The execution payload, or `null`.
 * @remarks This hides the cross-function query call behind one execution-specific gateway.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function readScheduleExecutionPayloadEffect(
  ctx: ActionCtx,
  args: GetScheduleForExecutionArgs,
) {
  return runQueryEffect<ScheduleExecutionRow | null, ReturnType<typeof toScheduleExternalServiceError>>(
    ctx,
    getScheduleForExecutionInternalReference,
    {
      scheduleId: args.scheduleId,
    },
    (error) =>
      toScheduleExternalServiceError(
        "Failed to load the scheduled batch execution payload.",
        error,
      ),
  );
}

/**
 * Applies the prepared variable writes for one scheduled batch.
 *
 * @param ctx The Convex action context.
 * @param schedule The execution payload to apply.
 * @returns An Effect that completes after the write action succeeds.
 * @remarks This delegates to the prepared-write action used by normal variable writes.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function applyScheduledVariableWritesEffect(
  ctx: ActionCtx,
  schedule: ScheduleExecutionRow,
) {
  return runActionEffect<unknown, ReturnType<typeof toScheduleExternalServiceError>>(
    ctx,
    applyPreparedVariableWritesForOrgProjectStageWithUsageInternalReference,
    {
      orgId: schedule.orgId,
      orgSlug: null,
      clerkUserId: "scheduled-system",
      projectSlug: schedule.projectSlug,
      stageSlug: schedule.stageSlug,
      creates: schedule.preparedCreates,
      updates: schedule.preparedUpdates,
      deletes: [],
    },
    (error) => toScheduleExternalServiceError("Scheduled update failed.", error),
  );
}

/**
 * Loads the schedule/project pair needed by the internal scheduler query.
 *
 * @param ctx The Convex query context.
 * @param args The schedule id to load.
 * @returns The schedule row and owning project row, or `null`.
 * @remarks This keeps the internal query loader out of the public execution program.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function loadScheduleExecutionSourceRowsEffect(
  ctx: QueryCtx,
  args: GetScheduleForExecutionArgs,
) {
  return Effect.gen(function* () {
    const schedule = yield* dbGetEffect<
      Doc<"projectVariableSchedules">,
      ReturnType<typeof toScheduleExternalServiceError>
    >(ctx, args.scheduleId, (error) =>
      toScheduleExternalServiceError("Failed to load the scheduled batch.", error),
    );
    if (schedule === null) {
      return null;
    }

    const project = yield* dbGetEffect<
      Doc<"projects">,
      ReturnType<typeof toScheduleExternalServiceError>
    >(ctx, schedule.projectId, (error) =>
      toScheduleExternalServiceError("Failed to load the scheduled batch project.", error),
    );
    if (project === null) {
      return null;
    }

    return { schedule, project };
  });
}
