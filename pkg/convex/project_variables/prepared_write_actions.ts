import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction } from "../confect";
import {
  projectVariablePreparedCreateValidator as preparedWriteCreateValidator,
  projectVariablePreparedUpdateValidator as preparedWriteUpdateValidator,
} from "../lib/project_variable_schedules";
import {
  writeEntryValidator,
  writeModeValidator,
} from "../lib/project_variables_shared";
import type { WriteWithUsageResult } from "./types";

/**
 * Applies metered storage checks and then commits a prepared variable write.
 *
 * @param ctx The Convex internal action context.
 * @param args The org, project, stage, and prepared write payloads to meter and commit.
 * @returns The final create, update, and delete counts applied to the stage.
 * @remarks This reserves storage units before commit, compensates on failure, and then applies the final storage delta to billing state.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const applyPreparedVariableWritesForOrgProjectStageWithUsageInternal = internalAction({
  args: {
    orgId: v.string(),
    orgSlug: v.union(v.string(), v.null()),
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
    const measurement = await ctx.runMutation(
      internal.project_variables.measurePreparedVariableWritesForOrgProjectStageInternal,
      {
        orgId: args.orgId,
        projectSlug: args.projectSlug,
        stageSlug: args.stageSlug,
        creates: args.creates,
        updates: args.updates,
        deletes: args.deletes,
      },
    );

    let reservedStorageUnits = 0;
    if (measurement.storageDeltaBytes > 0) {
      const reservation = await ctx.runAction(internal.payments.reserveFeatureUnitsForOrgInternal, {
        orgId: args.orgId,
        orgSlug: args.orgSlug,
        featureId: "storage_bytes",
        units: measurement.storageDeltaBytes,
        reason: "project_variables_write",
      });
      if (reservation.errorCode === "USAGE_LIMIT_EXCEEDED") {
        throw new Error("Usage limit exceeded for this workspace plan.");
      }
      if (reservation.errorCode === "BILLING_UNAVAILABLE") {
        throw new Error("Billing service is temporarily unavailable.");
      }
      reservedStorageUnits = reservation.reservedUnits;
    }

    let result: WriteWithUsageResult;
    try {
      result = await ctx.runMutation(
        internal.project_variables.applyPreparedVariableWritesForOrgProjectStageInternal,
        {
          orgId: args.orgId,
          clerkUserId: args.clerkUserId,
          projectSlug: args.projectSlug,
          stageSlug: args.stageSlug,
          creates: args.creates,
          updates: args.updates,
          deletes: args.deletes,
        },
      );
    } catch (error: unknown) {
      if (reservedStorageUnits > 0) {
        try {
          await ctx.runAction(internal.payments.compensateFeatureUnitsForOrgInternal, {
            orgId: args.orgId,
            orgSlug: args.orgSlug,
            featureId: "storage_bytes",
            units: reservedStorageUnits,
            reason: "project_variables_write_rollback",
          });
        } catch (rollbackError: unknown) {
          console.error("HTTP storage usage rollback failed.", rollbackError);
        }
      }
      throw error;
    }

    if (measurement.storageDeltaBytes !== 0) {
      await ctx.runMutation(internal.payments.applyStorageDeltaForOrgInternal, {
        orgId: args.orgId,
        deltaBytes: measurement.storageDeltaBytes,
      });
    }

    if (measurement.storageDeltaBytes < 0) {
      await ctx.runAction(internal.payments.compensateFeatureUnitsForOrgInternal, {
        orgId: args.orgId,
        orgSlug: args.orgSlug,
        featureId: "storage_bytes",
        units: Math.abs(measurement.storageDeltaBytes),
        reason: "project_variables_write_negative_delta",
      });
    }

    return {
      createdCount: result.createdCount,
      updatedCount: result.updatedCount,
      deletedCount: result.deletedCount,
    };
  },
});

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
export const writeVariablesForOrgProjectStageWithUsageInternal = internalAction({
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
  handler: async (ctx, args): Promise<WriteWithUsageResult> => {
    const prepared = await ctx.runMutation(
      internal.project_variables.prepareVariableWritesForOrgProjectStageInternal,
      {
        orgId: args.orgId,
        clerkUserId: args.clerkUserId,
        projectSlug: args.projectSlug,
        stageSlug: args.stageSlug,
        mode: args.mode,
        entries: args.entries,
        deletes: args.deletes,
      },
    );

    return await ctx.runAction(
      internal.project_variables.applyPreparedVariableWritesForOrgProjectStageWithUsageInternal,
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
    );
  },
});
