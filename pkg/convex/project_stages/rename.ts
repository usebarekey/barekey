import { Effect, Schema } from "effect";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { BarekeyConfectMutationCtx, schemaEffectMutation } from "../confect";
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
} from "../lib/errors/effect";
import { findStageByProjectIdAndSlugEffect } from "../lib/projects/scope";
import {
  countVariablesForStageEffect,
  requireProjectBySlugForOrgEffect,
} from "./access";
import { toProjectStageExternalServiceError } from "./errors";
import { stageSummarySchema } from "./types";
import { validateStageNameEffect } from "./validation";

const renameStageArgsSchema = Schema.Struct({
  expectedOrgSlug: Schema.String,
  projectSlug: Schema.String,
  stageSlug: Schema.String,
  name: Schema.String,
});

/**
 * Renames a project stage display name as an Effect program.
 *
 * @param args The expected org slug, project slug, stage slug, and next stage name.
 * @returns An Effect that succeeds with the updated stage summary.
 * @remarks The stage slug remains immutable; this only patches the display name and appends an audit event.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function renameForCurrentOrgProjectEffect(
  args: {
    expectedOrgSlug: string;
    projectSlug: string;
    stageSlug: string;
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

    const project = yield* requireProjectBySlugForOrgEffect(runtimeCtx, {
      orgId: activeOrg.orgId,
      projectSlug: args.projectSlug,
    });
    const stage = yield* findStageByProjectIdAndSlugEffect(runtimeCtx.db, {
      projectId: project._id,
      stageSlug: args.stageSlug,
    }).pipe(
      Effect.flatMap((value) =>
        value === null
          ? Effect.fail(new NotFoundError({ message: "Stage not found." }))
          : Effect.succeed(value),
      ),
    );

    const trimmedName = yield* validateStageNameEffect(args.name);
    const now = Date.now();

    yield* Effect.tryPromise({
      try: () =>
        runtimeCtx.db.patch(stage._id, {
          name: trimmedName,
          updatedAtMs: now,
        }),
      catch: (error) =>
        toProjectStageExternalServiceError("Failed to update the stage name.", error),
    });

    yield* appendAuditEventEffect({
      orgId: activeOrg.orgId,
      orgSlug: activeOrg.orgSlug ?? args.expectedOrgSlug,
      projectId: project._id,
      projectSlug: project.slug,
      stageSlug: stage.slug,
      eventType: "stage.renamed",
      category: "stage",
      actorSource: "barekey_user",
      actorClerkUserId: activeOrg.clerkUserId,
      actorDisplayName: null,
      actorEmail: null,
      subjectType: "stage",
      subjectId: String(stage._id),
      subjectName: trimmedName,
      title: `Renamed stage ${stage.name}`,
      description: `Stage ${stage.slug} is now labeled ${trimmedName}.`,
      severity: "info",
      payloadJson: JSON.stringify({
        projectSlug: project.slug,
        stageSlug: stage.slug,
        previousName: stage.name,
        nextName: trimmedName,
      }),
      retentionTierOverride: null,
    });

    const variableCount = yield* countVariablesForStageEffect(runtimeCtx, {
      projectId: project._id,
      stageSlug: stage.slug,
    });

    return {
      id: stage._id,
      projectId: project._id,
      orgId: activeOrg.orgId,
      slug: stage.slug,
      name: trimmedName,
      isDefault: stage.isDefault,
      variableCount,
      createdAtMs: stage.createdAtMs,
      updatedAtMs: now,
    };
  });
}

/**
 * Renames a project stage display name.
 *
 * @param runtimeCtx The Convex mutation context.
 * @param args The expected org slug, project slug, stage slug, and next stage name.
 * @returns The updated stage summary.
 * @remarks The stage slug remains immutable; this only patches the display name and audit trail.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const renameForCurrentOrgProject = schemaEffectMutation({
  args: renameStageArgsSchema,
  returns: stageSummarySchema,
  handler: renameForCurrentOrgProjectEffect,
});
