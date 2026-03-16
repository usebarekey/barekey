import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./confect";
import {
  assertExpectedOrgSlug,
  getActiveOrgIdClaimsOrNull,
  requireActiveOrgIdClaims,
  requireIdentity,
} from "./lib/auth";
import { decryptSecretValueForProject, encryptSecretValueForProject } from "./lib/encryption";
import {
  declaredTypeValidator,
  type DeclaredVariableType,
  validateAndNormalizeDeclaredAbRoll,
  validateAndNormalizeDeclaredValue,
} from "./lib/declared_types";
import {
  rolloutFunctionValidator,
  rolloutMilestoneValidator,
  type RolloutFunction,
  type RolloutMilestone,
  validateRolloutMilestones,
} from "./lib/rollout";
import {
  projectVariablePreparedCreateValidator as preparedWriteCreateValidator,
  projectVariablePreparedUpdateValidator as preparedWriteUpdateValidator,
} from "./lib/project_variable_schedules";
import { getVariableVisibility, type VariableVisibility } from "./lib/visibility";
import {
  draftUpdateValidator,
  encryptedPayloadByteLength,
  getRowDeclaredType,
  mapVariableMetadataRow,
  mapVariableResolverRow,
  preparedDraftCreateValidator,
  preparedDraftUpdateValidator,
  validateChance,
  validateVariableName,
  variableMetadataValidator,
  variableResolverRowValidator,
  writeEntryValidator,
  writeModeValidator,
} from "./lib/project_variables_shared";
import {
  findProjectStageByOrgIdAndSlug,
  findProjectStageByOrgSlugAndSlug,
  listProjectVariableRowsForStage,
  requireProjectStageByOrgIdAndSlug,
} from "./lib/project_scope";

type DraftWriteResult = {
  createdCount: number;
  updatedCount: number;
  deletedCount: number;
};

type PreparedWriteMutationResult = {
  createdCount: number;
  updatedCount: number;
  deletedCount: number;
  storageDeltaBytes: number;
  creates: Array<
    | {
        name: string;
        visibility: VariableVisibility;
        kind: "secret";
        declaredType: DeclaredVariableType;
        encryptedValue: string;
        encryptedValueA: null;
        encryptedValueB: null;
        chance: null;
        rolloutFunction: null;
        rolloutMilestones: null;
      }
    | {
        name: string;
        visibility: VariableVisibility;
        kind: "ab_roll";
        declaredType: DeclaredVariableType;
        encryptedValue: null;
        encryptedValueA: string;
        encryptedValueB: string;
        chance: number;
        rolloutFunction: null;
        rolloutMilestones: null;
      }
    | {
        name: string;
        visibility: VariableVisibility;
        kind: "rollout";
        declaredType: DeclaredVariableType;
        encryptedValue: null;
        encryptedValueA: string;
        encryptedValueB: string;
        chance: null;
        rolloutFunction: RolloutFunction;
        rolloutMilestones: Array<RolloutMilestone>;
      }
  >;
  updates: Array<
    | {
        id: Id<"projectVariables">;
        visibility: VariableVisibility;
        kind: "secret";
        declaredType: DeclaredVariableType;
        encryptedValue: string;
        encryptedValueA: null;
        encryptedValueB: null;
        chance: null;
        rolloutFunction: null;
        rolloutMilestones: null;
      }
    | {
        id: Id<"projectVariables">;
        visibility: VariableVisibility;
        kind: "ab_roll";
        declaredType: DeclaredVariableType;
        encryptedValue: null;
        encryptedValueA: string;
        encryptedValueB: string;
        chance: number;
        rolloutFunction: null;
        rolloutMilestones: null;
      }
    | {
        id: Id<"projectVariables">;
        visibility: VariableVisibility;
        kind: "rollout";
        declaredType: DeclaredVariableType;
        encryptedValue: null;
        encryptedValueA: string;
        encryptedValueB: string;
        chance: null;
        rolloutFunction: RolloutFunction;
        rolloutMilestones: Array<RolloutMilestone>;
      }
  >;
  deletes: Array<Id<"projectVariables">>;
};

type WriteWithUsageResult = {
  createdCount: number;
  updatedCount: number;
  deletedCount: number;
};

type PreparedDraft = {
  orgId: string;
  storageDeltaBytes: number;
  creates: Array<{
    name: string;
    visibility: VariableVisibility;
    kind: "secret";
    declaredType: DeclaredVariableType;
    encryptedValue: string;
  }>;
  updates: Array<{
    id: Id<"projectVariables">;
    visibility: VariableVisibility;
    kind: "secret";
    declaredType: DeclaredVariableType;
    encryptedValue: string;
  }>;
  deletes: Array<Id<"projectVariables">>;
  createdCount: number;
  updatedCount: number;
  deletedCount: number;
};

/**
 * Lists variables for a single project stage.
 *
 * Values remain encrypted at rest and are never returned in plaintext from
 * this listing API; decryption is handled by an explicit per-row action.
 */
export const listForCurrentOrgProjectStage = query({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
  },
  returns: v.array(variableMetadataValidator),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return [];
    }

    const activeOrg = getActiveOrgIdClaimsOrNull(identity);
    if (activeOrg === null) {
      return [];
    }

    if (activeOrg.orgSlug !== null && activeOrg.orgSlug !== args.expectedOrgSlug) {
      return [];
    }

    const projectStage = await findProjectStageByOrgIdAndSlug(ctx.db, {
      orgId: activeOrg.orgId,
      projectSlug: args.projectSlug,
      stageSlug: args.stageSlug,
    });
    if (projectStage === null) {
      return [];
    }

    const rows = await listProjectVariableRowsForStage(ctx.db, {
      projectId: projectStage.project._id,
      stageSlug: projectStage.stage.slug,
    });

    return rows
      .map(mapVariableMetadataRow)
      .sort((left, right) => left.name.localeCompare(right.name));
  },
});

/**
 * Resolves stage variables by name for internal HTTP/SDK evaluation flows.
 */
export const resolveVariableRowsForOrgProjectStageInternal = internalQuery({
  args: {
    orgId: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
    names: v.array(v.string()),
  },
  returns: v.array(variableResolverRowValidator),
  handler: async (ctx, args) => {
    const projectStage = await findProjectStageByOrgIdAndSlug(ctx.db, {
      orgId: args.orgId,
      projectSlug: args.projectSlug,
      stageSlug: args.stageSlug,
    });
    if (projectStage === null) {
      return [];
    }

    const normalizedNames = args.names.map((name) => validateVariableName(name));
    const rowsByName = new Map<
      string,
      {
        id: Id<"projectVariables">;
        projectId: Id<"projects">;
        orgId: string;
        stageSlug: string;
        name: string;
        visibility: VariableVisibility;
        kind: "secret" | "ab_roll" | "rollout";
        declaredType: DeclaredVariableType;
      }
    >();
    for (const name of normalizedNames) {
      if (rowsByName.has(name)) {
        continue;
      }
      const row = await ctx.db
        .query("projectVariables")
        .withIndex("by_project_id_and_stage_slug_and_name", (q) =>
          q
            .eq("projectId", projectStage.project._id)
            .eq("stageSlug", projectStage.stage.slug)
            .eq("name", name),
        )
        .unique();
      if (row !== null) {
        rowsByName.set(name, mapVariableResolverRow(row));
      }
    }

    const ordered: Array<{
      id: Id<"projectVariables">;
      projectId: Id<"projects">;
      orgId: string;
      stageSlug: string;
      name: string;
      visibility: VariableVisibility;
      kind: "secret" | "ab_roll" | "rollout";
      declaredType: DeclaredVariableType;
    }> = [];
    for (const name of normalizedNames) {
      const resolved = rowsByName.get(name);
      if (resolved !== undefined) {
        ordered.push(resolved);
      }
    }
    return ordered;
  },
});

export const resolvePublicVariableRowsForOrgProjectStageInternal = internalQuery({
  args: {
    orgSlug: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
    names: v.optional(v.array(v.string())),
  },
  returns: v.union(
    v.object({
      orgId: v.string(),
      rows: v.array(variableResolverRowValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const projectStage = await findProjectStageByOrgSlugAndSlug(ctx.db, {
      orgSlug: args.orgSlug,
      projectSlug: args.projectSlug,
      stageSlug: args.stageSlug,
    });
    if (projectStage === null) {
      return null;
    }

    const normalizedNames = args.names?.map((name) => validateVariableName(name));
    const rows =
      normalizedNames === undefined
        ? await ctx.db
            .query("projectVariables")
            .withIndex("by_project_id_and_stage_slug_and_visibility", (q) =>
              q
                .eq("projectId", projectStage.project._id)
                .eq("stageSlug", projectStage.stage.slug)
                .eq("visibility", "public"),
            )
            .collect()
        : await Promise.all(
            normalizedNames.map(async (name) => {
              return await ctx.db
                .query("projectVariables")
                .withIndex("by_project_id_and_stage_slug_and_visibility_and_name", (q) =>
                  q
                    .eq("projectId", projectStage.project._id)
                    .eq("stageSlug", projectStage.stage.slug)
                    .eq("visibility", "public")
                    .eq("name", name),
                )
                .unique();
            }),
          );

    const resolvedRows = rows
      .filter((row): row is NonNullable<(typeof rows)[number]> => row !== null)
      .map(mapVariableResolverRow);

    return {
      orgId: projectStage.project.orgId,
      rows:
        normalizedNames === undefined
          ? resolvedRows.sort((left, right) => left.name.localeCompare(right.name))
          : normalizedNames
              .map((name) => resolvedRows.find((row) => row.name === name) ?? null)
              .filter((row): row is (typeof resolvedRows)[number] => row !== null),
    };
  },
});

/**
 * Lists raw variable metadata for HTTP/CLI flows in a fixed stage order.
 */
export const listVariableMetadataForOrgProjectStageInternal = internalQuery({
  args: {
    orgId: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
  },
  returns: v.array(variableMetadataValidator),
  handler: async (ctx, args) => {
    const projectStage = await findProjectStageByOrgIdAndSlug(ctx.db, {
      orgId: args.orgId,
      projectSlug: args.projectSlug,
      stageSlug: args.stageSlug,
    });
    if (projectStage === null) {
      return [];
    }

    const rows = await listProjectVariableRowsForStage(ctx.db, {
      projectId: projectStage.project._id,
      stageSlug: projectStage.stage.slug,
    });

    return rows
      .map(mapVariableMetadataRow)
      .sort((left, right) => left.name.localeCompare(right.name));
  },
});

/**
 * Encrypts pending create/update payloads for HTTP and CLI writes before metering.
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
    const rowsByName = new Map(rows.map((row) => [row.name, row]));

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
    const creates: PreparedWriteMutationResult["creates"] = [];
    const updates: PreparedWriteMutationResult["updates"] = [];
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

function summarizePreparedWriteApplication(input: {
  existingRows: Array<{
    _id: Id<"projectVariables">;
    name: string;
    encryptedValue: string | null;
    encryptedValueA: string | null;
    encryptedValueB: string | null;
  }>;
  creates: PreparedWriteMutationResult["creates"];
  updates: PreparedWriteMutationResult["updates"];
  deletes: Array<Id<"projectVariables">>;
}): {
  storageDeltaBytes: number;
} {
  const byId = new Map(input.existingRows.map((row) => [row._id, row] as const));
  const stageVariableNames = new Set(input.existingRows.map((row) => row.name));
  const deletedIds = new Set(input.deletes);
  let storageDeltaBytes = 0;

  for (const variableId of deletedIds) {
    const existing = byId.get(variableId);
    if (existing === undefined) {
      throw new Error("Variable delete target does not exist.");
    }
    stageVariableNames.delete(existing.name);
    storageDeltaBytes -= encryptedPayloadByteLength({
      encryptedValue: existing.encryptedValue,
      encryptedValueA: existing.encryptedValueA,
      encryptedValueB: existing.encryptedValueB,
    });
  }

  for (const update of input.updates) {
    const existing = byId.get(update.id);
    if (existing === undefined) {
      throw new Error("Variable update target does not exist.");
    }
    if (deletedIds.has(update.id)) {
      throw new Error("Cannot update a variable that is marked for deletion.");
    }

    const previousBytes = encryptedPayloadByteLength({
      encryptedValue: existing.encryptedValue,
      encryptedValueA: existing.encryptedValueA,
      encryptedValueB: existing.encryptedValueB,
    });
    const nextBytes = encryptedPayloadByteLength({
      encryptedValue: update.encryptedValue,
      encryptedValueA: update.encryptedValueA,
      encryptedValueB: update.encryptedValueB,
    });
    storageDeltaBytes += nextBytes - previousBytes;
  }

  for (const create of input.creates) {
    if (stageVariableNames.has(create.name)) {
      throw new Error(`Variable ${create.name} already exists in this stage.`);
    }

    const nextBytes = encryptedPayloadByteLength({
      encryptedValue: create.encryptedValue,
      encryptedValueA: create.encryptedValueA,
      encryptedValueB: create.encryptedValueB,
    });
    storageDeltaBytes += nextBytes;
    stageVariableNames.add(create.name);
  }

  return {
    storageDeltaBytes,
  };
}

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
 * Commits a previously prepared HTTP/CLI variable write transaction.
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
    const byId = new Map(existingRows.map((row) => [row._id, row]));
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

/**
 * Applies metered storage checks and then commits a prepared variable write.
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

/**
 * Applies staged variable edits atomically for one project stage.
 *
 * The action reserves billable storage before writes and runs a compensating
 * adjustment if a write fails after reservation.
 */
export const applyDraftForCurrentOrgProjectStage = action({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
    creates: v.array(writeEntryValidator),
    updates: v.array(draftUpdateValidator),
    deletes: v.array(v.id("projectVariables")),
  },
  returns: v.object({
    createdCount: v.number(),
    updatedCount: v.number(),
    deletedCount: v.number(),
  }),
  handler: async (ctx, args): Promise<DraftWriteResult> => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    const existingRows: Array<
      | {
          id: Id<"projectVariables">;
          name: string;
          visibility: VariableVisibility;
          kind: "secret";
          declaredType: DeclaredVariableType;
          chance: null;
          rolloutFunction: null;
          rolloutMilestones: null;
        }
      | {
          id: Id<"projectVariables">;
          name: string;
          visibility: VariableVisibility;
          kind: "ab_roll";
          declaredType: DeclaredVariableType;
          chance: number;
          rolloutFunction: null;
          rolloutMilestones: null;
        }
      | {
          id: Id<"projectVariables">;
          name: string;
          visibility: VariableVisibility;
          kind: "rollout";
          declaredType: DeclaredVariableType;
          chance: null;
          rolloutFunction: RolloutFunction;
          rolloutMilestones: Array<RolloutMilestone>;
        }
    > = await ctx.runQuery(
      internal.project_variables.listVariableMetadataForOrgProjectStageInternal,
      {
        orgId: activeOrg.orgId,
        projectSlug: args.projectSlug,
        stageSlug: args.stageSlug,
      },
    );
    const existingById = new Map(existingRows.map((row) => [row.id, row] as const));

    const entries = [...args.creates];
    for (const update of args.updates) {
      const existing = existingById.get(update.id);
      if (existing === undefined) {
        throw new Error("Variable update target does not exist.");
      }

      if (update.kind === "secret") {
        entries.push({
          name: existing.name,
          visibility: update.visibility,
          kind: "secret",
          declaredType: update.declaredType,
          value: update.value,
        });
        continue;
      }

      if (update.kind === "ab_roll") {
        entries.push({
          name: existing.name,
          visibility: update.visibility,
          kind: "ab_roll",
          declaredType: update.declaredType,
          valueA: update.valueA,
          valueB: update.valueB,
          chance: validateChance(update.chance),
        });
        continue;
      }

      entries.push({
        name: existing.name,
        visibility: update.visibility,
        kind: "rollout",
        declaredType: update.declaredType,
        valueA: update.valueA,
        valueB: update.valueB,
        rolloutFunction: update.rolloutFunction,
        rolloutMilestones: validateRolloutMilestones(update.rolloutMilestones),
      });
    }

    const deletes = args.deletes.map((variableId) => {
      const existing = existingById.get(variableId);
      if (existing === undefined) {
        throw new Error("Variable delete target does not exist.");
      }
      return existing.name;
    });

    const result = await ctx.runAction(
      internal.project_variables.writeVariablesForOrgProjectStageWithUsageInternal,
      {
        orgId: activeOrg.orgId,
        orgSlug: activeOrg.orgSlug,
        clerkUserId: activeOrg.clerkUserId,
        projectSlug: args.projectSlug,
        stageSlug: args.stageSlug,
        mode: "upsert",
        entries,
        deletes,
      },
    );

    const touchedEntries = [
      ...args.creates.map((entry) => ({
        operation: "create",
        name: entry.name,
        kind: entry.kind,
        visibility: entry.visibility,
        declaredType: entry.declaredType,
      })),
      ...args.updates.map((entry) => {
        const existing = existingById.get(entry.id);
        return {
          operation: "update",
          name: existing?.name ?? "unknown",
          kind: entry.kind,
          visibility: entry.visibility,
          declaredType: entry.declaredType,
        };
      }),
      ...args.deletes.map((variableId) => {
        const existing = existingById.get(variableId);
        return {
          operation: "delete",
          name: existing?.name ?? "unknown",
          kind: existing?.kind ?? "secret",
          visibility: existing?.visibility ?? "private",
          declaredType: existing?.declaredType ?? "string",
        };
      }),
    ];

    await ctx.runMutation(internal.audit.appendEventInternal, {
      orgId: activeOrg.orgId,
      orgSlug: activeOrg.orgSlug ?? args.expectedOrgSlug,
      projectId: null,
      projectSlug: args.projectSlug,
      stageSlug: args.stageSlug,
      eventType: "variable.draft_applied",
      category: "variable",
      actorSource: "barekey_user",
      actorClerkUserId: activeOrg.clerkUserId,
      actorDisplayName: null,
      actorEmail: null,
      subjectType: "stage",
      subjectId: args.stageSlug,
      subjectName: args.stageSlug,
      title: `Applied ${touchedEntries.length} variable change${touchedEntries.length === 1 ? "" : "s"}`,
      description: `Updated ${args.projectSlug}/${args.stageSlug} with ${result.createdCount} create${result.createdCount === 1 ? "" : "s"}, ${result.updatedCount} update${result.updatedCount === 1 ? "" : "s"}, and ${result.deletedCount} delete${result.deletedCount === 1 ? "" : "s"}.`,
      severity: touchedEntries.some((entry) => entry.visibility === "private")
        ? "sensitive"
        : "info",
      payloadJson: JSON.stringify({
        projectSlug: args.projectSlug,
        stageSlug: args.stageSlug,
        counts: result,
        variables: touchedEntries,
      }),
      retentionTierOverride: null,
    });

    return result;
  },
});

/**
 * Encrypts pending create/update payloads and computes exact encrypted-byte
 * delta before the write transaction runs.
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
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    const { project, stage } = await requireProjectStageByOrgIdAndSlug(ctx.db, {
      orgId: activeOrg.orgId,
      projectSlug: args.projectSlug,
      stageSlug: args.stageSlug,
    });

    const existingRows = await listProjectVariableRowsForStage(ctx.db, {
      projectId: project._id,
      stageSlug: stage.slug,
    });
    const byId = new Map(existingRows.map((row) => [row._id, row]));
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

    const preparedUpdates: Array<{
      id: (typeof args.updates)[number]["id"];
      visibility: VariableVisibility;
      kind: "secret";
      declaredType: DeclaredVariableType;
      encryptedValue: string;
    }> = [];
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

    const preparedCreates: Array<{
      name: string;
      visibility: VariableVisibility;
      kind: "secret";
      declaredType: DeclaredVariableType;
      encryptedValue: string;
    }> = [];
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
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    const { project, stage } = await requireProjectStageByOrgIdAndSlug(ctx.db, {
      orgId: activeOrg.orgId,
      projectSlug: args.projectSlug,
      stageSlug: args.stageSlug,
    });

    const existingRows = await listProjectVariableRowsForStage(ctx.db, {
      projectId: project._id,
      stageSlug: stage.slug,
    });
    const byId = new Map(existingRows.map((row) => [row._id, row]));
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

/**
 * Decrypts one variable value in an org-scoped project stage.
 */
export const decryptValueForOrgProjectStageInternal = internalMutation({
  args: {
    orgId: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
    variableId: v.id("projectVariables"),
  },
  returns: v.union(
    v.object({
      id: v.id("projectVariables"),
      name: v.string(),
      kind: v.literal("secret"),
      declaredType: declaredTypeValidator,
      value: v.string(),
    }),
    v.object({
      id: v.id("projectVariables"),
      name: v.string(),
      kind: v.literal("ab_roll"),
      declaredType: declaredTypeValidator,
      valueA: v.string(),
      valueB: v.string(),
      chance: v.number(),
    }),
    v.object({
      id: v.id("projectVariables"),
      name: v.string(),
      kind: v.literal("rollout"),
      declaredType: declaredTypeValidator,
      valueA: v.string(),
      valueB: v.string(),
      rolloutFunction: rolloutFunctionValidator,
      rolloutMilestones: v.array(rolloutMilestoneValidator),
    }),
  ),
  handler: async (
    ctx,
    args,
  ): Promise<
    | {
        id: Id<"projectVariables">;
        name: string;
        kind: "secret";
        declaredType: DeclaredVariableType;
        value: string;
      }
    | {
        id: Id<"projectVariables">;
        name: string;
        kind: "ab_roll";
        declaredType: DeclaredVariableType;
        valueA: string;
        valueB: string;
        chance: number;
      }
    | {
        id: Id<"projectVariables">;
        name: string;
        kind: "rollout";
        declaredType: DeclaredVariableType;
        valueA: string;
        valueB: string;
        rolloutFunction: RolloutFunction;
        rolloutMilestones: Array<RolloutMilestone>;
      }
  > => {
    const { project, stage } = await requireProjectStageByOrgIdAndSlug(ctx.db, {
      orgId: args.orgId,
      projectSlug: args.projectSlug,
      stageSlug: args.stageSlug,
    });

    const variable = await ctx.db.get(args.variableId);
    if (
      variable === null ||
      variable.projectId !== project._id ||
      variable.orgId !== project.orgId ||
      variable.stageSlug !== stage.slug
    ) {
      throw new Error("Variable not found in this stage.");
    }

    if (variable.kind === "secret") {
      if (variable.encryptedValue === null) {
        throw new Error("Secret variable ciphertext is missing.");
      }
      const value = await decryptSecretValueForProject(ctx, {
        projectId: project._id,
        orgId: project.orgId,
        encryptedValue: variable.encryptedValue,
      });

      return {
        id: variable._id,
        name: variable.name,
        kind: "secret",
        declaredType: getRowDeclaredType(variable),
        value,
      };
    }

    if (variable.encryptedValueA === null || variable.encryptedValueB === null) {
      throw new Error(`${variable.kind} ciphertext is missing.`);
    }

    const valueA = await decryptSecretValueForProject(ctx, {
      projectId: project._id,
      orgId: project.orgId,
      encryptedValue: variable.encryptedValueA,
    });
    const valueB = await decryptSecretValueForProject(ctx, {
      projectId: project._id,
      orgId: project.orgId,
      encryptedValue: variable.encryptedValueB,
    });

    if (variable.kind === "ab_roll") {
      return {
        id: variable._id,
        name: variable.name,
        kind: "ab_roll",
        declaredType: getRowDeclaredType(variable),
        valueA,
        valueB,
        chance: validateChance(variable.chance ?? 0),
      };
    }

    return {
      id: variable._id,
      name: variable.name,
      kind: "rollout",
      declaredType: getRowDeclaredType(variable),
      valueA,
      valueB,
      rolloutFunction: variable.rolloutFunction ?? "linear",
      rolloutMilestones: validateRolloutMilestones(variable.rolloutMilestones ?? []),
    };
  },
});

/**
 * Decrypts one stage variable value for immediate UI reveal.
 *
 * Callers should treat the returned plaintext as ephemeral and avoid caching
 * beyond the current user interaction.
 */
export const decryptValueForCurrentOrgProjectStage = mutation({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
    variableId: v.id("projectVariables"),
  },
  returns: v.union(
    v.object({
      id: v.id("projectVariables"),
      name: v.string(),
      kind: v.literal("secret"),
      declaredType: declaredTypeValidator,
      value: v.string(),
    }),
    v.object({
      id: v.id("projectVariables"),
      name: v.string(),
      kind: v.literal("ab_roll"),
      declaredType: declaredTypeValidator,
      valueA: v.string(),
      valueB: v.string(),
      chance: v.number(),
    }),
    v.object({
      id: v.id("projectVariables"),
      name: v.string(),
      kind: v.literal("rollout"),
      declaredType: declaredTypeValidator,
      valueA: v.string(),
      valueB: v.string(),
      rolloutFunction: rolloutFunctionValidator,
      rolloutMilestones: v.array(rolloutMilestoneValidator),
    }),
  ),
  handler: async (
    ctx,
    args,
  ): Promise<
    | {
        id: Id<"projectVariables">;
        name: string;
        kind: "secret";
        declaredType: DeclaredVariableType;
        value: string;
      }
    | {
        id: Id<"projectVariables">;
        name: string;
        kind: "ab_roll";
        declaredType: DeclaredVariableType;
        valueA: string;
        valueB: string;
        chance: number;
      }
    | {
        id: Id<"projectVariables">;
        name: string;
        kind: "rollout";
        declaredType: DeclaredVariableType;
        valueA: string;
        valueB: string;
        rolloutFunction: RolloutFunction;
        rolloutMilestones: Array<RolloutMilestone>;
      }
  > => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    const { project, stage } = await requireProjectStageByOrgIdAndSlug(ctx.db, {
      orgId: activeOrg.orgId,
      projectSlug: args.projectSlug,
      stageSlug: args.stageSlug,
    });

    const variable = await ctx.db.get(args.variableId);
    if (
      variable === null ||
      variable.projectId !== project._id ||
      variable.orgId !== project.orgId ||
      variable.stageSlug !== stage.slug
    ) {
      throw new Error("Variable not found in this stage.");
    }

    if (variable.kind === "secret") {
      if (variable.encryptedValue === null) {
        throw new Error("Secret variable ciphertext is missing.");
      }

      const value = await decryptSecretValueForProject(ctx, {
        projectId: project._id,
        orgId: project.orgId,
        encryptedValue: variable.encryptedValue,
      });

      return {
        id: variable._id,
        name: variable.name,
        kind: "secret",
        declaredType: getRowDeclaredType(variable),
        value,
      };
    }

    if (variable.encryptedValueA === null || variable.encryptedValueB === null) {
      throw new Error(`${variable.kind} ciphertext is missing.`);
    }

    const valueA = await decryptSecretValueForProject(ctx, {
      projectId: project._id,
      orgId: project.orgId,
      encryptedValue: variable.encryptedValueA,
    });
    const valueB = await decryptSecretValueForProject(ctx, {
      projectId: project._id,
      orgId: project.orgId,
      encryptedValue: variable.encryptedValueB,
    });

    if (variable.kind === "ab_roll") {
      return {
        id: variable._id,
        name: variable.name,
        kind: "ab_roll",
        declaredType: getRowDeclaredType(variable),
        valueA,
        valueB,
        chance: validateChance(variable.chance ?? 0),
      };
    }

    return {
      id: variable._id,
      name: variable.name,
      kind: "rollout",
      declaredType: getRowDeclaredType(variable),
      valueA,
      valueB,
      rolloutFunction: variable.rolloutFunction ?? "linear",
      rolloutMilestones: validateRolloutMilestones(variable.rolloutMilestones ?? []),
    };
  },
});
