import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, mutation, query } from "./confect";
import type { MutationCtx } from "./_generated/server";
import {
  assertExpectedOrgSlug,
  getActiveOrgIdClaimsOrNull,
  requireIdentity,
  requireActiveOrgIdClaims,
} from "./lib/auth";

function normalizeProjectSlugBase(name: string): string {
  const normalized = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 48);

  return normalized.length > 0 ? normalized : "project";
}

function randomNumericSuffix(length: number): string {
  const upperBound = 10 ** length;
  const value = Math.floor(Math.random() * upperBound);
  return String(value).padStart(length, "0");
}

async function allocateUniqueProjectSlug(
  ctx: MutationCtx,
  args: { orgId: string; slugBase: string },
): Promise<string> {
  for (const suffixLength of [4, 6] as const) {
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const candidate = `${args.slugBase}-${randomNumericSuffix(suffixLength)}`;
      const existing = await ctx.db
        .query("projects")
        .withIndex("by_org_id_and_slug", (q) => q.eq("orgId", args.orgId).eq("slug", candidate))
        .unique();

      if (existing === null) {
        return candidate;
      }
    }
  }

  throw new Error("Unable to allocate a unique project slug.");
}

const projectSummaryValidator = v.object({
  id: v.id("projects"),
  orgId: v.string(),
  orgSlug: v.string(),
  name: v.string(),
  slug: v.string(),
  slugBase: v.string(),
  createdByClerkUserId: v.string(),
  createdAtMs: v.number(),
  updatedAtMs: v.number(),
});

const projectListItemValidator = v.object({
  id: v.id("projects"),
  orgId: v.string(),
  orgSlug: v.string(),
  name: v.string(),
  slug: v.string(),
  slugBase: v.string(),
  createdByClerkUserId: v.string(),
  createdAtMs: v.number(),
  updatedAtMs: v.number(),
  secretCount: v.number(),
});

type ProjectSummary = {
  id: Id<"projects">;
  orgId: string;
  orgSlug: string;
  name: string;
  slug: string;
  slugBase: string;
  createdByClerkUserId: string;
  createdAtMs: number;
  updatedAtMs: number;
};

const DEFAULT_PROJECT_STAGES = [
  {
    slug: "development",
    name: "Development",
  },
  {
    slug: "production",
    name: "Production",
  },
] as const;

export const createForCurrentOrg = action({
  args: {
    expectedOrgSlug: v.string(),
    name: v.string(),
  },
  returns: projectSummaryValidator,
  handler: async (ctx, args): Promise<ProjectSummary> => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    const trimmedName = args.name.trim();
    if (trimmedName.length === 0) {
      throw new Error("Project name is required.");
    }

    if (trimmedName.length > 120) {
      throw new Error("Project name must be 120 characters or fewer.");
    }

    await ctx.runAction(internal.payments.assertWorkspacePlanForCurrentOrgInternal, {
      expectedOrgSlug: args.expectedOrgSlug,
    });

    return await ctx.runMutation(internal.projects.createForCurrentOrgInternal, {
      expectedOrgSlug: args.expectedOrgSlug,
      name: trimmedName,
    });
  },
});

export const createForCurrentOrgInternal = internalMutation({
  args: {
    expectedOrgSlug: v.string(),
    name: v.string(),
  },
  returns: projectSummaryValidator,
  handler: async (ctx, args): Promise<ProjectSummary> => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    const trimmedName = args.name.trim();
    if (trimmedName.length === 0) {
      throw new Error("Project name is required.");
    }

    if (trimmedName.length > 120) {
      throw new Error("Project name must be 120 characters or fewer.");
    }

    const slugBase = normalizeProjectSlugBase(trimmedName);
    const slug = await allocateUniqueProjectSlug(ctx, {
      orgId: activeOrg.orgId,
      slugBase,
    });
    const now = Date.now();

    const id = await ctx.db.insert("projects", {
      orgId: activeOrg.orgId,
      orgSlug: args.expectedOrgSlug,
      name: trimmedName,
      slug,
      slugBase,
      createdByClerkUserId: activeOrg.clerkUserId,
      createdAtMs: now,
      updatedAtMs: now,
    });

    for (const stage of DEFAULT_PROJECT_STAGES) {
      await ctx.db.insert("projectStages", {
        projectId: id,
        orgId: activeOrg.orgId,
        slug: stage.slug,
        name: stage.name,
        isDefault: true,
        createdAtMs: now,
        updatedAtMs: now,
      });
    }

    await ctx.runMutation(internal.audit.appendEventInternal, {
      orgId: activeOrg.orgId,
      orgSlug: args.expectedOrgSlug,
      projectId: id,
      projectSlug: slug,
      stageSlug: null,
      eventType: "project.created",
      category: "project",
      actorSource: "barekey_user",
      actorClerkUserId: activeOrg.clerkUserId,
      actorDisplayName: null,
      actorEmail: null,
      subjectType: "project",
      subjectId: String(id),
      subjectName: trimmedName,
      title: `Created project ${trimmedName}`,
      description: `Project ${trimmedName} is ready with development and production stages.`,
      severity: "info",
      payloadJson: JSON.stringify({
        projectSlug: slug,
        defaultStages: DEFAULT_PROJECT_STAGES.map((stage) => stage.slug),
      }),
      retentionTierOverride: null,
    });

    return {
      id,
      orgId: activeOrg.orgId,
      orgSlug: args.expectedOrgSlug,
      name: trimmedName,
      slug,
      slugBase,
      createdByClerkUserId: activeOrg.clerkUserId,
      createdAtMs: now,
      updatedAtMs: now,
    };
  },
});

export const listForCurrentOrg = query({
  args: {
    expectedOrgSlug: v.string(),
  },
  returns: v.array(projectListItemValidator),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return [];
    }

    const activeOrg = getActiveOrgIdClaimsOrNull(identity);
    if (activeOrg === null) {
      // During Clerk <-> Convex org switching, claims may briefly be absent.
      return [];
    }

    if (activeOrg.orgSlug !== null && activeOrg.orgSlug !== args.expectedOrgSlug) {
      // Route/org can briefly drift while active org is switching; treat as loading.
      return [];
    }

    const rows = await ctx.db
      .query("projects")
      .withIndex("by_org_id_and_created_at_ms", (q) => q.eq("orgId", activeOrg.orgId))
      .order("desc")
      .collect();

    return Promise.all(
      rows.map(async (row) => {
        const secretCount = (
          await ctx.db
            .query("projectVariables")
            .withIndex("by_org_id_and_project_id", (q) =>
              q.eq("orgId", activeOrg.orgId).eq("projectId", row._id),
            )
            .collect()
        ).length;

        return {
          id: row._id,
          orgId: row.orgId,
          orgSlug: row.orgSlug,
          name: row.name,
          slug: row.slug,
          slugBase: row.slugBase,
          createdByClerkUserId: row.createdByClerkUserId,
          createdAtMs: row.createdAtMs,
          updatedAtMs: row.updatedAtMs,
          secretCount,
        };
      }),
    );
  },
});

export const getBySlugForCurrentOrg = query({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
  },
  returns: v.union(projectSummaryValidator, v.null()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }

    const activeOrg = getActiveOrgIdClaimsOrNull(identity);
    if (activeOrg === null) {
      // During Clerk <-> Convex org switching, claims may briefly be absent.
      return null;
    }

    if (activeOrg.orgSlug !== null && activeOrg.orgSlug !== args.expectedOrgSlug) {
      // Route/org can briefly drift while active org is switching; treat as loading.
      return null;
    }

    const row = await ctx.db
      .query("projects")
      .withIndex("by_org_id_and_slug", (q) =>
        q.eq("orgId", activeOrg.orgId).eq("slug", args.projectSlug),
      )
      .unique();

    if (row === null) {
      return null;
    }

    return {
      id: row._id,
      orgId: row.orgId,
      orgSlug: row.orgSlug,
      name: row.name,
      slug: row.slug,
      slugBase: row.slugBase,
      createdByClerkUserId: row.createdByClerkUserId,
      createdAtMs: row.createdAtMs,
      updatedAtMs: row.updatedAtMs,
    };
  },
});

export const deleteForCurrentOrg = mutation({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
  },
  returns: v.object({
    deletedProjectId: v.id("projects"),
    deletedProjectSlug: v.string(),
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

    const [variables, stages] = await Promise.all([
      ctx.db
        .query("projectVariables")
        .withIndex("by_org_id_and_project_id", (q) =>
          q.eq("orgId", activeOrg.orgId).eq("projectId", project._id),
        )
        .collect(),
      ctx.db
        .query("projectStages")
        .withIndex("by_org_id_and_project_id", (q) =>
          q.eq("orgId", activeOrg.orgId).eq("projectId", project._id),
        )
        .collect(),
    ]);

    if (variables.length > 0 || stages.length > 0) {
      throw new Error(
        `Delete blocked. Remove all environments and variables first (${stages.length} environments, ${variables.length} variables remaining).`,
      );
    }

    const keys = await ctx.db
      .query("projectKeys")
      .withIndex("by_org_id_and_project_id", (q) =>
        q.eq("orgId", activeOrg.orgId).eq("projectId", project._id),
      )
      .collect();

    for (const row of keys) {
      await ctx.db.delete(row._id);
    }

    await ctx.db.delete(project._id);

    await ctx.runMutation(internal.audit.appendEventInternal, {
      orgId: activeOrg.orgId,
      orgSlug: activeOrg.orgSlug ?? args.expectedOrgSlug,
      projectId: project._id,
      projectSlug: project.slug,
      stageSlug: null,
      eventType: "project.deleted",
      category: "project",
      actorSource: "barekey_user",
      actorClerkUserId: activeOrg.clerkUserId,
      actorDisplayName: null,
      actorEmail: null,
      subjectType: "project",
      subjectId: String(project._id),
      subjectName: project.name,
      title: `Deleted project ${project.name}`,
      description: `Project ${project.name} and its keys were removed from this workspace.`,
      severity: "warning",
      payloadJson: JSON.stringify({
        projectSlug: project.slug,
        deletedKeyCount: keys.length,
      }),
      retentionTierOverride: null,
    });

    return {
      deletedProjectId: project._id,
      deletedProjectSlug: project.slug,
    };
  },
});
