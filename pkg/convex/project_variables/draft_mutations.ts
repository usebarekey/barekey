import { v } from "convex/values";

import { effectInternalMutation } from "../confect";
import {
  preparedDraftCreateValidator,
  preparedDraftUpdateValidator,
} from "../lib/project_variables/contracts";
import { applyPreparedDraftForCurrentOrgProjectStageInternalEffect } from "./draft/apply";
import { prepareDraftForCurrentOrgProjectStageInternalEffect } from "./draft/prepare";
import type {
  ApplyPreparedDraftArgs,
  DraftWriteResult,
  PrepareDraftArgs,
  PreparedDraft,
} from "./types";

/**
 * Encrypts pending secret-only create and update payloads and computes the
 * exact encrypted-byte delta before the draft write transaction runs.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The workspace, project, stage, and secret draft changes to prepare.
 * @returns The encrypted draft payloads plus the exact storage delta they imply.
 * @remarks This mutates no persisted variable rows and exists to support the draft-apply flow.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const prepareDraftForCurrentOrgProjectStageInternal = effectInternalMutation<
  PrepareDraftArgs,
  PreparedDraft,
  any
>({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
    creates: v.array(
      v.object({
        name: v.string(),
        kind: v.literal("secret"),
        value: v.string(),
      }),
    ),
    updates: v.array(
      v.object({
        id: v.id("projectVariables"),
        kind: v.literal("secret"),
        value: v.string(),
      }),
    ),
    deletes: v.array(v.id("projectVariables")),
  },
  returns: v.object({
    orgId: v.string(),
    storageDeltaBytes: v.number(),
    creates: v.array(preparedDraftCreateValidator),
    updates: v.array(preparedDraftUpdateValidator),
    deletes: v.array(v.id("projectVariables")),
    createdCount: v.number(),
    updatedCount: v.number(),
    deletedCount: v.number(),
  }),
  handler: prepareDraftForCurrentOrgProjectStageInternalEffect,
});

/**
 * Commits a previously prepared encrypted draft in one mutation transaction.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The workspace, project, stage, and prepared draft payload to commit.
 * @returns The final create, update, and delete counts applied to the stage.
 * @remarks This mutates `projectVariables` only after validating that prepared draft targets still match the stage state.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const applyPreparedDraftForCurrentOrgProjectStageInternal = effectInternalMutation<
  ApplyPreparedDraftArgs,
  DraftWriteResult,
  any
>({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
    creates: v.array(preparedDraftCreateValidator),
    updates: v.array(preparedDraftUpdateValidator),
    deletes: v.array(v.id("projectVariables")),
  },
  returns: v.object({
    createdCount: v.number(),
    updatedCount: v.number(),
    deletedCount: v.number(),
  }),
  handler: applyPreparedDraftForCurrentOrgProjectStageInternalEffect,
});
