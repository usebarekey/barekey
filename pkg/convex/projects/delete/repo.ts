import { Effect } from "effect";

import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { dbCollectEffect, dbDeleteEffect } from "../../lib/convex/db";
import { toProjectDeleteError } from "./shared";

/**
 * Loads project variables and stages for delete blocking checks.
 *
 * @param ctx The Convex mutation context.
 * @param input The organization and project ids to inspect.
 * @returns The project variables and stages that would block deletion.
 * @remarks Project deletion is blocked while any environments or variables still exist.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function loadProjectDeleteBlockingRowsEffect(
  ctx: MutationCtx,
  input: {
    orgId: string;
    projectId: string;
  },
) {
  return Effect.all({
    variables: dbCollectEffect<
      Doc<"projectVariables">,
      ReturnType<typeof toProjectDeleteError>
    >(
      ctx,
      "projectVariables",
      (query) =>
        query.withIndex("by_org_id_and_project_id", (indexQuery) =>
          indexQuery.eq("orgId", input.orgId).eq("projectId", input.projectId as never),
        ),
      (error) => toProjectDeleteError("Failed to load project variables.", error),
    ),
    stages: dbCollectEffect<Doc<"projectStages">, ReturnType<typeof toProjectDeleteError>>(
      ctx,
      "projectStages",
      (query) =>
        query.withIndex("by_org_id_and_project_id", (indexQuery) =>
          indexQuery.eq("orgId", input.orgId).eq("projectId", input.projectId as never),
        ),
      (error) => toProjectDeleteError("Failed to load project stages.", error),
    ),
  });
}

/**
 * Loads wrapped project keys for deletion.
 *
 * @param ctx The Convex mutation context.
 * @param input The organization and project ids to inspect.
 * @returns The project key rows for the project.
 * @remarks Project keys are removed before the project row itself.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function listProjectKeysForDeleteEffect(
  ctx: MutationCtx,
  input: {
    orgId: string;
    projectId: string;
  },
) {
  return dbCollectEffect<Doc<"projectKeys">, ReturnType<typeof toProjectDeleteError>>(
    ctx,
    "projectKeys",
    (query) =>
      query.withIndex("by_org_id_and_project_id", (indexQuery) =>
        indexQuery.eq("orgId", input.orgId).eq("projectId", input.projectId as never),
      ),
    (error) => toProjectDeleteError("Failed to load project keys.", error),
  );
}

/**
 * Deletes all wrapped project keys for one project.
 *
 * @param ctx The Convex mutation context.
 * @param keyIds The project key ids to delete.
 * @returns An Effect that completes after the keys are removed.
 * @remarks This runs before deleting the project row to avoid leaving wrapped DEKs behind.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function deleteProjectKeysEffect(ctx: MutationCtx, keyIds: Array<string>) {
  return Effect.forEach(
    keyIds,
    (rowId) =>
      dbDeleteEffect(ctx, rowId as Id<"projectKeys">, (error) =>
        toProjectDeleteError(`Failed to delete project key ${String(rowId)}.`, error),
      ),
    { discard: true },
  );
}

/**
 * Deletes a project row.
 *
 * @param ctx The Convex mutation context.
 * @param projectId The project id to delete.
 * @returns An Effect that completes after the row is removed.
 * @remarks The project row is deleted only after validation and key cleanup succeed.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function deleteProjectRowEffect(ctx: MutationCtx, projectId: string) {
  return dbDeleteEffect(ctx, projectId, (error) =>
    toProjectDeleteError("Failed to delete the project row.", error),
  );
}
