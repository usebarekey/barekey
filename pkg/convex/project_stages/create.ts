import { Effect } from "effect";
import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { BarekeyConfectMutationCtx, effectMutation } from "../confect";
import {
  assertExpectedOrgSlugEffect,
  requireActiveOrgIdClaimsEffect,
  requireIdentityEffect,
} from "../lib/auth";
import { appendAuditEventEffect } from "../lib/confect/audit";
import { AuthError, ExternalServiceError, NotFoundError, ValidationError } from "../lib/effect_errors";
import { findProjectByOrgIdAndSlugEffect } from "../lib/project_scope";
import { allocateUniqueStageSlug, normalizeStageSlugBase } from "./slug";
import { stageSummaryValidator } from "./types";

/**
 * Normalizes unknown stage-write failures into the shared external-service error model.
 *
 * @param fallbackMessage The message to use when the failure has no useful `Error` message.
 * @param error The unknown thrown failure value.
 * @returns A typed external-service error.
 * @remarks This keeps stage create workflows from leaking raw thrown values into Effect programs.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function toStageWriteError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}

/**
 * Validates and trims a stage name.
 *
 * @param name The untrusted stage name supplied by the caller.
 * @returns An Effect that succeeds with the trimmed stage name.
 * @remarks This is pure validation logic and does not read or write Convex state.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function validateStageNameEffect(name: string): Effect.Effect<string, ValidationError> {
  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    return Effect.fail(new ValidationError({ message: "Stage name is required." }));
  }

  if (trimmedName.length > 64) {
    return Effect.fail(
      new ValidationError({
        message: "Stage name must be 64 characters or fewer.",
      }),
    );
  }

  return Effect.succeed(trimmedName);
}

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

    const trimmedName = yield* validateStageNameEffect(args.name);
    const slug = yield* Effect.tryPromise({
      try: () =>
        allocateUniqueStageSlug(ctx, {
          projectId: project._id,
          slugBase: normalizeStageSlugBase(trimmedName),
        }),
      catch: (error) => toStageWriteError("Failed to allocate a stage slug.", error),
    });
    const now = Date.now();

    const stageId = yield* Effect.tryPromise({
      try: () =>
        ctx.db.insert("projectStages", {
          projectId: project._id,
          orgId: activeOrg.orgId,
          slug,
          name: trimmedName,
          isDefault: false,
          createdAtMs: now,
          updatedAtMs: now,
        }),
      catch: (error) => toStageWriteError("Failed to insert the project stage row.", error),
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
export const createForCurrentOrgProject = effectMutation({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
    name: v.string(),
  },
  returns: stageSummaryValidator,
  handler: createForCurrentOrgProjectEffect,
});
