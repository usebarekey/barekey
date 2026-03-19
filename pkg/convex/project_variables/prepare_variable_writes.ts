import { v } from "convex/values";

import { effectInternalMutation } from "../confect";
import {
  projectVariablePreparedCreateValidator as preparedWriteCreateValidator,
  projectVariablePreparedUpdateValidator as preparedWriteUpdateValidator,
} from "../lib/project_variables/schedules";
import {
  writeEntryValidator,
  writeModeValidator,
} from "../lib/project_variables/contracts";
import { prepareVariableWritesForOrgProjectStageInternalEffect } from "./writes/prepare";
import type {
  PrepareVariableWritesArgs,
  PreparedWriteMutationResult,
} from "./types";

/**
 * Encrypts pending create and update payloads for HTTP and CLI writes before
 * any storage metering or billing reservation occurs.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The org, project, stage, write mode, write entries, and delete names to prepare.
 * @returns The encrypted create, update, and delete payloads plus the exact storage delta they imply.
 * @remarks This performs validation, normalization, and encryption but does not persist any variable changes.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const prepareVariableWritesForOrgProjectStageInternal = effectInternalMutation<
  PrepareVariableWritesArgs,
  PreparedWriteMutationResult,
  any
>({
  args: {
    orgId: v.string(),
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
    storageDeltaBytes: v.number(),
    creates: v.array(preparedWriteCreateValidator),
    updates: v.array(preparedWriteUpdateValidator),
    deletes: v.array(v.id("projectVariables")),
  }),
  handler: prepareVariableWritesForOrgProjectStageInternalEffect,
});
