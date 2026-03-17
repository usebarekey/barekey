import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Finds a project by slug within an organization.
 *
 * @param ctx The Convex query or mutation context.
 * @param args The organization id and project slug.
 * @returns The matching project row, or `null`.
 * @remarks This is the shared lookup used by project-stage queries and mutations.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function findProjectBySlugForOrg(
  ctx: QueryCtx | MutationCtx,
  args: {
    orgId: string;
    projectSlug: string;
  },
): Promise<Doc<"projects"> | null> {
  return await ctx.db
    .query("projects")
    .withIndex("by_org_id_and_slug", (q) => q.eq("orgId", args.orgId).eq("slug", args.projectSlug))
    .unique();
}

/**
 * Requires a project by slug within an organization.
 *
 * @param ctx The Convex query or mutation context.
 * @param args The organization id and project slug.
 * @returns The matching project row.
 * @remarks This throws the legacy project-not-found error used by the existing project-stage API surface.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function requireProjectBySlugForOrg(
  ctx: QueryCtx | MutationCtx,
  args: {
    orgId: string;
    projectSlug: string;
  },
): Promise<Doc<"projects">> {
  const project = await findProjectBySlugForOrg(ctx, args);
  if (project === null) {
    throw new Error("Project not found.");
  }
  return project;
}

/**
 * Counts variables for a project stage.
 *
 * @param ctx The Convex query or mutation context.
 * @param args The project id and stage slug.
 * @returns The number of variables assigned to the stage.
 * @remarks Stage list and stage mutation responses use the same count source of truth.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function countVariablesForStage(
  ctx: QueryCtx | MutationCtx,
  args: {
    projectId: Doc<"projects">["_id"];
    stageSlug: string;
  },
): Promise<number> {
  return (
    await ctx.db
      .query("projectVariables")
      .withIndex("by_project_id_and_stage_slug", (q) =>
        q.eq("projectId", args.projectId).eq("stageSlug", args.stageSlug),
      )
      .collect()
  ).length;
}
