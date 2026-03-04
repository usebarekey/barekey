import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
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

const variableSummaryValidator = v.object({
  id: v.id("projectVariables"),
  projectId: v.id("projects"),
  orgId: v.string(),
  stageSlug: v.string(),
  name: v.string(),
  kind: v.literal("secret"),
  createdAtMs: v.number(),
  updatedAtMs: v.number(),
});

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

type DraftWriteResult = {
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
  returns: v.array(variableSummaryValidator),
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
      .map((row) => ({
        id: row._id,
        projectId: row.projectId,
        orgId: row.orgId,
        stageSlug: row.stageSlug,
        name: row.name,
        kind: row.kind,
        createdAtMs: row.createdAtMs,
        updatedAtMs: row.updatedAtMs,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  },
});

const variableResolverRowValidator = v.object({
  id: v.id("projectVariables"),
  projectId: v.id("projects"),
  orgId: v.string(),
  stageSlug: v.string(),
  name: v.string(),
  kind: v.literal("secret"),
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
        kind: "secret";
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
      kind: "secret";
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
    createdCount: v.number(),
    updatedCount: v.number(),
    deletedCount: v.number(),
  }),
  handler: async (ctx, args): Promise<DraftWriteResult> => {
    const prepared: PreparedDraft = await ctx.runMutation(
      internal.project_variables.prepareDraftForCurrentOrgProjectStageInternal,
      args,
    );

    let reservedStorageUnits = 0;
    if (prepared.storageDeltaBytes > 0) {
      const reservation = await ctx.runAction(
        internal.payments.reserveFeatureUnitsForCurrentOrgInternal,
        {
          expectedOrgSlug: args.expectedOrgSlug,
          featureId: "storage_bytes",
          units: prepared.storageDeltaBytes,
          reason: "project_variables_apply_draft",
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

    let writeResult: DraftWriteResult;
    try {
      writeResult = await ctx.runMutation(
        internal.project_variables.applyPreparedDraftForCurrentOrgProjectStageInternal,
        {
          expectedOrgSlug: args.expectedOrgSlug,
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
          await ctx.runAction(
            internal.payments.compensateFeatureUnitsForCurrentOrgInternal,
            {
              expectedOrgSlug: args.expectedOrgSlug,
              featureId: "storage_bytes",
              units: reservedStorageUnits,
              reason: "project_variables_apply_draft_rollback",
            },
          );
        } catch (rollbackError: unknown) {
          console.error("Storage usage rollback failed.", rollbackError);
        }
      }
      throw error;
    }

    if (prepared.storageDeltaBytes !== 0) {
      await ctx.runMutation(internal.payments.applyStorageDeltaForOrgInternal, {
        orgId: prepared.orgId,
        deltaBytes: prepared.storageDeltaBytes,
      });
    }

    if (prepared.storageDeltaBytes < 0) {
      await ctx.runAction(
        internal.payments.compensateFeatureUnitsForCurrentOrgInternal,
        {
          expectedOrgSlug: args.expectedOrgSlug,
          featureId: "storage_bytes",
          units: Math.abs(prepared.storageDeltaBytes),
          reason: "project_variables_apply_draft_negative_delta",
        },
      );
    }

    return writeResult;
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
      storageDeltaBytes -= utf8ByteLength(existing.encryptedValue);
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

      storageDeltaBytes += utf8ByteLength(encryptedValue) - utf8ByteLength(existing.encryptedValue);
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
  returns: v.object({
    id: v.id("projectVariables"),
    name: v.string(),
    kind: v.literal("secret"),
    value: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    id: Id<"projectVariables">;
    name: string;
    kind: "secret";
    value: string;
  }> => {
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

    const value = await decryptSecretValueForProject(ctx, {
      projectId: project._id,
      orgId: project.orgId,
      encryptedValue: variable.encryptedValue,
    });

    return {
      id: variable._id,
      name: variable.name,
      kind: variable.kind,
      value,
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
  returns: v.object({
    id: v.id("projectVariables"),
    name: v.string(),
    kind: v.literal("secret"),
    value: v.string(),
  }),
  handler: async (ctx, args) => {
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

    const value = await decryptSecretValueForProject(ctx, {
      projectId: project._id,
      orgId: project.orgId,
      encryptedValue: variable.encryptedValue,
    });

    return {
      id: variable._id,
      name: variable.name,
      kind: variable.kind,
      value,
    };
  },
});
