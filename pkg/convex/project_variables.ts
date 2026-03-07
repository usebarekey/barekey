import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import {
  assertExpectedOrgSlug,
  getActiveOrgIdClaimsOrNull,
  requireActiveOrgIdClaims,
  requireIdentity,
} from "./lib/auth";
import {
  decryptSecretValueForProject,
  encryptSecretValueForProject,
} from "./lib/encryption";

function validateVariableName(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error("Variable name is required.");
  }

  if (trimmed.length > 160) {
    throw new Error("Variable name must be 160 characters or fewer.");
  }

  return trimmed;
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

const variableKindValidator = v.union(v.literal("secret"), v.literal("ab_roll"));

const secretVariableMetadataValidator = v.object({
  id: v.id("projectVariables"),
  projectId: v.id("projects"),
  orgId: v.string(),
  stageSlug: v.string(),
  name: v.string(),
  kind: v.literal("secret"),
  createdAtMs: v.number(),
  updatedAtMs: v.number(),
  chance: v.null(),
});

const abRollVariableMetadataValidator = v.object({
  id: v.id("projectVariables"),
  projectId: v.id("projects"),
  orgId: v.string(),
  stageSlug: v.string(),
  name: v.string(),
  kind: v.literal("ab_roll"),
  createdAtMs: v.number(),
  updatedAtMs: v.number(),
  chance: v.number(),
});

const variableMetadataValidator = v.union(
  secretVariableMetadataValidator,
  abRollVariableMetadataValidator,
);

const preparedCreateValidator = v.object({
  name: v.string(),
  kind: v.literal("secret"),
  encryptedValue: v.string(),
});

const preparedUpdateValidator = v.object({
  id: v.id("projectVariables"),
  kind: v.literal("secret"),
  encryptedValue: v.string(),
});

const preparedWriteCreateSecretValidator = v.object({
  name: v.string(),
  kind: v.literal("secret"),
  encryptedValue: v.string(),
  encryptedValueA: v.null(),
  encryptedValueB: v.null(),
  chance: v.null(),
});

const preparedWriteCreateAbRollValidator = v.object({
  name: v.string(),
  kind: v.literal("ab_roll"),
  encryptedValue: v.null(),
  encryptedValueA: v.string(),
  encryptedValueB: v.string(),
  chance: v.number(),
});

const preparedWriteCreateValidator = v.union(
  preparedWriteCreateSecretValidator,
  preparedWriteCreateAbRollValidator,
);

const preparedWriteUpdateSecretValidator = v.object({
  id: v.id("projectVariables"),
  kind: v.literal("secret"),
  encryptedValue: v.string(),
  encryptedValueA: v.null(),
  encryptedValueB: v.null(),
  chance: v.null(),
});

const preparedWriteUpdateAbRollValidator = v.object({
  id: v.id("projectVariables"),
  kind: v.literal("ab_roll"),
  encryptedValue: v.null(),
  encryptedValueA: v.string(),
  encryptedValueB: v.string(),
  chance: v.number(),
});

const preparedWriteUpdateValidator = v.union(
  preparedWriteUpdateSecretValidator,
  preparedWriteUpdateAbRollValidator,
);

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
        kind: "secret";
        encryptedValue: string;
        encryptedValueA: null;
        encryptedValueB: null;
        chance: null;
      }
    | {
        name: string;
        kind: "ab_roll";
        encryptedValue: null;
        encryptedValueA: string;
        encryptedValueB: string;
        chance: number;
      }
  >;
  updates: Array<
    | {
        id: Id<"projectVariables">;
        kind: "secret";
        encryptedValue: string;
        encryptedValueA: null;
        encryptedValueB: null;
        chance: null;
      }
    | {
        id: Id<"projectVariables">;
        kind: "ab_roll";
        encryptedValue: null;
        encryptedValueA: string;
        encryptedValueB: string;
        chance: number;
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
    kind: "secret";
    encryptedValue: string;
  }>;
  updates: Array<{
    id: Id<"projectVariables">;
    kind: "secret";
    encryptedValue: string;
  }>;
  deletes: Array<Id<"projectVariables">>;
  createdCount: number;
  updatedCount: number;
  deletedCount: number;
};

const writeModeValidator = v.union(v.literal("create_only"), v.literal("upsert"));

const writeSecretEntryValidator = v.object({
  name: v.string(),
  kind: v.literal("secret"),
  value: v.string(),
});

const writeAbRollEntryValidator = v.object({
  name: v.string(),
  kind: v.literal("ab_roll"),
  valueA: v.string(),
  valueB: v.string(),
  chance: v.number(),
});

const writeEntryValidator = v.union(writeSecretEntryValidator, writeAbRollEntryValidator);

const draftUpdateSecretValidator = v.object({
  id: v.id("projectVariables"),
  kind: v.literal("secret"),
  value: v.string(),
});

const draftUpdateAbRollValidator = v.object({
  id: v.id("projectVariables"),
  kind: v.literal("ab_roll"),
  valueA: v.string(),
  valueB: v.string(),
  chance: v.number(),
});

const draftUpdateValidator = v.union(draftUpdateSecretValidator, draftUpdateAbRollValidator);

function validateChance(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("ab_roll chance must be a finite number between 0 and 1.");
  }
  return value;
}

function encryptedPayloadByteLength(input: {
  encryptedValue: string | null;
  encryptedValueA: string | null;
  encryptedValueB: string | null;
}): number {
  let total = 0;
  if (input.encryptedValue !== null) {
    total += utf8ByteLength(input.encryptedValue);
  }
  if (input.encryptedValueA !== null) {
    total += utf8ByteLength(input.encryptedValueA);
  }
  if (input.encryptedValueB !== null) {
    total += utf8ByteLength(input.encryptedValueB);
  }
  return total;
}

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

    const project = await ctx.db
      .query("projects")
      .withIndex("by_org_id_and_slug", (q) =>
        q.eq("orgId", activeOrg.orgId).eq("slug", args.projectSlug),
      )
      .unique();
    if (project === null) {
      return [];
    }

    const stage = await ctx.db
      .query("projectStages")
      .withIndex("by_project_id_and_slug", (q) =>
        q.eq("projectId", project._id).eq("slug", args.stageSlug),
      )
      .unique();
    if (stage === null) {
      return [];
    }

    const rows = await ctx.db
      .query("projectVariables")
      .withIndex("by_project_id_and_stage_slug", (q) =>
        q.eq("projectId", project._id).eq("stageSlug", args.stageSlug),
      )
      .collect();

    return rows
      .map((row) =>
        row.kind === "secret"
          ? {
              id: row._id,
              projectId: row.projectId,
              orgId: row.orgId,
              stageSlug: row.stageSlug,
              name: row.name,
              kind: "secret" as const,
              createdAtMs: row.createdAtMs,
              updatedAtMs: row.updatedAtMs,
              chance: null,
            }
          : {
              id: row._id,
              projectId: row.projectId,
              orgId: row.orgId,
              stageSlug: row.stageSlug,
              name: row.name,
              kind: "ab_roll" as const,
              createdAtMs: row.createdAtMs,
              updatedAtMs: row.updatedAtMs,
              chance: validateChance(row.chance ?? 0),
            },
      )
      .sort((left, right) => left.name.localeCompare(right.name));
  },
});

const variableResolverRowValidator = v.object({
  id: v.id("projectVariables"),
  projectId: v.id("projects"),
  orgId: v.string(),
  stageSlug: v.string(),
  name: v.string(),
  kind: variableKindValidator,
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
    const project = await ctx.db
      .query("projects")
      .withIndex("by_org_id_and_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", args.projectSlug),
      )
      .unique();
    if (project === null) {
      return [];
    }

    const stage = await ctx.db
      .query("projectStages")
      .withIndex("by_project_id_and_slug", (q) =>
        q.eq("projectId", project._id).eq("slug", args.stageSlug),
      )
      .unique();
    if (stage === null) {
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
        kind: "secret" | "ab_roll";
      }
    >();
    for (const name of normalizedNames) {
      if (rowsByName.has(name)) {
        continue;
      }
      const row = await ctx.db
        .query("projectVariables")
        .withIndex("by_project_id_and_stage_slug_and_name", (q) =>
          q.eq("projectId", project._id).eq("stageSlug", args.stageSlug).eq("name", name),
        )
        .unique();
      if (row !== null) {
        rowsByName.set(name, {
          id: row._id,
          projectId: row.projectId,
          orgId: row.orgId,
          stageSlug: row.stageSlug,
          name: row.name,
          kind: row.kind,
        });
      }
    }

    const ordered: Array<{
      id: Id<"projectVariables">;
      projectId: Id<"projects">;
      orgId: string;
      stageSlug: string;
      name: string;
      kind: "secret" | "ab_roll";
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
    const project = await ctx.db
      .query("projects")
      .withIndex("by_org_id_and_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", args.projectSlug),
      )
      .unique();
    if (project === null) {
      return [];
    }

    const stage = await ctx.db
      .query("projectStages")
      .withIndex("by_project_id_and_slug", (q) =>
        q.eq("projectId", project._id).eq("slug", args.stageSlug),
      )
      .unique();
    if (stage === null) {
      return [];
    }

    const rows = await ctx.db
      .query("projectVariables")
      .withIndex("by_project_id_and_stage_slug", (q) =>
        q.eq("projectId", project._id).eq("stageSlug", stage.slug),
      )
      .collect();

    return rows
      .map((row) =>
        row.kind === "secret"
          ? {
              id: row._id,
              projectId: row.projectId,
              orgId: row.orgId,
              stageSlug: row.stageSlug,
              name: row.name,
              kind: "secret" as const,
              createdAtMs: row.createdAtMs,
              updatedAtMs: row.updatedAtMs,
              chance: null,
            }
          : {
              id: row._id,
              projectId: row.projectId,
              orgId: row.orgId,
              stageSlug: row.stageSlug,
              name: row.name,
              kind: "ab_roll" as const,
              createdAtMs: row.createdAtMs,
              updatedAtMs: row.updatedAtMs,
              chance: validateChance(row.chance ?? 0),
            },
      )
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
    const project = await ctx.db
      .query("projects")
      .withIndex("by_org_id_and_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", args.projectSlug),
      )
      .unique();
    if (project === null) {
      throw new Error("Project not found.");
    }

    const stage = await ctx.db
      .query("projectStages")
      .withIndex("by_project_id_and_slug", (q) =>
        q.eq("projectId", project._id).eq("slug", args.stageSlug),
      )
      .unique();
    if (stage === null) {
      throw new Error("Stage not found.");
    }

    const rows = await ctx.db
      .query("projectVariables")
      .withIndex("by_project_id_and_stage_slug", (q) =>
        q.eq("projectId", project._id).eq("stageSlug", stage.slug),
      )
      .collect();
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
        const encryptedValue = await encryptSecretValueForProject(ctx, {
          projectId: project._id,
          orgId: project.orgId,
          plaintext: entry.value,
        });
        const nextBytes = encryptedPayloadByteLength({
          encryptedValue,
          encryptedValueA: null,
          encryptedValueB: null,
        });

        if (existing === null) {
          creates.push({
            name,
            kind: "secret",
            encryptedValue,
            encryptedValueA: null,
            encryptedValueB: null,
            chance: null,
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
          kind: "secret",
          encryptedValue,
          encryptedValueA: null,
          encryptedValueB: null,
          chance: null,
        });
        updatedCount += 1;
        storageDeltaBytes += nextBytes - previousBytes;
        continue;
      }

      const chance = validateChance(entry.chance);
      const encryptedValueA = await encryptSecretValueForProject(ctx, {
        projectId: project._id,
        orgId: project.orgId,
        plaintext: entry.valueA,
      });
      const encryptedValueB = await encryptSecretValueForProject(ctx, {
        projectId: project._id,
        orgId: project.orgId,
        plaintext: entry.valueB,
      });
      const nextBytes = encryptedPayloadByteLength({
        encryptedValue: null,
        encryptedValueA,
        encryptedValueB,
      });

      if (existing === null) {
        creates.push({
          name,
          kind: "ab_roll",
          encryptedValue: null,
          encryptedValueA,
          encryptedValueB,
          chance,
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
        kind: "ab_roll",
        encryptedValue: null,
        encryptedValueA,
        encryptedValueB,
        chance,
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
    const project = await ctx.db
      .query("projects")
      .withIndex("by_org_id_and_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", args.projectSlug),
      )
      .unique();
    if (project === null) {
      throw new Error("Project not found.");
    }

    const stage = await ctx.db
      .query("projectStages")
      .withIndex("by_project_id_and_slug", (q) =>
        q.eq("projectId", project._id).eq("slug", args.stageSlug),
      )
      .unique();
    if (stage === null) {
      throw new Error("Stage not found.");
    }

    const existingRows = await ctx.db
      .query("projectVariables")
      .withIndex("by_project_id_and_stage_slug", (q) =>
        q.eq("projectId", project._id).eq("stageSlug", stage.slug),
      )
      .collect();
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
        kind: update.kind,
        encryptedValue: update.encryptedValue,
        encryptedValueA: update.encryptedValueA,
        encryptedValueB: update.encryptedValueB,
        chance: update.chance,
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
        kind: create.kind,
        encryptedValue: create.encryptedValue,
        encryptedValueA: create.encryptedValueA,
        encryptedValueB: create.encryptedValueB,
        chance: create.chance,
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

    let reservedStorageUnits = 0;
    if (prepared.storageDeltaBytes > 0) {
      const reservation = await ctx.runAction(
        internal.payments.reserveFeatureUnitsForOrgInternal,
        {
          orgId: args.orgId,
          orgSlug: args.orgSlug,
          featureId: "storage_bytes",
          units: prepared.storageDeltaBytes,
          reason: "project_variables_write",
        },
      );
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
          creates: prepared.creates,
          updates: prepared.updates,
          deletes: prepared.deletes,
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

    if (prepared.storageDeltaBytes !== 0) {
      await ctx.runMutation(internal.payments.applyStorageDeltaForOrgInternal, {
        orgId: args.orgId,
        deltaBytes: prepared.storageDeltaBytes,
      });
    }

    if (prepared.storageDeltaBytes < 0) {
      await ctx.runAction(internal.payments.compensateFeatureUnitsForOrgInternal, {
        orgId: args.orgId,
        orgSlug: args.orgSlug,
        featureId: "storage_bytes",
        units: Math.abs(prepared.storageDeltaBytes),
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
          kind: "secret";
          chance: null;
        }
      | {
          id: Id<"projectVariables">;
          name: string;
          kind: "ab_roll";
          chance: number;
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
          kind: "secret",
          value: update.value,
        });
        continue;
      }

      entries.push({
        name: existing.name,
        kind: "ab_roll",
        valueA: update.valueA,
        valueB: update.valueB,
        chance: validateChance(update.chance),
      });
    }

    const deletes = args.deletes.map((variableId) => {
      const existing = existingById.get(variableId);
      if (existing === undefined) {
        throw new Error("Variable delete target does not exist.");
      }
      return existing.name;
    });

    return await ctx.runAction(
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
    creates: v.array(preparedCreateValidator),
    updates: v.array(preparedUpdateValidator),
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

    const project = await ctx.db
      .query("projects")
      .withIndex("by_org_id_and_slug", (q) =>
        q.eq("orgId", activeOrg.orgId).eq("slug", args.projectSlug),
      )
      .unique();
    if (project === null) {
      throw new Error("Project not found.");
    }

    const stage = await ctx.db
      .query("projectStages")
      .withIndex("by_project_id_and_slug", (q) =>
        q.eq("projectId", project._id).eq("slug", args.stageSlug),
      )
      .unique();
    if (stage === null) {
      throw new Error("Stage not found.");
    }

    const existingRows = await ctx.db
      .query("projectVariables")
      .withIndex("by_project_id_and_stage_slug", (q) =>
        q.eq("projectId", project._id).eq("stageSlug", args.stageSlug),
      )
      .collect();
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
      kind: "secret";
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
        utf8ByteLength(encryptedValue) -
        encryptedPayloadByteLength({
          encryptedValue: existing.encryptedValue,
          encryptedValueA: existing.encryptedValueA,
          encryptedValueB: existing.encryptedValueB,
        });
      preparedUpdates.push({
        id: update.id,
        kind: update.kind,
        encryptedValue,
      });
    }

    const preparedCreates: Array<{
      name: string;
      kind: "secret";
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
      storageDeltaBytes += utf8ByteLength(encryptedValue);
      preparedCreates.push({
        name,
        kind: create.kind,
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
    creates: v.array(preparedCreateValidator),
    updates: v.array(preparedUpdateValidator),
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

    const project = await ctx.db
      .query("projects")
      .withIndex("by_org_id_and_slug", (q) =>
        q.eq("orgId", activeOrg.orgId).eq("slug", args.projectSlug),
      )
      .unique();
    if (project === null) {
      throw new Error("Project not found.");
    }

    const stage = await ctx.db
      .query("projectStages")
      .withIndex("by_project_id_and_slug", (q) =>
        q.eq("projectId", project._id).eq("slug", args.stageSlug),
      )
      .unique();
    if (stage === null) {
      throw new Error("Stage not found.");
    }

    const existingRows = await ctx.db
      .query("projectVariables")
      .withIndex("by_project_id_and_stage_slug", (q) =>
        q.eq("projectId", project._id).eq("stageSlug", args.stageSlug),
      )
      .collect();
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
        kind: update.kind,
        encryptedValue: update.encryptedValue,
        encryptedValueA: null,
        encryptedValueB: null,
        chance: null,
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
        stageSlug: args.stageSlug,
        name: create.name,
        kind: create.kind,
        encryptedValue: create.encryptedValue,
        encryptedValueA: null,
        encryptedValueB: null,
        chance: null,
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
      value: v.string(),
    }),
    v.object({
      id: v.id("projectVariables"),
      name: v.string(),
      kind: v.literal("ab_roll"),
      valueA: v.string(),
      valueB: v.string(),
      chance: v.number(),
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
        value: string;
      }
    | {
        id: Id<"projectVariables">;
        name: string;
        kind: "ab_roll";
        valueA: string;
        valueB: string;
        chance: number;
      }
  > => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_org_id_and_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", args.projectSlug),
      )
      .unique();
    if (project === null) {
      throw new Error("Project not found.");
    }

    const stage = await ctx.db
      .query("projectStages")
      .withIndex("by_project_id_and_slug", (q) =>
        q.eq("projectId", project._id).eq("slug", args.stageSlug),
      )
      .unique();
    if (stage === null) {
      throw new Error("Stage not found.");
    }

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
        value,
      };
    }

    if (variable.encryptedValueA === null || variable.encryptedValueB === null) {
      throw new Error("ab_roll ciphertext is missing.");
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

    return {
      id: variable._id,
      name: variable.name,
      kind: "ab_roll",
      valueA,
      valueB,
      chance: validateChance(variable.chance ?? 0),
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
      value: v.string(),
    }),
    v.object({
      id: v.id("projectVariables"),
      name: v.string(),
      kind: v.literal("ab_roll"),
      valueA: v.string(),
      valueB: v.string(),
      chance: v.number(),
    }),
  ),
  handler: async (
    ctx,
    args,
  ): Promise<{
    id: Id<"projectVariables">;
    name: string;
    kind: "secret";
    value: string;
  } | {
    id: Id<"projectVariables">;
    name: string;
    kind: "ab_roll";
    valueA: string;
    valueB: string;
    chance: number;
  }> => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    const project = await ctx.db
      .query("projects")
      .withIndex("by_org_id_and_slug", (q) =>
        q.eq("orgId", activeOrg.orgId).eq("slug", args.projectSlug),
      )
      .unique();
    if (project === null) {
      throw new Error("Project not found.");
    }

    const stage = await ctx.db
      .query("projectStages")
      .withIndex("by_project_id_and_slug", (q) =>
        q.eq("projectId", project._id).eq("slug", args.stageSlug),
      )
      .unique();
    if (stage === null) {
      throw new Error("Stage not found.");
    }

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
        value,
      };
    }

    if (variable.encryptedValueA === null || variable.encryptedValueB === null) {
      throw new Error("ab_roll ciphertext is missing.");
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

    return {
      id: variable._id,
      name: variable.name,
      kind: "ab_roll",
      valueA,
      valueB,
      chance: validateChance(variable.chance ?? 0),
    };
  },
});
