import type { UserIdentity } from "convex/server";

import type { Doc } from "../_generated/dataModel";
import type { ActiveOrgIdClaims } from "../lib/auth";
import {
  assertExpectedOrgSlug,
  getActiveOrgIdClaimsOrNull,
  requireActiveOrgIdClaims,
  requireIdentity,
} from "../lib/auth";

type AuthDbCtxLike = {
  auth: {
    getUserIdentity(): Promise<UserIdentity | null>;
  };
  db: any;
};

/**
 * Resolves the active organization and project for read-only flows that may
 * return an empty result instead of throwing.
 *
 * @param ctx The Convex context carrying auth and database access.
 * @param expectedOrgSlug The active workspace slug expected by the caller.
 * @param projectSlug The project slug to resolve within the active organization.
 * @returns The active org and project, or `null` when unavailable or mismatched.
 * @remarks This is used by the list flow so unauthorized callers fail closed with no schedule data.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function getCurrentOrgProjectAccessOrNull(
  ctx: AuthDbCtxLike,
  expectedOrgSlug: string,
  projectSlug: string,
): Promise<
  | {
      activeOrg: ActiveOrgIdClaims;
      project: Doc<"projects">;
    }
  | null
> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    return null;
  }

  const activeOrg = getActiveOrgIdClaimsOrNull(identity);
  if (activeOrg === null) {
    return null;
  }

  if (activeOrg.orgSlug !== null && activeOrg.orgSlug !== expectedOrgSlug) {
    return null;
  }

  const project = await ctx.db
    .query("projects")
    .withIndex("by_org_id_and_slug", (q: any) =>
      q.eq("orgId", activeOrg.orgId).eq("slug", projectSlug),
    )
    .unique();
  if (project === null) {
    return null;
  }

  return { activeOrg, project };
}

/**
 * Resolves and validates the active organization and project for a workspace
 * mutation or action.
 *
 * @param ctx The Convex context carrying auth and database access.
 * @param expectedOrgSlug The active workspace slug expected by the caller.
 * @param projectSlug The project slug to resolve within the active organization.
 * @returns The validated active org and project.
 * @remarks This throws when auth, org, or project scope validation fails.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function requireCurrentOrgProjectAccess(
  ctx: AuthDbCtxLike,
  expectedOrgSlug: string,
  projectSlug: string,
): Promise<{
  activeOrg: ReturnType<typeof requireActiveOrgIdClaims>;
  project: Doc<"projects">;
}> {
  const identity = await requireIdentity(ctx);
  const activeOrg = requireActiveOrgIdClaims(identity);
  if (activeOrg.orgSlug !== null) {
    assertExpectedOrgSlug(activeOrg, expectedOrgSlug);
  }

  const project = await ctx.db
    .query("projects")
    .withIndex("by_org_id_and_slug", (q: any) =>
      q.eq("orgId", activeOrg.orgId).eq("slug", projectSlug),
    )
    .unique();
  if (project === null) {
    throw new Error("Project not found.");
  }

  return { activeOrg, project };
}

/**
 * Resolves a stage within a project by slug.
 *
 * @param ctx The Convex context carrying database access.
 * @param projectId The project identifier.
 * @param stageSlug The stage slug to resolve.
 * @returns The matching stage row.
 * @remarks This throws when the stage does not exist in the given project.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function requireStageInProject(
  ctx: Pick<AuthDbCtxLike, "db">,
  projectId: Doc<"projects">["_id"],
  stageSlug: string,
): Promise<Doc<"projectStages">> {
  const stage = await ctx.db
    .query("projectStages")
    .withIndex("by_project_id_and_slug", (q: any) =>
      q.eq("projectId", projectId).eq("slug", stageSlug),
    )
    .unique();
  if (stage === null) {
    throw new Error("Stage not found.");
  }

  return stage;
}
