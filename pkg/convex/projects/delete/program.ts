import { Id as ConfectId } from "@rjdellecese/confect/server";
import { Effect, Schema } from "effect";

import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { BarekeyConfectMutationCtx, schemaEffectMutation } from "../../confect";
import {
  assertExpectedOrgSlugEffect,
  requireActiveOrgIdClaimsEffect,
  requireIdentityEffect,
} from "../../lib/auth";
import { appendAuditEventEffect } from "../../lib/confect/audit";
import {
  AuthError,
  ExternalServiceError,
  NotFoundError,
  ValidationError,
} from "../../lib/errors/effect";
import { findProjectByOrgIdAndSlugEffect } from "../../lib/projects/scope";
import {
  deleteProjectKeysEffect,
  deleteProjectRowEffect,
  listProjectKeysForDeleteEffect,
  loadProjectDeleteBlockingRowsEffect,
} from "./repo";

const deleteProjectArgsSchema = Schema.Struct({
  expectedOrgSlug: Schema.String,
  projectSlug: Schema.String,
});

const deleteProjectResultSchema = Schema.Struct({
  deletedProjectId: ConfectId.Id("projects"),
  deletedProjectSlug: Schema.String,
});

/**
 * Deletes a project for the current authenticated organization as an Effect program.
 *
 * @param args The expected organization slug and project slug.
 * @returns An Effect that succeeds with the deleted project identifier and slug.
 * @remarks This deletes project keys before removing the project row and appends a project deletion audit event.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
function deleteForCurrentOrgEffect(
  args: {
    expectedOrgSlug: string;
    projectSlug: string;
  },
): Effect.Effect<
  {
    deletedProjectId: Id<"projects">;
    deletedProjectSlug: string;
  },
  AuthError | ExternalServiceError | NotFoundError | ValidationError,
  any
> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectMutationCtx;
    const runtimeCtx = confectCtx.ctx as unknown as MutationCtx;
    const identity = yield* requireIdentityEffect(runtimeCtx);
    const activeOrg = yield* requireActiveOrgIdClaimsEffect(identity);

    if (activeOrg.orgSlug !== null) {
      yield* assertExpectedOrgSlugEffect(activeOrg, args.expectedOrgSlug);
    }

    const project = yield* findProjectByOrgIdAndSlugEffect(runtimeCtx.db, {
      orgId: activeOrg.orgId,
      projectSlug: args.projectSlug,
    });
    if (project === null) {
      return yield* Effect.fail(new NotFoundError({ message: "Project not found." }));
    }

    const blockingRows = yield* loadProjectDeleteBlockingRowsEffect(runtimeCtx, {
      orgId: activeOrg.orgId,
      projectId: String(project._id),
    });

    if (blockingRows.variables.length > 0 || blockingRows.stages.length > 0) {
      return yield* Effect.fail(
        new ValidationError({
          message: `Delete blocked. Remove all environments and variables first (${blockingRows.stages.length} environments, ${blockingRows.variables.length} variables remaining).`,
        }),
      );
    }

    const keys = yield* listProjectKeysForDeleteEffect(runtimeCtx, {
      orgId: activeOrg.orgId,
      projectId: String(project._id),
    });

    yield* deleteProjectKeysEffect(
      runtimeCtx,
      keys.map((row) => String(row._id)),
    );
    yield* deleteProjectRowEffect(runtimeCtx, String(project._id));

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
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const deleteForCurrentOrg = schemaEffectMutation({
  args: deleteProjectArgsSchema,
  returns: deleteProjectResultSchema,
  handler: deleteForCurrentOrgEffect,
});
