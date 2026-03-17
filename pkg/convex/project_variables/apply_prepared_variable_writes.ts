import { v } from "convex/values";

import { internalMutation } from "../confect";
import {
  projectVariablePreparedCreateValidator as preparedWriteCreateValidator,
  projectVariablePreparedUpdateValidator as preparedWriteUpdateValidator,
} from "../lib/project_variable_schedules";
import {
  listProjectVariableRowsForStage,
  requireProjectStageByOrgIdAndSlug,
} from "../lib/project_scope";
import { summarizePreparedWriteApplication } from "./prepared_write_summary";
import type { WriteWithUsageResult } from "./types";

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
export const measurePreparedVariableWritesForOrgProjectStageInternal = internalMutation({
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
  handler: async (ctx, args) => {
    const { project, stage } = await requireProjectStageByOrgIdAndSlug(ctx.db, {
      orgId: args.orgId,
      projectSlug: args.projectSlug,
      stageSlug: args.stageSlug,
    });

    const existingRows = await listProjectVariableRowsForStage(ctx.db, {
      projectId: project._id,
      stageSlug: stage.slug,
    });

    return summarizePreparedWriteApplication({
      existingRows,
      creates: args.creates,
      updates: args.updates,
      deletes: args.deletes,
    });
  },
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
export const applyPreparedVariableWritesForOrgProjectStageInternal = internalMutation({
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
  handler: async (ctx, args): Promise<WriteWithUsageResult> => {
    const { project, stage } = await requireProjectStageByOrgIdAndSlug(ctx.db, {
      orgId: args.orgId,
      projectSlug: args.projectSlug,
      stageSlug: args.stageSlug,
    });

    const existingRows = await listProjectVariableRowsForStage(ctx.db, {
      projectId: project._id,
      stageSlug: stage.slug,
    });
    const byId = new Map(existingRows.map((row) => [row._id, row] as const));
    const stageVariableNames = new Set(existingRows.map((row) => row.name));
    const deletedIds = new Set(args.deletes);
    for (const variableId of deletedIds) {
      const existing = byId.get(variableId);
      if (!existing) {
        throw new Error("Variable delete target does not exist.");
      }
      stageVariableNames.delete(existing.name);
    }

    const now = Date.now();
    for (const update of args.updates) {
      const existing = byId.get(update.id);
      if (!existing) {
        throw new Error("Variable update target does not exist.");
      }
      if (deletedIds.has(update.id)) {
        throw new Error("Cannot update a variable that is marked for deletion.");
      }

      await ctx.db.patch(update.id, {
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
      });
    }

    for (const create of args.creates) {
      if (stageVariableNames.has(create.name)) {
        throw new Error(`Variable ${create.name} already exists in this stage.`);
      }

      await ctx.db.insert("projectVariables", {
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
      });
      stageVariableNames.add(create.name);
    }

    for (const variableId of deletedIds) {
      await ctx.db.delete(variableId);
    }

    return {
      createdCount: args.creates.length,
      updatedCount: args.updates.length,
      deletedCount: deletedIds.size,
    };
  },
});
