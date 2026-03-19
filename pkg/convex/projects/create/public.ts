import { Effect } from "effect";

import type { ActionCtx } from "../../_generated/server";
import { BarekeyConfectActionCtx, schemaEffectAction } from "../../confect";
import { runActionEffect, runMutationEffect } from "../../lib/convex/functions";
import {
  assertExpectedOrgSlugEffect,
  requireActiveOrgIdClaimsEffect,
  requireIdentityEffect,
} from "../../lib/auth";
import { AuthError, ExternalServiceError, ValidationError } from "../../lib/errors/effect";
import { assertWorkspacePlanForCurrentOrgInternalReference } from "../../payments/refs";
import { decodeProjectNameEffect } from "../input";
import { projectSummarySchema, type ProjectSummary } from "../types";
import {
  createForCurrentOrgInternalReference,
  createForCurrentOrgArgsSchema,
  type CreateForCurrentOrgArgs,
  toProjectWriteError,
} from "./shared";

/**
 * Creates a project for the current authenticated organization as an Effect program.
 *
 * @param args The expected organization slug and requested project name.
 * @returns An Effect that succeeds with the created project summary.
 * @remarks This validates auth and workspace billing eligibility before delegating persistence to the internal mutation.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
function createForCurrentOrgEffect(
  args: CreateForCurrentOrgArgs,
): Effect.Effect<ProjectSummary, AuthError | ExternalServiceError | ValidationError, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectActionCtx;
    const ctx = confectCtx.ctx as unknown as ActionCtx;
    const identity = yield* requireIdentityEffect(ctx);
    const activeOrg = yield* requireActiveOrgIdClaimsEffect(identity);

    if (activeOrg.orgSlug !== null) {
      yield* assertExpectedOrgSlugEffect(activeOrg, args.expectedOrgSlug);
    }

    const trimmedName = yield* decodeProjectNameEffect(args.name);

    yield* runActionEffect(
      ctx,
      assertWorkspacePlanForCurrentOrgInternalReference,
      {
        expectedOrgSlug: args.expectedOrgSlug,
      },
      (error) => toProjectWriteError("Failed to validate workspace billing.", error),
    );

    return yield* runMutationEffect<ProjectSummary, ReturnType<typeof toProjectWriteError>>(
      ctx,
      createForCurrentOrgInternalReference,
      {
        expectedOrgSlug: args.expectedOrgSlug,
        name: trimmedName,
      },
      (error) => toProjectWriteError("Failed to create project.", error),
    );
  });
}

/**
 * Creates a project for the current authenticated organization.
 *
 * @param args The expected org slug and requested project name.
 * @returns The created project summary.
 * @remarks This public action delegates to the Effect-native create program.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const createForCurrentOrg = schemaEffectAction({
  args: createForCurrentOrgArgsSchema,
  returns: projectSummarySchema,
  handler: createForCurrentOrgEffect,
});
