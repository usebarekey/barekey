import { Effect } from "effect";

import type { MutationCtx } from "../../_generated/server";
import {
  BarekeyConfectMutationCtx,
  schemaEffectInternalMutation,
} from "../../confect";
import {
  assertExpectedOrgSlugEffect,
  requireActiveOrgIdClaimsEffect,
  requireIdentityEffect,
} from "../../lib/auth";
import { AuthError, ExternalServiceError, ValidationError } from "../../lib/errors/effect";
import { decodeProjectNameEffect } from "../input";
import { allocateUniqueProjectSlugEffect, normalizeProjectSlugBase } from "../slug";
import { projectSummarySchema, type ProjectSummary } from "../types";
import { appendProjectCreatedAuditEventEffect } from "./audit";
import { persistCreatedProjectEffect } from "./persist";
import { createForCurrentOrgArgsSchema, type CreateForCurrentOrgArgs } from "./shared";

/**
 * Creates a project row and its default stages for the current authenticated organization as an Effect program.
 *
 * @param args The expected organization slug and requested project name.
 * @returns An Effect that succeeds with the created project summary.
 * @remarks This writes `projects`, seeds default `projectStages`, and appends a project audit event.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
function createForCurrentOrgInternalEffect(
  args: CreateForCurrentOrgArgs,
): Effect.Effect<ProjectSummary, AuthError | ExternalServiceError | ValidationError, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectMutationCtx;
    const ctx = confectCtx.ctx as unknown as MutationCtx;
    const identity = yield* requireIdentityEffect(ctx);
    const activeOrg = yield* requireActiveOrgIdClaimsEffect(identity);

    if (activeOrg.orgSlug !== null) {
      yield* assertExpectedOrgSlugEffect(activeOrg, args.expectedOrgSlug);
    }

    const trimmedName = yield* decodeProjectNameEffect(args.name);
    const slugBase = normalizeProjectSlugBase(trimmedName);
    const slug = yield* allocateUniqueProjectSlugEffect(ctx, {
      orgId: activeOrg.orgId,
      slugBase,
    });
    const now = Date.now();

    const project = yield* persistCreatedProjectEffect(ctx, {
      orgId: activeOrg.orgId,
      orgSlug: args.expectedOrgSlug,
      name: trimmedName,
      slug,
      slugBase,
      createdByClerkUserId: activeOrg.clerkUserId,
      createdAtMs: now,
      updatedAtMs: now,
    });

    yield* appendProjectCreatedAuditEventEffect({
      project,
      actorClerkUserId: activeOrg.clerkUserId,
    });

    return project;
  });
}

/**
 * Creates a project row and its default stages for the current authenticated organization.
 *
 * @param args The expected org slug and requested project name.
 * @returns The created project summary.
 * @remarks This internal mutation delegates to the Effect-native create program.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const createForCurrentOrgInternal = schemaEffectInternalMutation({
  args: createForCurrentOrgArgsSchema,
  returns: projectSummarySchema,
  handler: createForCurrentOrgInternalEffect,
});
