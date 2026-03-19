import { Effect } from "effect";

import type { QueryCtx } from "../../_generated/server";
import { BarekeyConfectQueryCtx } from "../../confect";
import type { GetScheduleForExecutionArgs, ScheduleExecutionRow } from "./types";
import { loadScheduleExecutionSourceRowsEffect } from "./repo";

/**
 * Loads the data needed by the scheduler to execute a pending variable batch.
 *
 * @param args The schedule identifier to load.
 * @returns The execution payload for the schedule, or `null` when it no longer exists.
 * @remarks This joins the schedule row with the owning project so scheduler actions do not need extra lookups.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function getScheduleForExecutionInternalEffect(
  args: GetScheduleForExecutionArgs,
): Effect.Effect<ScheduleExecutionRow | null, unknown, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectQueryCtx;
    const ctx = confectCtx.ctx as unknown as QueryCtx;
    const sourceRows = yield* loadScheduleExecutionSourceRowsEffect(ctx, args);
    if (sourceRows === null) {
      return null;
    }
    const { schedule, project } = sourceRows;

    return {
      scheduleId: schedule._id,
      projectId: project._id,
      orgSlug: project.orgSlug,
      projectSlug: project.slug,
      orgId: schedule.orgId,
      stageSlug: schedule.stageSlug,
      timezone: schedule.timezone,
      runAtMs: schedule.runAtMs,
      createdCount: schedule.createdCount,
      updatedCount: schedule.updatedCount,
      preparedCreates: schedule.preparedCreates,
      preparedUpdates: schedule.preparedUpdates,
      updateTargets: schedule.updateTargets,
      status: schedule.status,
    };
  });
}
