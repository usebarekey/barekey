import { Effect } from "effect";

import type { MutationCtx } from "../../_generated/server";
import { BarekeyConfectMutationCtx, ClockService } from "../../confect";
import {
  listProjectVariableRowsForStageEffect,
  requireProjectStageByOrgIdAndSlugEffect,
} from "../../lib/projects/scope";
import { requireCurrentOrgAccessEffect } from "../access";
import {
  projectVariableValidationError,
  toProjectVariableExternalServiceError,
} from "../errors";
import type { ApplyPreparedDraftArgs, DraftWriteResult } from "../types";

/**
 * Commits a previously prepared encrypted draft in one mutation transaction.
 *
 * @param args The workspace, project, stage, and prepared draft payload to commit.
 * @returns The final create, update, and delete counts applied to the stage.
 * @remarks This mutates `projectVariables` only after validating that prepared draft targets still match the stage state.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function applyPreparedDraftForCurrentOrgProjectStageInternalEffect(
  args: ApplyPreparedDraftArgs,
): Effect.Effect<DraftWriteResult, unknown, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectMutationCtx;
    const clock = yield* ClockService;
    const ctx = confectCtx.ctx as unknown as MutationCtx;
    const activeOrg = yield* requireCurrentOrgAccessEffect(ctx, args.expectedOrgSlug);

    const { project, stage } = yield* requireProjectStageByOrgIdAndSlugEffect(ctx.db, {
      orgId: activeOrg.orgId,
      projectSlug: args.projectSlug,
      stageSlug: args.stageSlug,
    });

    const existingRows = yield* listProjectVariableRowsForStageEffect(ctx.db, {
      projectId: project._id,
      stageSlug: stage.slug,
    });
    const byId = new Map(existingRows.map((row) => [row._id, row] as const));
    const stageVariableNames = new Set(existingRows.map((row) => row.name));

    const deletedIds = new Set(args.deletes);
    for (const variableId of deletedIds) {
      const existing = byId.get(variableId);
      if (!existing) {
        return yield* Effect.fail(
          projectVariableValidationError("Variable delete target does not exist."),
        );
      }
      stageVariableNames.delete(existing.name);
    }

    const now = clock.nowMs();
    for (const update of args.updates) {
      const existing = byId.get(update.id);
      if (!existing) {
        return yield* Effect.fail(
          projectVariableValidationError("Variable update target does not exist."),
        );
      }
      if (deletedIds.has(update.id)) {
        return yield* Effect.fail(
          projectVariableValidationError(
            "Cannot update a variable that is marked for deletion.",
          ),
        );
      }

      yield* Effect.tryPromise({
        try: () =>
          ctx.db.patch(update.id, {
            visibility: update.visibility,
            kind: update.kind,
            declaredType: update.declaredType,
            encryptedValue: update.encryptedValue,
            encryptedValueA: null,
            encryptedValueB: null,
            chance: null,
            rolloutFunction: null,
            rolloutMilestones: null,
            updatedAtMs: now,
          }),
        catch: (error) =>
          toProjectVariableExternalServiceError(
            "Failed to apply a prepared draft variable update.",
            error,
          ),
      });
    }

    for (const create of args.creates) {
      if (stageVariableNames.has(create.name)) {
        return yield* Effect.fail(
          projectVariableValidationError(
            `Variable ${create.name} already exists in this stage.`,
          ),
        );
      }

      yield* Effect.tryPromise({
        try: () =>
          ctx.db.insert("projectVariables", {
            projectId: project._id,
            orgId: project.orgId,
            stageSlug: stage.slug,
            name: create.name,
            visibility: create.visibility,
            kind: create.kind,
            declaredType: create.declaredType,
            encryptedValue: create.encryptedValue,
            encryptedValueA: null,
            encryptedValueB: null,
            chance: null,
            rolloutFunction: null,
            rolloutMilestones: null,
            createdByClerkUserId: activeOrg.clerkUserId,
            createdAtMs: now,
            updatedAtMs: now,
          }),
        catch: (error) =>
          toProjectVariableExternalServiceError(
            "Failed to insert a prepared draft variable.",
            error,
          ),
      });
      stageVariableNames.add(create.name);
    }

    for (const variableId of deletedIds) {
      yield* Effect.tryPromise({
        try: () => ctx.db.delete(variableId),
        catch: (error) =>
          toProjectVariableExternalServiceError(
            "Failed to delete a prepared draft variable.",
            error,
          ),
      });
    }

    return {
      createdCount: args.creates.length,
      updatedCount: args.updates.length,
      deletedCount: deletedIds.size,
    };
  });
}
