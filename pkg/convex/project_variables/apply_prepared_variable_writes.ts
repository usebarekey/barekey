import { Effect } from "effect";
import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  BarekeyConfectMutationCtx,
  ClockService,
  effectInternalMutation,
} from "../confect";
import {
  projectVariablePreparedCreateValidator as preparedWriteCreateValidator,
  projectVariablePreparedUpdateValidator as preparedWriteUpdateValidator,
} from "../lib/project_variables/schedules";
import {
  listProjectVariableRowsForStageEffect,
  requireProjectStageByOrgIdAndSlugEffect,
} from "../lib/projects/scope";
import { ValidationError } from "../lib/errors/effect";
import {
  toProjectVariableExternalServiceError,
  toProjectVariableValidationError,
} from "./errors";
import { summarizePreparedWriteApplication } from "./prepared_write_summary";
import type { WriteWithUsageResult } from "./types";

type MeasurePreparedVariableWritesArgs = {
  orgId: string;
  projectSlug: string;
  stageSlug: string;
  creates: Array<any>;
  updates: Array<any>;
  deletes: Array<Id<"projectVariables">>;
};

type ApplyPreparedVariableWritesArgs = {
  orgId: string;
  clerkUserId: string;
  projectSlug: string;
  stageSlug: string;
  creates: Array<any>;
  updates: Array<any>;
  deletes: Array<Id<"projectVariables">>;
};

function measurePreparedVariableWritesForOrgProjectStageInternalEffect(
  args: MeasurePreparedVariableWritesArgs,
): Effect.Effect<{ storageDeltaBytes: number }, unknown, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectMutationCtx;
    const ctx = confectCtx.ctx as unknown as MutationCtx;
    const { project, stage } = yield* requireProjectStageByOrgIdAndSlugEffect(ctx.db, {
      orgId: args.orgId,
      projectSlug: args.projectSlug,
      stageSlug: args.stageSlug,
    });

    const existingRows = yield* listProjectVariableRowsForStageEffect(ctx.db, {
      projectId: project._id,
      stageSlug: stage.slug,
    });

    return yield* Effect.try({
      try: () =>
        summarizePreparedWriteApplication({
          existingRows,
          creates: args.creates,
          updates: args.updates,
          deletes: args.deletes,
        }),
      catch: (error) =>
        toProjectVariableValidationError(
          "Prepared variable write measurement is invalid.",
          error,
        ),
    });
  });
}

function applyPreparedVariableWritesForOrgProjectStageInternalEffect(
  args: ApplyPreparedVariableWritesArgs,
): Effect.Effect<WriteWithUsageResult, unknown, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectMutationCtx;
    const clock = yield* ClockService;
    const ctx = confectCtx.ctx as unknown as MutationCtx;
    const { project, stage } = yield* requireProjectStageByOrgIdAndSlugEffect(ctx.db, {
      orgId: args.orgId,
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

      yield* Effect.tryPromise({
        try: () =>
          ctx.db.patch(update.id, {
            visibility: update.visibility,
            kind: update.kind,
            declaredType: update.declaredType,
            encryptedValue: update.encryptedValue,
            encryptedValueA: update.encryptedValueA,
            encryptedValueB: update.encryptedValueB,
            chance: update.chance,
            rolloutFunction: update.rolloutFunction,
            rolloutMilestones: update.rolloutMilestones,
            updatedAtMs: now,
          }),
        catch: (error) =>
          toProjectVariableExternalServiceError(
            "Failed to update a prepared project variable.",
            error,
          ),
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
            encryptedValueA: create.encryptedValueA,
            encryptedValueB: create.encryptedValueB,
            chance: create.chance,
            rolloutFunction: create.rolloutFunction,
            rolloutMilestones: create.rolloutMilestones,
            createdByClerkUserId: args.clerkUserId,
            createdAtMs: now,
            updatedAtMs: now,
          }),
        catch: (error) =>
          toProjectVariableExternalServiceError(
            "Failed to insert a prepared project variable.",
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
            "Failed to delete a prepared project variable.",
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

/**
 * Recomputes the storage delta of a prepared variable write against the latest
 * persisted stage state.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The org, project, stage, and prepared write payloads to measure.
 * @returns The net encrypted storage delta for the prepared write set.
 * @remarks This is used immediately before billed writes commit to catch drift between preparation and application.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const measurePreparedVariableWritesForOrgProjectStageInternal = effectInternalMutation<
  MeasurePreparedVariableWritesArgs,
  { storageDeltaBytes: number },
  any
>({
  args: {
    orgId: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
    creates: v.array(preparedWriteCreateValidator),
    updates: v.array(preparedWriteUpdateValidator),
    deletes: v.array(v.id("projectVariables")),
  },
  returns: v.object({
    storageDeltaBytes: v.number(),
  }),
  handler: measurePreparedVariableWritesForOrgProjectStageInternalEffect,
});

/**
 * Commits a previously prepared HTTP or CLI variable write transaction.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The org, project, stage, and prepared write payloads to commit.
 * @returns The final create, update, and delete counts applied to the stage.
 * @remarks This mutates `projectVariables` only after validating that prepared targets still match the current stage state.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const applyPreparedVariableWritesForOrgProjectStageInternal = effectInternalMutation<
  ApplyPreparedVariableWritesArgs,
  WriteWithUsageResult,
  any
>({
  args: {
    orgId: v.string(),
    clerkUserId: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
    creates: v.array(preparedWriteCreateValidator),
    updates: v.array(preparedWriteUpdateValidator),
    deletes: v.array(v.id("projectVariables")),
  },
  returns: v.object({
    createdCount: v.number(),
    updatedCount: v.number(),
    deletedCount: v.number(),
  }),
  handler: applyPreparedVariableWritesForOrgProjectStageInternalEffect,
});
