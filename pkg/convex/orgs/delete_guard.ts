import { Effect, Schema } from "effect";

import type { ActionCtx } from "../_generated/server";
import { BarekeyConfectActionCtx, schemaEffectAction } from "../confect";
import {
  assertExpectedOrgSlugEffect,
  requireActiveOrgIdClaimsEffect,
  requireIdentityEffect,
} from "../lib/auth";
import { AuthError, ExternalServiceError, ValidationError } from "../lib/errors/effect";
import {
  listProjectsForCurrentOrgDeletionCheckInternalReference,
  toOrgDeletionError,
} from "./shared";

const deleteGuardArgsSchema = Schema.Struct({
  expectedOrgSlug: Schema.String,
});

const deleteGuardResultSchema = Schema.Struct({
  orgId: Schema.String,
  projectCount: Schema.Number,
});

/**
 * Asserts that the current organization can be deleted.
 *
 * @param args The expected organization slug.
 * @returns The active organization id and current project count.
 * @remarks This validates role and ensures there are no remaining projects via the internal org query.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
function assertCanDeleteCurrentOrgEffect(
  args: {
    expectedOrgSlug: string;
  },
): Effect.Effect<
  {
    orgId: string;
    projectCount: number;
  },
  AuthError | ExternalServiceError | ValidationError,
  any
> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectActionCtx;
    const runtimeCtx = confectCtx.ctx as unknown as ActionCtx;
    const identity = yield* requireIdentityEffect(runtimeCtx);
    const activeOrg = yield* requireActiveOrgIdClaimsEffect(identity);
    if (activeOrg.orgSlug !== null) {
      yield* assertExpectedOrgSlugEffect(activeOrg, args.expectedOrgSlug);
    }

    if (activeOrg.orgRole !== "org:admin" && activeOrg.orgRole !== "org:owner") {
      return yield* Effect.fail(
        new ValidationError({
          message: "Only organization admins can delete organizations.",
        }),
      );
    }

    const projects = yield* Effect.tryPromise({
      try: () =>
        runtimeCtx.runQuery(listProjectsForCurrentOrgDeletionCheckInternalReference, {
          expectedOrgSlug: args.expectedOrgSlug,
        }) as Promise<Array<{ id: string }>>,
      catch: (error) =>
        toOrgDeletionError("Failed to load organization projects for deletion readiness.", error),
    });
    const projectCount = projects.length;
    if (projectCount > 0) {
      return yield* Effect.fail(
        new ValidationError({
          message: `Delete blocked. Remove all projects first (${projectCount} project${projectCount === 1 ? "" : "s"} remaining).`,
        }),
      );
    }

    return {
      orgId: activeOrg.orgId,
      projectCount,
    };
  });
}

/**
 * Public action guard for current-organization deletion.
 *
 * @param runtimeCtx The Convex action context.
 * @param args The expected organization slug.
 * @returns The active organization id and current project count.
 * @remarks This is a thin Effect boundary over the delete-guard program.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const assertCanDeleteCurrentOrg = schemaEffectAction({
  args: deleteGuardArgsSchema,
  returns: deleteGuardResultSchema,
  handler: assertCanDeleteCurrentOrgEffect,
});
