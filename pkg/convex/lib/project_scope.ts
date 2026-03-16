import type { DatabaseReader } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

export async function findProjectByOrgIdAndSlug(
  db: DatabaseReader,
  args: { orgId: string; projectSlug: string },
): Promise<Doc<"projects"> | null> {
  return await db
    .query("projects")
    .withIndex("by_org_id_and_slug", (q) => q.eq("orgId", args.orgId).eq("slug", args.projectSlug))
    .unique();
}

export async function findProjectByOrgSlugAndSlug(
  db: DatabaseReader,
  args: { orgSlug: string; projectSlug: string },
): Promise<Doc<"projects"> | null> {
  return await db
    .query("projects")
    .withIndex("by_org_slug_and_slug", (q) =>
      q.eq("orgSlug", args.orgSlug).eq("slug", args.projectSlug),
    )
    .unique();
}

export async function findStageByProjectIdAndSlug(
  db: DatabaseReader,
  args: { projectId: Id<"projects">; stageSlug: string },
): Promise<Doc<"projectStages"> | null> {
  return await db
    .query("projectStages")
    .withIndex("by_project_id_and_slug", (q) =>
      q.eq("projectId", args.projectId).eq("slug", args.stageSlug),
    )
    .unique();
}

export async function findProjectStageByOrgIdAndSlug(
  db: DatabaseReader,
  args: { orgId: string; projectSlug: string; stageSlug: string },
): Promise<{ project: Doc<"projects">; stage: Doc<"projectStages"> } | null> {
  const project = await findProjectByOrgIdAndSlug(db, {
    orgId: args.orgId,
    projectSlug: args.projectSlug,
  });
  if (project === null) {
    return null;
  }

  const stage = await findStageByProjectIdAndSlug(db, {
    projectId: project._id,
    stageSlug: args.stageSlug,
  });
  if (stage === null) {
    return null;
  }

  return { project, stage };
}

export async function findProjectStageByOrgSlugAndSlug(
  db: DatabaseReader,
  args: { orgSlug: string; projectSlug: string; stageSlug: string },
): Promise<{ project: Doc<"projects">; stage: Doc<"projectStages"> } | null> {
  const project = await findProjectByOrgSlugAndSlug(db, {
    orgSlug: args.orgSlug,
    projectSlug: args.projectSlug,
  });
  if (project === null) {
    return null;
  }

  const stage = await findStageByProjectIdAndSlug(db, {
    projectId: project._id,
    stageSlug: args.stageSlug,
  });
  if (stage === null) {
    return null;
  }

  return { project, stage };
}

export async function requireProjectStageByOrgIdAndSlug(
  db: DatabaseReader,
  args: { orgId: string; projectSlug: string; stageSlug: string },
): Promise<{ project: Doc<"projects">; stage: Doc<"projectStages"> }> {
  const project = await findProjectByOrgIdAndSlug(db, {
    orgId: args.orgId,
    projectSlug: args.projectSlug,
  });
  if (project === null) {
    throw new Error("Project not found.");
  }

  const stage = await findStageByProjectIdAndSlug(db, {
    projectId: project._id,
    stageSlug: args.stageSlug,
  });
  if (stage === null) {
    throw new Error("Stage not found.");
  }

  return { project, stage };
}

export async function listProjectVariableRowsForStage(
  db: DatabaseReader,
  args: { projectId: Id<"projects">; stageSlug: string },
) {
  return await db
    .query("projectVariables")
    .withIndex("by_project_id_and_stage_slug", (q) =>
      q.eq("projectId", args.projectId).eq("stageSlug", args.stageSlug),
    )
    .collect();
}
