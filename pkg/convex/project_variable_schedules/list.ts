import { Effect } from "effect";
import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  BarekeyConfectQueryCtx,
  effectQuery,
} from "../confect";
import { ExternalServiceError } from "../lib/errors/effect";
import { getCurrentOrgProjectAccessOrNullEffect } from "./access";
import { toScheduleExternalServiceError } from "./errors";
import { scheduleBatchNames, toScheduledScheduleSummary } from "./summary";
import { scheduledScheduleSummaryValidator } from "./validators";

type ListForCurrentOrgProjectArgs = {
  expectedOrgSlug: string;
  projectSlug: string;
};

function listForCurrentOrgProjectEffect(
  args: ListForCurrentOrgProjectArgs,
): Effect.Effect<
  Array<ReturnType<typeof toScheduledScheduleSummary>>,
  ExternalServiceError,
  any
> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectQueryCtx;
    const runtimeCtx = confectCtx.ctx as unknown as QueryCtx;
    const access = yield* getCurrentOrgProjectAccessOrNullEffect(
      runtimeCtx,
      args.expectedOrgSlug,
      args.projectSlug,
    );
    if (access === null) {
      return [];
    }

    const [rows, stages]: [
      Array<Doc<"projectVariableSchedules">>,
      Array<Doc<"projectStages">>,
    ] = yield* Effect.tryPromise({
      try: () =>
        Promise.all([
          runtimeCtx.db
            .query("projectVariableSchedules")
            .withIndex("by_project_id_and_run_at_ms", (q) => q.eq("projectId", access.project._id))
            .collect(),
          runtimeCtx.db
            .query("projectStages")
            .withIndex("by_project_id", (q) => q.eq("projectId", access.project._id))
            .collect(),
        ]),
      catch: (error) =>
        toScheduleExternalServiceError("Failed to list scheduled variable batches.", error),
    });

    const stageNames = new Map(stages.map((stage) => [stage.slug, stage.name] as const));
    return rows
      .map((row) =>
        toScheduledScheduleSummary({
          id: row._id,
          stageSlug: row.stageSlug,
          stageName: stageNames.get(row.stageSlug) ?? row.stageSlug,
          timezone: row.timezone,
          runAtMs: row.runAtMs,
          status: row.status,
          createdCount: row.createdCount,
          updatedCount: row.updatedCount,
          batchNames: scheduleBatchNames({
            creates: row.preparedCreates,
            updateTargets: row.updateTargets,
          }),
          createdAtMs: row.createdAtMs,
          updatedAtMs: row.updatedAtMs,
          executedAtMs: row.executedAtMs,
          canceledAtMs: row.canceledAtMs,
          failedAtMs: row.failedAtMs,
          failureMessage: row.failureMessage,
        }),
      )
      .sort((left, right) => left.runAtMs - right.runAtMs);
  });
}

/**
 * Lists scheduled variable batches for the current workspace project.
 *
 * @param runtimeCtx The Convex public query context.
 * @param args The workspace slug and project slug to inspect.
 * @returns Scheduled batch summaries ordered by run time, or an empty list when inaccessible.
 * @remarks This fails closed by returning no rows when the caller is unauthenticated or scoped to a different workspace.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const listForCurrentOrgProject = effectQuery<
  ListForCurrentOrgProjectArgs,
  Array<ReturnType<typeof toScheduledScheduleSummary>>,
  any
>({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
  },
  returns: v.array(scheduledScheduleSummaryValidator),
  handler: listForCurrentOrgProjectEffect,
});
