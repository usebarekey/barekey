import { v } from "convex/values";

import { internalQuery } from "./_generated/server";

const typegenVariableValidator = v.object({
  name: v.string(),
  kind: v.union(v.literal("secret"), v.literal("ab_roll"), v.literal("rollout")),
  declaredType: v.union(
    v.literal("string"),
    v.literal("number"),
    v.literal("boolean"),
    v.literal("json"),
  ),
  required: v.boolean(),
  updatedAtMs: v.number(),
});

export const buildManifestForOrgProjectStageInternal = internalQuery({
  args: {
    orgId: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
  },
  returns: v.union(
    v.object({
      orgId: v.string(),
      orgSlug: v.string(),
      projectSlug: v.string(),
      stageSlug: v.string(),
      generatedAtMs: v.number(),
      variables: v.array(typegenVariableValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_org_id_and_slug", (q) =>
        q.eq("orgId", args.orgId).eq("slug", args.projectSlug),
      )
      .unique();
    if (project === null) {
      return null;
    }

    const stage = await ctx.db
      .query("projectStages")
      .withIndex("by_project_id_and_slug", (q) =>
        q.eq("projectId", project._id).eq("slug", args.stageSlug),
      )
      .unique();
    if (stage === null) {
      return null;
    }

    const rows = await ctx.db
      .query("projectVariables")
      .withIndex("by_project_id_and_stage_slug", (q) =>
        q.eq("projectId", project._id).eq("stageSlug", stage.slug),
      )
      .collect();

    const variables = rows
      .map((row) => ({
        name: row.name,
        kind: row.kind,
        declaredType: "string" as const,
        required: true,
        updatedAtMs: row.updatedAtMs,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));

    return {
      orgId: project.orgId,
      orgSlug: project.orgSlug,
      projectSlug: project.slug,
      stageSlug: stage.slug,
      generatedAtMs: Date.now(),
      variables,
    };
  },
});
