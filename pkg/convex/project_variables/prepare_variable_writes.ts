import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { internalMutation } from "../confect";
import {
  validateAndNormalizeDeclaredAbRoll,
  validateAndNormalizeDeclaredValue,
} from "../lib/declared_types";
import { encryptSecretValueForProject } from "../lib/encryption";
import {
  projectVariablePreparedCreateValidator as preparedWriteCreateValidator,
  projectVariablePreparedUpdateValidator as preparedWriteUpdateValidator,
} from "../lib/project_variable_schedules";
import { validateRolloutMilestones } from "../lib/rollout";
import {
  encryptedPayloadByteLength,
  validateChance,
  validateVariableName,
  writeEntryValidator,
  writeModeValidator,
} from "../lib/project_variables_shared";
import {
  listProjectVariableRowsForStage,
  requireProjectStageByOrgIdAndSlug,
} from "../lib/project_scope";
import type {
  PreparedWriteCreateEntry,
  PreparedWriteMutationResult,
  PreparedWriteUpdateEntry,
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
export const prepareVariableWritesForOrgProjectStageInternal = internalMutation({
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
  handler: async (ctx, args): Promise<PreparedWriteMutationResult> => {
    const { project, stage } = await requireProjectStageByOrgIdAndSlug(ctx.db, {
      orgId: args.orgId,
      projectSlug: args.projectSlug,
      stageSlug: args.stageSlug,
    });

    const rows = await listProjectVariableRowsForStage(ctx.db, {
      projectId: project._id,
      stageSlug: stage.slug,
    });
    const rowsByName = new Map(rows.map((row) => [row.name, row] as const));

    const seenEntryNames = new Set<string>();
    const normalizedDeletes = new Set<string>();
    for (const name of args.deletes) {
      const normalized = validateVariableName(name);
      if (seenEntryNames.has(normalized)) {
        throw new Error(`Duplicate write entry for variable ${normalized}.`);
      }
      normalizedDeletes.add(normalized);
      seenEntryNames.add(normalized);
    }

    let createdCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;
    let storageDeltaBytes = 0;
    const creates: Array<PreparedWriteCreateEntry> = [];
    const updates: Array<PreparedWriteUpdateEntry> = [];
    const deletes: Array<Id<"projectVariables">> = [];

    for (const entry of args.entries) {
      const name = validateVariableName(entry.name);
      if (seenEntryNames.has(name)) {
        throw new Error(`Duplicate write entry for variable ${name}.`);
      }
      seenEntryNames.add(name);
      if (normalizedDeletes.has(name)) {
        throw new Error(`Variable ${name} cannot be both written and deleted.`);
      }

      const existing = rowsByName.get(name) ?? null;
      if (args.mode === "create_only" && existing !== null) {
        throw new Error(`Variable ${name} already exists in this stage.`);
      }

      if (entry.kind === "secret") {
        const declaredType = entry.declaredType;
        const normalizedValue = validateAndNormalizeDeclaredValue(declaredType, entry.value);
        const encryptedValue = await encryptSecretValueForProject(ctx, {
          projectId: project._id,
          orgId: project.orgId,
          plaintext: normalizedValue,
        });
        const nextBytes = encryptedPayloadByteLength({
          encryptedValue,
          encryptedValueA: null,
          encryptedValueB: null,
        });

        if (existing === null) {
          creates.push({
            name,
            visibility: entry.visibility,
            kind: "secret",
            declaredType,
            encryptedValue,
            encryptedValueA: null,
            encryptedValueB: null,
            chance: null,
            rolloutFunction: null,
            rolloutMilestones: null,
          });
          createdCount += 1;
          storageDeltaBytes += nextBytes;
          continue;
        }

        const previousBytes = encryptedPayloadByteLength({
          encryptedValue: existing.encryptedValue,
          encryptedValueA: existing.encryptedValueA,
          encryptedValueB: existing.encryptedValueB,
        });
        updates.push({
          id: existing._id,
          visibility: entry.visibility,
          kind: "secret",
          declaredType,
          encryptedValue,
          encryptedValueA: null,
          encryptedValueB: null,
          chance: null,
          rolloutFunction: null,
          rolloutMilestones: null,
        });
        updatedCount += 1;
        storageDeltaBytes += nextBytes - previousBytes;
        continue;
      }

      const declaredType = entry.declaredType;
      const normalizedValues = validateAndNormalizeDeclaredAbRoll(
        declaredType,
        entry.valueA,
        entry.valueB,
      );
      const encryptedValueA = await encryptSecretValueForProject(ctx, {
        projectId: project._id,
        orgId: project.orgId,
        plaintext: normalizedValues.valueA,
      });
      const encryptedValueB = await encryptSecretValueForProject(ctx, {
        projectId: project._id,
        orgId: project.orgId,
        plaintext: normalizedValues.valueB,
      });
      const nextBytes = encryptedPayloadByteLength({
        encryptedValue: null,
        encryptedValueA,
        encryptedValueB,
      });

      if (entry.kind === "ab_roll") {
        const chance = validateChance(entry.chance);

        if (existing === null) {
          creates.push({
            name,
            visibility: entry.visibility,
            kind: "ab_roll",
            declaredType,
            encryptedValue: null,
            encryptedValueA,
            encryptedValueB,
            chance,
            rolloutFunction: null,
            rolloutMilestones: null,
          });
          createdCount += 1;
          storageDeltaBytes += nextBytes;
          continue;
        }

        const previousBytes = encryptedPayloadByteLength({
          encryptedValue: existing.encryptedValue,
          encryptedValueA: existing.encryptedValueA,
          encryptedValueB: existing.encryptedValueB,
        });
        updates.push({
          id: existing._id,
          visibility: entry.visibility,
          kind: "ab_roll",
          declaredType,
          encryptedValue: null,
          encryptedValueA,
          encryptedValueB,
          chance,
          rolloutFunction: null,
          rolloutMilestones: null,
        });
        updatedCount += 1;
        storageDeltaBytes += nextBytes - previousBytes;
        continue;
      }

      const rolloutMilestones = validateRolloutMilestones(entry.rolloutMilestones);

      if (existing === null) {
        creates.push({
          name,
          visibility: entry.visibility,
          kind: "rollout",
          declaredType,
          encryptedValue: null,
          encryptedValueA,
          encryptedValueB,
          chance: null,
          rolloutFunction: entry.rolloutFunction,
          rolloutMilestones,
        });
        createdCount += 1;
        storageDeltaBytes += nextBytes;
        continue;
      }

      const previousBytes = encryptedPayloadByteLength({
        encryptedValue: existing.encryptedValue,
        encryptedValueA: existing.encryptedValueA,
        encryptedValueB: existing.encryptedValueB,
      });
      updates.push({
        id: existing._id,
        visibility: entry.visibility,
        kind: "rollout",
        declaredType,
        encryptedValue: null,
        encryptedValueA,
        encryptedValueB,
        chance: null,
        rolloutFunction: entry.rolloutFunction,
        rolloutMilestones,
      });
      updatedCount += 1;
      storageDeltaBytes += nextBytes - previousBytes;
    }

    for (const name of normalizedDeletes) {
      const existing = rowsByName.get(name) ?? null;
      if (existing === null) {
        continue;
      }

      storageDeltaBytes -= encryptedPayloadByteLength({
        encryptedValue: existing.encryptedValue,
        encryptedValueA: existing.encryptedValueA,
        encryptedValueB: existing.encryptedValueB,
      });
      deletes.push(existing._id);
      deletedCount += 1;
    }

    return {
      createdCount,
      updatedCount,
      deletedCount,
      storageDeltaBytes,
      creates,
      updates,
      deletes,
    };
  },
});
