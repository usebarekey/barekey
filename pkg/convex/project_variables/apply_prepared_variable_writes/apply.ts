import { Effect } from "effect";

import type { MutationCtx } from "../../_generated/server";
import {
  BarekeyConfectMutationCtx,
  ClockService,
  effectInternalMutation,
} from "../../confect";
import { ValidationError } from "../../lib/errors/effect";
import {
  deleteProjectVariableRowEffect,
  insertProjectVariableRowEffect,
  patchProjectVariableRowEffect,
} from "../persist";
import type { WriteWithUsageResult } from "../types";
import {
  applyPreparedVariableWritesArgs,
  writeWithUsageResultValidator,
  type ApplyPreparedVariableWritesArgs,
} from "./shared";
import { loadPreparedWriteStageStateEffect } from "./state";

function applyPreparedVariableWritesForOrgProjectStageInternalEffect(
  args: ApplyPreparedVariableWritesArgs,
): Effect.Effect<WriteWithUsageResult, unknown, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectMutationCtx;
    const clock = yield* ClockService;
    const ctx = confectCtx.ctx as unknown as MutationCtx;
    const { project, stage, existingRows } = yield* loadPreparedWriteStageStateEffect(ctx, args);
    const byId = new Map(existingRows.map((row) => [row._id, row] as const));
    const stageVariableNames = new Set(existingRows.map((row) => row.name));
    const deletedIds = new Set(args.deletes);

    for (const variableId of deletedIds) {
      const existing = byId.get(variableId);
      if (!existing) {
        return yield* Effect.fail(
          new ValidationError({ message: "Variable delete target does not exist." }),
        );
      }
      stageVariableNames.delete(existing.name);
    }

    const now = clock.nowMs();
    for (const update of args.updates) {
      const existing = byId.get(update.id);
      if (!existing) {
        return yield* Effect.fail(
          new ValidationError({ message: "Variable update target does not exist." }),
        );
      }
      if (deletedIds.has(update.id)) {
        return yield* Effect.fail(
          new ValidationError({
            message: "Cannot update a variable that is marked for deletion.",
          }),
        );
      }

      yield* patchProjectVariableRowEffect(ctx, {
        id: update.id,
        values: {
          visibility: update.visibility,
          kind: update.kind,
          declaredType: update.declaredType,
          encryptedValue: update.encryptedValue,
          encryptedValueA: update.encryptedValueA,
          encryptedValueB: update.encryptedValueB,
          chance: update.chance,
          rolloutFunction: update.rolloutFunction,
          rolloutMilestones: update.rolloutMilestones,
        },
        updatedAtMs: now,
        failureMessage: "Failed to update a prepared project variable.",
      });
    }

    for (const create of args.creates) {
      if (stageVariableNames.has(create.name)) {
        return yield* Effect.fail(
          new ValidationError({
            message: `Variable ${create.name} already exists in this stage.`,
          }),
        );
      }

      yield* insertProjectVariableRowEffect(ctx, {
        projectId: project._id,
        orgId: project.orgId,
        stageSlug: stage.slug,
        name: create.name,
        clerkUserId: args.clerkUserId,
        values: {
          visibility: create.visibility,
          kind: create.kind,
          declaredType: create.declaredType,
          encryptedValue: create.encryptedValue,
          encryptedValueA: create.encryptedValueA,
          encryptedValueB: create.encryptedValueB,
          chance: create.chance,
          rolloutFunction: create.rolloutFunction,
          rolloutMilestones: create.rolloutMilestones,
        },
        createdAtMs: now,
        updatedAtMs: now,
        failureMessage: "Failed to insert a prepared project variable.",
      });
      stageVariableNames.add(create.name);
    }

    for (const variableId of deletedIds) {
      yield* deleteProjectVariableRowEffect(ctx, {
        id: variableId,
        failureMessage: "Failed to delete a prepared project variable.",
      });
    }

    return {
      createdCount: args.creates.length,
      updatedCount: args.updates.length,
      deletedCount: deletedIds.size,
    };
  });
}

/**
 * Commits a previously prepared HTTP or CLI variable write transaction.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The org, project, stage, and prepared write payloads to commit.
 * @returns The final create, update, and delete counts applied to the stage.
 * @remarks This mutates `projectVariables` only after validating that prepared targets still match the current stage state.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const applyPreparedVariableWritesForOrgProjectStageInternal = effectInternalMutation<
  ApplyPreparedVariableWritesArgs,
  WriteWithUsageResult,
  any
>({
  args: applyPreparedVariableWritesArgs,
  returns: writeWithUsageResultValidator,
  handler: applyPreparedVariableWritesForOrgProjectStageInternalEffect,
});
