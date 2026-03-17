import { v } from "convex/values";

import { internalMutation } from "../confect";
import { encryptSecretValueForProject } from "../lib/encryption";
import {
  encryptedPayloadByteLength,
  preparedDraftCreateValidator,
  preparedDraftUpdateValidator,
  validateVariableName,
} from "../lib/project_variables_shared";
import {
  listProjectVariableRowsForStage,
  requireProjectStageByOrgIdAndSlug,
} from "../lib/project_scope";
import { getVariableVisibility } from "../lib/visibility";
import { requireCurrentOrgAccess } from "./access";
import type {
  DraftWriteResult,
  PreparedDraft,
  PreparedDraftCreateEntry,
  PreparedDraftUpdateEntry,
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
export const prepareDraftForCurrentOrgProjectStageInternal = internalMutation({
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
  handler: async (ctx, args): Promise<PreparedDraft> => {
    const activeOrg = await requireCurrentOrgAccess(ctx, args.expectedOrgSlug);

    const { project, stage } = await requireProjectStageByOrgIdAndSlug(ctx.db, {
      orgId: activeOrg.orgId,
      projectSlug: args.projectSlug,
      stageSlug: args.stageSlug,
    });

    const existingRows = await listProjectVariableRowsForStage(ctx.db, {
      projectId: project._id,
      stageSlug: stage.slug,
    });
    const byId = new Map(existingRows.map((row) => [row._id, row] as const));
    const stageVariableNames = new Set(existingRows.map((row) => row.name));

    let storageDeltaBytes = 0;
    const deletedIds = new Set(args.deletes);
    for (const variableId of deletedIds) {
      const existing = byId.get(variableId);
      if (!existing) {
        throw new Error("Variable delete target does not exist.");
      }
      stageVariableNames.delete(existing.name);
      storageDeltaBytes -= encryptedPayloadByteLength({
        encryptedValue: existing.encryptedValue,
        encryptedValueA: existing.encryptedValueA,
        encryptedValueB: existing.encryptedValueB,
      });
    }

    const preparedUpdates: Array<PreparedDraftUpdateEntry> = [];
    for (const update of args.updates) {
      const existing = byId.get(update.id);
      if (!existing) {
        throw new Error("Variable update target does not exist.");
      }
      if (deletedIds.has(update.id)) {
        throw new Error("Cannot update a variable that is marked for deletion.");
      }

      const encryptedValue = await encryptSecretValueForProject(ctx, {
        projectId: project._id,
        orgId: project.orgId,
        plaintext: update.value,
      });

      storageDeltaBytes +=
        encryptedPayloadByteLength({
          encryptedValue,
          encryptedValueA: null,
          encryptedValueB: null,
        }) -
        encryptedPayloadByteLength({
          encryptedValue: existing.encryptedValue,
          encryptedValueA: existing.encryptedValueA,
          encryptedValueB: existing.encryptedValueB,
        });
      preparedUpdates.push({
        id: update.id,
        visibility: getVariableVisibility(existing),
        kind: update.kind,
        declaredType: "string",
        encryptedValue,
      });
    }

    const preparedCreates: Array<PreparedDraftCreateEntry> = [];
    for (const create of args.creates) {
      const name = validateVariableName(create.name);
      if (stageVariableNames.has(name)) {
        throw new Error(`Variable ${name} already exists in this stage.`);
      }

      const encryptedValue = await encryptSecretValueForProject(ctx, {
        projectId: project._id,
        orgId: project.orgId,
        plaintext: create.value,
      });
      storageDeltaBytes += encryptedPayloadByteLength({
        encryptedValue,
        encryptedValueA: null,
        encryptedValueB: null,
      });
      preparedCreates.push({
        name,
        visibility: "private",
        kind: create.kind,
        declaredType: "string",
        encryptedValue,
      });
      stageVariableNames.add(name);
    }

    return {
      orgId: project.orgId,
      storageDeltaBytes,
      creates: preparedCreates,
      updates: preparedUpdates,
      deletes: Array.from(deletedIds),
      createdCount: preparedCreates.length,
      updatedCount: preparedUpdates.length,
      deletedCount: deletedIds.size,
    };
  },
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
export const applyPreparedDraftForCurrentOrgProjectStageInternal = internalMutation({
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
  handler: async (ctx, args): Promise<DraftWriteResult> => {
    const activeOrg = await requireCurrentOrgAccess(ctx, args.expectedOrgSlug);

    const { project, stage } = await requireProjectStageByOrgIdAndSlug(ctx.db, {
      orgId: activeOrg.orgId,
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
        encryptedValueA: null,
        encryptedValueB: null,
        chance: null,
        rolloutFunction: null,
        rolloutMilestones: null,
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
        encryptedValueA: null,
        encryptedValueB: null,
        chance: null,
        rolloutFunction: null,
        rolloutMilestones: null,
        createdByClerkUserId: activeOrg.clerkUserId,
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
