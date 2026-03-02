import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import {
  assertExpectedOrgSlug,
  getActiveOrgIdClaimsOrNull,
  requireActiveOrgIdClaims,
  requireIdentity,
} from "./lib/auth";

function normalizeStageSlugBase(value: string): string {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return normalized.length > 0 ? normalized : "stage";
}

function randomNumericSuffix(length: number): string {
  const upperBound = 10 ** length;
  const value = Math.floor(Math.random() * upperBound);
  return String(value).padStart(length, "0");
}

async function allocateUniqueStageSlug(
  ctx: MutationCtx,
  args: {
    projectId: Id<"projects">;
    slugBase: string;
  },
): Promise<string> {
  const baseCandidate = await ctx.db
    .query("projectStages")
    .withIndex("by_project_id_and_slug", (q) =>
      q.eq("projectId", args.projectId).eq("slug", args.slugBase),
    )
    .unique();
  if (baseCandidate === null) {
    return args.slugBase;
  }

  for (const suffixLength of [2, 4] as const) {
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const candidate = `${args.slugBase}-${randomNumericSuffix(suffixLength)}`;
      const existing = await ctx.db
        .query("projectStages")
        .withIndex("by_project_id_and_slug", (q) =>
          q.eq("projectId", args.projectId).eq("slug", candidate),
        )
        .unique();
      if (existing === null) {
        return candidate;
      }
    }
  }

  throw new Error("Unable to allocate a unique stage slug.");
}

const stageSummaryValidator = v.object({
  id: v.id("projectStages"),
  projectId: v.id("projects"),
  orgId: v.string(),
  slug: v.string(),
  name: v.string(),
  isDefault: v.boolean(),
  variableCount: v.number(),
  createdAtMs: v.number(),
  updatedAtMs: v.number(),
});

const DEFAULT_STAGE_DEFINITIONS = [
  {
    slug: "development",
    name: "Development",
  },
  {
    slug: "staging",
    name: "Staging",
  },
  {
    slug: "production",
    name: "Production",
  },
] as const;

/**
 * Lists all stages for a project, including variable counts per stage.
 *
 * Counts are derived from stage-scoped indexed reads so stage deletion guards
 * and UI status can rely on the same source of truth.
 */
export const listForCurrentOrgProject = query({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
  },
  returns: v.array(stageSummaryValidator),
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

    const stages = await ctx.db
      .query("projectStages")
      .withIndex("by_project_id", (q) => q.eq("projectId", project._id))
      .collect();

    return Promise.all(
      stages.map(async (stage) => {
        const variableCount = (
          await ctx.db
            .query("projectVariables")
            .withIndex("by_project_id_and_stage_slug", (q) =>
              q.eq("projectId", project._id).eq("stageSlug", stage.slug),
            )
            .collect()
        ).length;

        return {
          id: stage._id,
          projectId: stage.projectId,
          orgId: stage.orgId,
          slug: stage.slug,
          name: stage.name,
          isDefault: stage.isDefault,
          variableCount,
          createdAtMs: stage.createdAtMs,
          updatedAtMs: stage.updatedAtMs,
        };
      }),
    );
  },
});

/**
 * Creates a custom stage within a project.
 *
 * Stage slugs are allocated per-project and remain stable identifiers for
 * runtime selection in SDK/CLI config.
 */
export const createForCurrentOrgProject = mutation({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
    name: v.string(),
  },
  returns: stageSummaryValidator,
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

    const trimmedName = args.name.trim();
    if (trimmedName.length === 0) {
      throw new Error("Stage name is required.");
    }
    if (trimmedName.length > 64) {
      throw new Error("Stage name must be 64 characters or fewer.");
    }

    const slug = await allocateUniqueStageSlug(ctx, {
      projectId: project._id,
      slugBase: normalizeStageSlugBase(trimmedName),
    });
    const now = Date.now();

    const stageId = await ctx.db.insert("projectStages", {
      projectId: project._id,
      orgId: activeOrg.orgId,
      slug,
      name: trimmedName,
      isDefault: false,
      createdAtMs: now,
      updatedAtMs: now,
    });

    return {
      id: stageId,
      projectId: project._id,
      orgId: activeOrg.orgId,
      slug,
      name: trimmedName,
      isDefault: false,
      variableCount: 0,
      createdAtMs: now,
      updatedAtMs: now,
    };
  },
});

/**
 * Renames a project stage display name.
 *
 * The slug is intentionally immutable in this flow so runtime references do
 * not unexpectedly break after cosmetic name updates.
 */
export const renameForCurrentOrgProject = mutation({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
    name: v.string(),
  },
  returns: stageSummaryValidator,
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

    const trimmedName = args.name.trim();
    if (trimmedName.length === 0) {
      throw new Error("Stage name is required.");
    }
    if (trimmedName.length > 64) {
      throw new Error("Stage name must be 64 characters or fewer.");
    }

    const now = Date.now();
    await ctx.db.patch(stage._id, {
      name: trimmedName,
      updatedAtMs: now,
    });

    const variableCount = (
      await ctx.db
        .query("projectVariables")
        .withIndex("by_project_id_and_stage_slug", (q) =>
          q.eq("projectId", project._id).eq("stageSlug", stage.slug),
        )
        .collect()
    ).length;

    return {
      id: stage._id,
      projectId: project._id,
      orgId: activeOrg.orgId,
      slug: stage.slug,
      name: trimmedName,
      isDefault: stage.isDefault,
      variableCount,
      createdAtMs: stage.createdAtMs,
      updatedAtMs: now,
    };
  },
});

/**
 * Deletes a stage only when it has no variables.
 *
 * This guard prevents accidental data loss and forces explicit cleanup or
 * migration before removing a stage namespace.
 */
export const deleteForCurrentOrgProject = mutation({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
  },
  returns: v.object({
    deletedStageSlug: v.string(),
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

    const existingVariables = await ctx.db
      .query("projectVariables")
      .withIndex("by_project_id_and_stage_slug", (q) =>
        q.eq("projectId", project._id).eq("stageSlug", stage.slug),
      )
      .collect();
    if (existingVariables.length > 0) {
      throw new Error("Cannot delete a stage that still contains variables.");
    }

    await ctx.db.delete(stage._id);

    return {
      deletedStageSlug: stage.slug,
    };
  },
});

/**
 * Ensures the canonical default stages exist for a project.
 *
 * This is idempotent and intended for backfilling older projects created
 * before stage seeding was introduced.
 */
export const ensureDefaultStagesForCurrentOrgProject = mutation({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
  },
  returns: v.object({
    createdCount: v.number(),
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

    const existingStages = await ctx.db
      .query("projectStages")
      .withIndex("by_project_id", (q) => q.eq("projectId", project._id))
      .collect();
    const existingSlugs = new Set(existingStages.map((stage) => stage.slug));

    let createdCount = 0;
    for (const definition of DEFAULT_STAGE_DEFINITIONS) {
      if (existingSlugs.has(definition.slug)) {
        continue;
      }

      const now = Date.now();
      await ctx.db.insert("projectStages", {
        projectId: project._id,
        orgId: activeOrg.orgId,
        slug: definition.slug,
        name: definition.name,
        isDefault: true,
        createdAtMs: now,
        updatedAtMs: now,
      });
      createdCount += 1;
    }

    return {
      createdCount,
    };
  },
});
