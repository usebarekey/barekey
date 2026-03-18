import { Effect } from "effect";
import { v } from "convex/values";

import type { Id } from "../../_generated/dataModel";
import type { ActionCtx } from "../../_generated/server";
import {
  BarekeyConfectActionCtx,
  effectInternalAction,
} from "../../confect";
import {
  writeEntryValidator,
  writeModeValidator,
} from "../../lib/project_variables/contracts";
import { toProjectVariableExternalServiceError } from "../errors";
import {
  applyPreparedVariableWritesForOrgProjectStageWithUsageInternalReference,
  prepareVariableWritesForOrgProjectStageInternalReference,
} from "../refs";
import type { WriteWithUsageResult } from "../types";

type WriteVariablesWithUsageArgs = {
  orgId: string;
  orgSlug: string | null;
  clerkUserId: string;
  projectSlug: string;
  stageSlug: string;
  mode: "create_only" | "upsert";
  entries: Array<any>;
  deletes: Array<string>;
};

/**
 * Prepares and then commits a variable write through the metered internal pipeline.
 *
 * @param args The org, project, stage, and draft write instructions to execute.
 * @returns The final create, update, and delete counts applied to the stage.
 * @remarks This first prepares encrypted payloads in a mutation and then delegates the commit to the metered apply action.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function writeVariablesForOrgProjectStageWithUsageInternalEffect(
  args: WriteVariablesWithUsageArgs,
): Effect.Effect<WriteWithUsageResult, unknown, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectActionCtx;
    const ctx = confectCtx.ctx as unknown as ActionCtx;

    const prepared = yield* Effect.tryPromise({
      try: () =>
        ctx.runMutation(
          prepareVariableWritesForOrgProjectStageInternalReference,
          {
            orgId: args.orgId,
            clerkUserId: args.clerkUserId,
            projectSlug: args.projectSlug,
            stageSlug: args.stageSlug,
            mode: args.mode,
            entries: args.entries,
            deletes: args.deletes,
          },
        ) as Promise<{
          creates: Array<any>;
          updates: Array<any>;
          deletes: Array<Id<"projectVariables">>;
        }>,
      catch: (error) =>
        toProjectVariableExternalServiceError(
          "Failed to prepare the variable write payload.",
          error,
        ),
    });

    return yield* Effect.tryPromise({
      try: () =>
        ctx.runAction(
          applyPreparedVariableWritesForOrgProjectStageWithUsageInternalReference,
          {
            orgId: args.orgId,
            orgSlug: args.orgSlug,
            clerkUserId: args.clerkUserId,
            projectSlug: args.projectSlug,
            stageSlug: args.stageSlug,
            creates: prepared.creates,
            updates: prepared.updates,
            deletes: prepared.deletes,
          },
        ) as Promise<WriteWithUsageResult>,
      catch: (error) =>
        toProjectVariableExternalServiceError(
          "Failed to apply the prepared variable write payload with usage checks.",
          error,
        ),
    });
  });
}

/**
 * Prepares, meters, and commits a variable write in one internal action.
 *
 * @param ctx The Convex internal action context.
 * @param args The org, project, stage, and draft write instructions to execute.
 * @returns The final create, update, and delete counts applied to the stage.
 * @remarks This is the top-level internal write entrypoint used by UI drafts and HTTP write flows.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const writeVariablesForOrgProjectStageWithUsageInternal = effectInternalAction<
  WriteVariablesWithUsageArgs,
  WriteWithUsageResult,
  any
>({
  args: {
    orgId: v.string(),
    orgSlug: v.union(v.string(), v.null()),
    clerkUserId: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
    mode: writeModeValidator,
    entries: v.array(writeEntryValidator),
    deletes: v.array(v.string()),
  },
  returns: v.object({
    createdCount: v.number(),
    updatedCount: v.number(),
    deletedCount: v.number(),
  }),
  handler: writeVariablesForOrgProjectStageWithUsageInternalEffect,
});
