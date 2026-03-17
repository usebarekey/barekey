import { v } from "convex/values";

import { query } from "../confect";
import { getCurrentOrgProjectAccessOrNull } from "./access";
import {
  scheduleBatchNames,
  toScheduledScheduleSummary,
} from "./snapshot";
import { scheduledScheduleSummaryValidator } from "./validators";

/**
 * Lists scheduled variable batches for the current workspace project.
 *
 * @param ctx The Convex public query context.
 * @param args The workspace slug and project slug to inspect.
 * @returns Scheduled batch summaries ordered by run time, or an empty list when inaccessible.
 * @remarks This fails closed by returning no rows when the caller is unauthenticated or scoped to a different workspace.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const listForCurrentOrgProject = query({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
  },
  returns: v.array(scheduledScheduleSummaryValidator),
  handler: async (ctx, args) => {
    const access = await getCurrentOrgProjectAccessOrNull(
      ctx,
      args.expectedOrgSlug,
      args.projectSlug,
    );
    if (access === null) {
      return [];
    }

    const [rows, stages] = await Promise.all([
      ctx.db
        .query("projectVariableSchedules")
        .withIndex("by_project_id_and_run_at_ms", (q) => q.eq("projectId", access.project._id))
        .collect(),
      ctx.db
        .query("projectStages")
        .withIndex("by_project_id", (q) => q.eq("projectId", access.project._id))
        .collect(),
    ]);

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
  },
});
