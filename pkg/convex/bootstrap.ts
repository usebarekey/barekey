import { v } from "convex/values";

import { internalMutation } from "./_generated/server";

const defaultStages = [
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

const bootstrapProjectValidator = v.object({
  id: v.id("projects"),
  orgId: v.string(),
  orgSlug: v.string(),
  slug: v.string(),
  name: v.string(),
  createdAtMs: v.number(),
  updatedAtMs: v.number(),
});

function normalizeProjectSlug(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (slug.length === 0) {
    throw new Error("Project slug is required.");
  }

  return slug;
}

export const ensureConfigProjectForOrgInternal = internalMutation({
  args: {
    orgId: v.string(),
    orgSlug: v.string(),
    clerkUserId: v.string(),
    projectSlug: v.string(),
    projectName: v.string(),
  },
  returns: bootstrapProjectValidator,
  handler: async (ctx, args) => {
    const projectSlug = normalizeProjectSlug(args.projectSlug);
    const projectName = args.projectName.trim();
    if (projectName.length === 0) {
      throw new Error("Project name is required.");
    }

    const existing = await ctx.db
      .query("projects")
      .withIndex("by_org_slug_and_slug", (q) =>
        q.eq("orgSlug", args.orgSlug).eq("slug", projectSlug),
      )
      .unique();

    const now = Date.now();
    const projectId =
      existing?._id ??
      (await ctx.db.insert("projects", {
        orgId: args.orgId,
        orgSlug: args.orgSlug,
        name: projectName,
        slug: projectSlug,
        slugBase: projectSlug,
        createdByClerkUserId: args.clerkUserId,
        createdAtMs: now,
        updatedAtMs: now,
      }));

    const project = existing ?? (await ctx.db.get(projectId));

    if (project === null) {
      throw new Error("Config project could not be created.");
    }

    const stages = await ctx.db
      .query("projectStages")
      .withIndex("by_project_id", (q) => q.eq("projectId", project._id))
      .collect();
    const existingStageSlugs = new Set(stages.map((stage) => stage.slug));

    for (const stage of defaultStages) {
      if (existingStageSlugs.has(stage.slug)) {
        continue;
      }

      await ctx.db.insert("projectStages", {
        projectId: project._id,
        orgId: args.orgId,
        slug: stage.slug,
        name: stage.name,
        isDefault: stage.slug === "development",
        createdAtMs: now,
        updatedAtMs: now,
      });
    }

    return {
      id: project._id,
      orgId: project.orgId,
      orgSlug: project.orgSlug,
      slug: project.slug,
      name: project.name,
      createdAtMs: project.createdAtMs,
      updatedAtMs: project.updatedAtMs,
    };
  },
});
