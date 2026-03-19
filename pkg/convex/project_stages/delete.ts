import { Effect, Schema } from "effect";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { BarekeyConfectMutationCtx, schemaEffectMutation } from "../confect";
import {
  assertExpectedOrgSlugEffect,
  requireActiveOrgIdClaimsEffect,
  requireIdentityEffect,
} from "../lib/auth";
import { dbCollectEffect, dbDeleteEffect } from "../lib/convex/db";
import { appendAuditEventEffect } from "../lib/confect/audit";
import {
  AuthError,
  ExternalServiceError,
  NotFoundError,
  ValidationError,
} from "../lib/errors/effect";
import {
  findProjectByOrgIdAndSlugEffect,
  findStageByProjectIdAndSlugEffect,
} from "../lib/projects/scope";
import { toProjectStageExternalServiceError } from "./errors";

const deleteStageArgsSchema = Schema.Struct({
  expectedOrgSlug: Schema.String,
  projectSlug: Schema.String,
  stageSlug: Schema.String,
});

const deleteStageResultSchema = Schema.Struct({
  deletedStageSlug: Schema.String,
});

/**
 * Deletes a project stage for the current authenticated organization as an Effect program.
 *
 * @param args The expected organization slug, project slug, and stage slug.
 * @returns An Effect that succeeds with the deleted stage slug.
 * @remarks This blocks deletion when variables still exist in the stage and appends a stage deletion audit event.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function deleteForCurrentOrgProjectEffect(
  args: {
    expectedOrgSlug: string;
    projectSlug: string;
    stageSlug: string;
  },
): Effect.Effect<
  {
    deletedStageSlug: string;
  },
  AuthError | ExternalServiceError | NotFoundError | ValidationError,
  any
> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectMutationCtx;
    const runtimeCtx = confectCtx.ctx as unknown as MutationCtx;
    const identity = yield* requireIdentityEffect(runtimeCtx);
    const activeOrg = yield* requireActiveOrgIdClaimsEffect(identity);
    const db = runtimeCtx.db;

    if (activeOrg.orgSlug !== null) {
      yield* assertExpectedOrgSlugEffect(activeOrg, args.expectedOrgSlug);
    }

    const project = yield* findProjectByOrgIdAndSlugEffect(db, {
      orgId: activeOrg.orgId,
      projectSlug: args.projectSlug,
    });
    if (project === null) {
      return yield* Effect.fail(new NotFoundError({ message: "Project not found." }));
    }

    const stage = yield* findStageByProjectIdAndSlugEffect(db, {
      projectId: project._id,
      stageSlug: args.stageSlug,
    });
    if (stage === null) {
      return yield* Effect.fail(new NotFoundError({ message: "Stage not found." }));
    }

    const existingVariables = yield* dbCollectEffect(
      runtimeCtx,
      "projectVariables",
      (query) =>
        query.withIndex("by_project_id_and_stage_slug", (indexQuery) =>
          indexQuery.eq("projectId", project._id).eq("stageSlug", stage.slug),
        ),
      (error) => toProjectStageExternalServiceError("Failed to load stage variables.", error),
    );
    if (existingVariables.length > 0) {
      return yield* Effect.fail(
        new ValidationError({
          message: "Cannot delete a stage that still contains variables.",
        }),
      );
    }

    yield* dbDeleteEffect(runtimeCtx, stage._id, (error) =>
      toProjectStageExternalServiceError("Failed to delete the stage row.", error),
    );

    yield* appendAuditEventEffect({
      orgId: activeOrg.orgId,
      orgSlug: activeOrg.orgSlug ?? args.expectedOrgSlug,
      projectId: project._id,
      projectSlug: project.slug,
      stageSlug: stage.slug,
      eventType: "stage.deleted",
      category: "stage",
      actorSource: "barekey_user",
      actorClerkUserId: activeOrg.clerkUserId,
      actorDisplayName: null,
      actorEmail: null,
      subjectType: "stage",
      subjectId: String(stage._id),
      subjectName: stage.name,
      title: `Deleted stage ${stage.name}`,
      description: `Stage ${stage.name} was removed from project ${project.name}.`,
      severity: "warning",
      payloadJson: JSON.stringify({
        projectSlug: project.slug,
        stageSlug: stage.slug,
      }),
      retentionTierOverride: null,
    });

    return {
      deletedStageSlug: stage.slug,
    };
  });
}

/**
 * Deletes a stage only when it contains no variables.
 *
 * @param args The expected organization slug, project slug, and stage slug.
 * @returns The deleted stage slug.
 * @remarks This public mutation delegates to the Effect-native stage delete program.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const deleteForCurrentOrgProject = schemaEffectMutation({
  args: deleteStageArgsSchema,
  returns: deleteStageResultSchema,
  handler: deleteForCurrentOrgProjectEffect,
});
