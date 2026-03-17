import { Effect } from "effect";
import { v } from "convex/values";

import type { MutationCtx } from "../_generated/server";
import { BarekeyConfectMutationCtx, effectMutation } from "../confect";
import {
  assertExpectedOrgSlugEffect,
  requireActiveOrgIdClaimsEffect,
  requireIdentityEffect,
} from "../lib/auth";
import { appendAuditEventEffect } from "../lib/confect/audit";
import {
  AuthError,
  ExternalServiceError,
  NotFoundError,
  ValidationError,
} from "../lib/effect_errors";
import { findProjectByOrgIdAndSlugEffect } from "../lib/project_scope";

/**
 * Normalizes unknown project-deletion failures into the shared external-service error model.
 *
 * @param fallbackMessage The message to use when the failure has no useful `Error` message.
 * @param error The unknown thrown failure value.
 * @returns A typed external-service error.
 * @remarks This keeps project delete workflows from leaking raw thrown values into Effect programs.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function toProjectDeleteError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}

/**
 * Deletes a project for the current authenticated organization as an Effect program.
 *
 * @param args The expected organization slug and project slug.
 * @returns An Effect that succeeds with the deleted project identifier and slug.
 * @remarks This deletes project keys before removing the project row and appends a project deletion audit event.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function deleteForCurrentOrgEffect(
  args: {
    expectedOrgSlug: string;
    projectSlug: string;
  },
): Effect.Effect<
  {
    deletedProjectId: string;
    deletedProjectSlug: string;
  },
  AuthError | ExternalServiceError | NotFoundError | ValidationError,
  any
> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectMutationCtx;
    const ctx = confectCtx.ctx as unknown as MutationCtx;
    const identity = yield* requireIdentityEffect(ctx);
    const activeOrg = yield* requireActiveOrgIdClaimsEffect(identity);

    if (activeOrg.orgSlug !== null) {
      yield* assertExpectedOrgSlugEffect(activeOrg, args.expectedOrgSlug);
    }

    const project = yield* findProjectByOrgIdAndSlugEffect(ctx.db, {
      orgId: activeOrg.orgId,
      projectSlug: args.projectSlug,
    });
    if (project === null) {
      return yield* Effect.fail(new NotFoundError({ message: "Project not found." }));
    }

    const [variables, stages] = yield* Effect.all([
      Effect.tryPromise({
        try: () =>
          ctx.db
            .query("projectVariables")
            .withIndex("by_org_id_and_project_id", (q) =>
              q.eq("orgId", activeOrg.orgId).eq("projectId", project._id),
            )
            .collect(),
        catch: (error) => toProjectDeleteError("Failed to load project variables.", error),
      }),
      Effect.tryPromise({
        try: () =>
          ctx.db
            .query("projectStages")
            .withIndex("by_org_id_and_project_id", (q) =>
              q.eq("orgId", activeOrg.orgId).eq("projectId", project._id),
            )
            .collect(),
        catch: (error) => toProjectDeleteError("Failed to load project stages.", error),
      }),
    ]);

    if (variables.length > 0 || stages.length > 0) {
      return yield* Effect.fail(
        new ValidationError({
          message: `Delete blocked. Remove all environments and variables first (${stages.length} environments, ${variables.length} variables remaining).`,
        }),
      );
    }

    const keys = yield* Effect.tryPromise({
      try: () =>
        ctx.db
          .query("projectKeys")
          .withIndex("by_org_id_and_project_id", (q) =>
            q.eq("orgId", activeOrg.orgId).eq("projectId", project._id),
          )
          .collect(),
      catch: (error) => toProjectDeleteError("Failed to load project keys.", error),
    });

    yield* Effect.forEach(
      keys,
      (row) =>
        Effect.tryPromise({
          try: () => ctx.db.delete(row._id),
          catch: (error) =>
            toProjectDeleteError(`Failed to delete project key ${String(row._id)}.`, error),
        }),
      { discard: true },
    );

    yield* Effect.tryPromise({
      try: () => ctx.db.delete(project._id),
      catch: (error) => toProjectDeleteError("Failed to delete the project row.", error),
    });

    yield* appendAuditEventEffect({
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
  });
}

/**
 * Deletes a project when it no longer contains stages or variables.
 *
 * @param args The expected organization slug and project slug.
 * @returns The deleted project identifier and slug.
 * @remarks This public mutation delegates to the Effect-native project delete program.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const deleteForCurrentOrg = effectMutation({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
  },
  returns: v.object({
    deletedProjectId: v.id("projects"),
    deletedProjectSlug: v.string(),
  }),
  handler: deleteForCurrentOrgEffect,
});
