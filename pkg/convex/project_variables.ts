import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
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

/**
 * Applies staged variable edits atomically for one project stage.
 *
 * The mutation supports bulk create/update/delete in one commit so paste/file
 * imports and table edits can be persisted together without partial writes.
 */
export const applyDraftForCurrentOrgProjectStage = mutation({
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

    let updatedCount = 0;
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
      await ctx.db.patch(update.id, {
        kind: update.kind,
        encryptedValue,
        updatedAtMs: Date.now(),
      });
      updatedCount += 1;
    }

    let createdCount = 0;
    for (const create of args.creates) {
      const name = validateVariableName(create.name);
      if (stageVariableNames.has(name)) {
        throw new Error(`Variable ${name} already exists in this stage.`);
      }

      const now = Date.now();
      const encryptedValue = await encryptSecretValueForProject(ctx, {
        projectId: project._id,
        orgId: project.orgId,
        plaintext: create.value,
      });
      await ctx.db.insert("projectVariables", {
        projectId: project._id,
        orgId: project.orgId,
        stageSlug: args.stageSlug,
        name,
        kind: create.kind,
        encryptedValue,
        createdByClerkUserId: activeOrg.clerkUserId,
        createdAtMs: now,
        updatedAtMs: now,
      });

      stageVariableNames.add(name);
      createdCount += 1;
    }

    for (const variableId of deletedIds) {
      await ctx.db.delete(variableId);
    }

    return {
      createdCount,
      updatedCount,
      deletedCount: deletedIds.size,
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
