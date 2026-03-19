import { Effect, Schema } from "effect";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { BarekeyConfectMutationCtx, schemaEffectMutation } from "../confect";
import {
  assertExpectedOrgSlugEffect,
  requireActiveOrgIdClaimsEffect,
  requireIdentityEffect,
} from "../lib/auth";
import { appendAuditEventEffect } from "../lib/confect/audit";
import { AuthError, ExternalServiceError, NotFoundError, ValidationError } from "../lib/errors/effect";
import { findProjectByOrgIdAndSlugEffect } from "../lib/projects/scope";
import { toProjectStageExternalServiceError } from "./errors";
import { allocateUniqueStageSlugEffect, normalizeStageSlugBase } from "./slug";
import { stageSummarySchema } from "./types";
import { validateStageNameEffect } from "./validation";

const createStageArgsSchema = Schema.Struct({
  expectedOrgSlug: Schema.String,
  projectSlug: Schema.String,
  name: Schema.String,
});

/**
 * Creates a custom stage within a project as an Effect program.
 *
 * @param args The expected organization slug, project slug, and stage name.
 * @returns An Effect that succeeds with the created stage summary.
 * @remarks This writes `projectStages` and appends a stage creation audit event.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function createForCurrentOrgProjectEffect(
  args: {
    expectedOrgSlug: string;
    projectSlug: string;
    name: string;
  },
): Effect.Effect<
  {
    id: Id<"projectStages">;
    projectId: Id<"projects">;
    orgId: string;
    slug: string;
    name: string;
    isDefault: boolean;
    variableCount: number;
    createdAtMs: number;
    updatedAtMs: number;
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

    const trimmedName = yield* validateStageNameEffect(args.name);
    const slug = yield* allocateUniqueStageSlugEffect(runtimeCtx, {
      projectId: project._id,
      slugBase: normalizeStageSlugBase(trimmedName),
    });
    const now = Date.now();

    const stageId = yield* Effect.tryPromise({
      try: () =>
        runtimeCtx.db.insert("projectStages", {
          projectId: project._id,
          orgId: activeOrg.orgId,
          slug,
          name: trimmedName,
          isDefault: false,
          createdAtMs: now,
          updatedAtMs: now,
        }),
      catch: (error) =>
        toProjectStageExternalServiceError("Failed to insert the project stage row.", error),
    });

    yield* appendAuditEventEffect({
      orgId: activeOrg.orgId,
      orgSlug: activeOrg.orgSlug ?? args.expectedOrgSlug,
      projectId: project._id,
      projectSlug: project.slug,
      stageSlug: slug,
      eventType: "stage.created",
      category: "stage",
      actorSource: "barekey_user",
      actorClerkUserId: activeOrg.clerkUserId,
      actorDisplayName: null,
      actorEmail: null,
      subjectType: "stage",
      subjectId: String(stageId),
      subjectName: trimmedName,
      title: `Created stage ${trimmedName}`,
      description: `Stage ${trimmedName} was added to project ${project.name}.`,
      severity: "info",
      payloadJson: JSON.stringify({
        projectSlug: project.slug,
        stageSlug: slug,
        isDefault: false,
      }),
      retentionTierOverride: null,
    });

    return {
      id: stageId,
      projectId: project._id,
      orgId: activeOrg.orgId,
      slug,
      name: trimmedName,
      isDefault: false,
      variableCount: 0,
      createdAtMs: now,
      updatedAtMs: now,
    };
  });
}

/**
 * Creates a custom stage within a project.
 *
 * @param args The expected org slug, project slug, and stage name.
 * @returns The created stage summary.
 * @remarks This public mutation delegates to the Effect-native stage create program.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const createForCurrentOrgProject = schemaEffectMutation({
  args: createStageArgsSchema,
  returns: stageSummarySchema,
  handler: createForCurrentOrgProjectEffect,
});
