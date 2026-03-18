import { Effect } from "effect";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";

import type { ActionCtx, MutationCtx } from "../_generated/server";
import {
  BarekeyConfectActionCtx,
  BarekeyConfectMutationCtx,
  effectAction,
  effectInternalMutation,
} from "../confect";
import {
  assertExpectedOrgSlugEffect,
  requireActiveOrgIdClaimsEffect,
  requireIdentityEffect,
} from "../lib/auth";
import { appendAuditEventEffect } from "../lib/confect/audit";
import { AuthError, ExternalServiceError, ValidationError } from "../lib/errors/effect";
import { assertWorkspacePlanForCurrentOrgInternalReference } from "../payments/refs";
import { allocateUniqueProjectSlugEffect, normalizeProjectSlugBase } from "./slug";
import { DEFAULT_PROJECT_STAGES, projectSummaryValidator, type ProjectSummary } from "./types";

const createForCurrentOrgInternalReference = makeFunctionReference<
  "mutation",
  {
    expectedOrgSlug: string;
    name: string;
  },
  ProjectSummary
>("projects:createForCurrentOrgInternal") as any;

/**
 * Normalizes unknown project-write failures into the shared external-service error model.
 *
 * @param fallbackMessage The message to use when the failure has no useful `Error` message.
 * @param error The unknown thrown failure value.
 * @returns A typed external-service error.
 * @remarks This keeps project create workflows from leaking raw thrown values into Effect programs.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function toProjectWriteError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}

/**
 * Validates and trims a project name.
 *
 * @param name The untrusted project name supplied by the caller.
 * @returns An Effect that succeeds with the trimmed project name.
 * @remarks This is pure validation logic and does not read or write Convex state.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function validateProjectNameEffect(
  name: string,
): Effect.Effect<string, ValidationError> {
  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    return Effect.fail(new ValidationError({ message: "Project name is required." }));
  }

  if (trimmedName.length > 120) {
    return Effect.fail(
      new ValidationError({
        message: "Project name must be 120 characters or fewer.",
      }),
    );
  }

  return Effect.succeed(trimmedName);
}

/**
 * Creates a project for the current authenticated organization as an Effect program.
 *
 * @param args The expected organization slug and requested project name.
 * @returns An Effect that succeeds with the created project summary.
 * @remarks This validates auth and workspace billing eligibility before delegating persistence to the internal mutation.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function createForCurrentOrgEffect(
  args: {
    expectedOrgSlug: string;
    name: string;
  },
): Effect.Effect<ProjectSummary, AuthError | ExternalServiceError | ValidationError, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectActionCtx;
    const ctx = confectCtx.ctx as unknown as ActionCtx;
    const identity = yield* requireIdentityEffect(ctx);
    const activeOrg = yield* requireActiveOrgIdClaimsEffect(identity);

    if (activeOrg.orgSlug !== null) {
      yield* assertExpectedOrgSlugEffect(activeOrg, args.expectedOrgSlug);
    }

    const trimmedName = yield* validateProjectNameEffect(args.name);

    yield* Effect.tryPromise({
      try: () =>
        ctx.runAction(assertWorkspacePlanForCurrentOrgInternalReference, {
          expectedOrgSlug: args.expectedOrgSlug,
        }),
      catch: (error) => toProjectWriteError("Failed to validate workspace billing.", error),
    });

    return yield* Effect.tryPromise({
      try: () =>
        ctx.runMutation(createForCurrentOrgInternalReference, {
          expectedOrgSlug: args.expectedOrgSlug,
          name: trimmedName,
        }) as Promise<ProjectSummary>,
      catch: (error) => toProjectWriteError("Failed to create project.", error),
    });
  });
}

/**
 * Creates a project row and its default stages for the current authenticated organization as an Effect program.
 *
 * @param args The expected organization slug and requested project name.
 * @returns An Effect that succeeds with the created project summary.
 * @remarks This writes `projects`, seeds default `projectStages`, and appends a project audit event.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function createForCurrentOrgInternalEffect(
  args: {
    expectedOrgSlug: string;
    name: string;
  },
): Effect.Effect<ProjectSummary, AuthError | ExternalServiceError | ValidationError, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectMutationCtx;
    const ctx = confectCtx.ctx as unknown as MutationCtx;
    const identity = yield* requireIdentityEffect(ctx);
    const activeOrg = yield* requireActiveOrgIdClaimsEffect(identity);

    if (activeOrg.orgSlug !== null) {
      yield* assertExpectedOrgSlugEffect(activeOrg, args.expectedOrgSlug);
    }

    const trimmedName = yield* validateProjectNameEffect(args.name);
    const slugBase = normalizeProjectSlugBase(trimmedName);
    const slug = yield* allocateUniqueProjectSlugEffect(ctx, {
      orgId: activeOrg.orgId,
      slugBase,
    });
    const now = Date.now();

    const id = yield* Effect.tryPromise({
      try: () =>
        ctx.db.insert("projects", {
          orgId: activeOrg.orgId,
          orgSlug: args.expectedOrgSlug,
          name: trimmedName,
          slug,
          slugBase,
          createdByClerkUserId: activeOrg.clerkUserId,
          createdAtMs: now,
          updatedAtMs: now,
        }),
      catch: (error) => toProjectWriteError("Failed to insert the project row.", error),
    });

    yield* Effect.forEach(
      DEFAULT_PROJECT_STAGES,
      (stage) =>
        Effect.tryPromise({
          try: () =>
            ctx.db.insert("projectStages", {
              projectId: id,
              orgId: activeOrg.orgId,
              slug: stage.slug,
              name: stage.name,
              isDefault: true,
              createdAtMs: now,
              updatedAtMs: now,
            }),
          catch: (error) =>
            toProjectWriteError(
              `Failed to insert the default ${stage.slug} stage.`,
              error,
            ),
        }),
      { discard: true },
    );

    yield* appendAuditEventEffect({
      orgId: activeOrg.orgId,
      orgSlug: args.expectedOrgSlug,
      projectId: id,
      projectSlug: slug,
      stageSlug: null,
      eventType: "project.created",
      category: "project",
      actorSource: "barekey_user",
      actorClerkUserId: activeOrg.clerkUserId,
      actorDisplayName: null,
      actorEmail: null,
      subjectType: "project",
      subjectId: String(id),
      subjectName: trimmedName,
      title: `Created project ${trimmedName}`,
      description: `Project ${trimmedName} is ready with development and production stages.`,
      severity: "info",
      payloadJson: JSON.stringify({
        projectSlug: slug,
        defaultStages: DEFAULT_PROJECT_STAGES.map((stage) => stage.slug),
      }),
      retentionTierOverride: null,
    });

    return {
      id,
      orgId: activeOrg.orgId,
      orgSlug: args.expectedOrgSlug,
      name: trimmedName,
      slug,
      slugBase,
      createdByClerkUserId: activeOrg.clerkUserId,
      createdAtMs: now,
      updatedAtMs: now,
    };
  });
}

/**
 * Creates a project for the current authenticated organization.
 *
 * @param args The expected org slug and requested project name.
 * @returns The created project summary.
 * @remarks This public action delegates to the Effect-native create program.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const createForCurrentOrg = effectAction({
  args: {
    expectedOrgSlug: v.string(),
    name: v.string(),
  },
  returns: projectSummaryValidator,
  handler: createForCurrentOrgEffect,
});

/**
 * Creates a project row and its default stages for the current authenticated organization.
 *
 * @param args The expected org slug and requested project name.
 * @returns The created project summary.
 * @remarks This internal mutation delegates to the Effect-native create program.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const createForCurrentOrgInternal = effectInternalMutation({
  args: {
    expectedOrgSlug: v.string(),
    name: v.string(),
  },
  returns: projectSummaryValidator,
  handler: createForCurrentOrgInternalEffect,
});
