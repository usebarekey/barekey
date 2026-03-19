import { Effect } from "effect";

import type { MutationCtx } from "../_generated/server";
import { BarekeyConfectMutationCtx, schemaEffectMutation } from "../confect";
import { requireIdentityEffect } from "../lib/auth";
import { AuthError, ExternalServiceError, ValidationError } from "../lib/errors/effect";
import { upsertUserPreferencesForClerkUserIdEffect } from "./repo";
import {
  type UpsertCurrentUserPreferencesArgs,
  upsertCurrentUserPreferencesArgsSchema,
  userPreferencesResponseSchema,
  validateDefaultOrgSlugEffect,
} from "./shared";

/**
 * Creates or updates the current user's account preferences.
 *
 * @param args The desired user-preference values.
 * @returns The normalized persisted preference state.
 * @remarks This validates the default org slug and delegates persistence to the repo helper.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
function upsertCurrentUserPreferencesEffect(
  args: UpsertCurrentUserPreferencesArgs,
): Effect.Effect<
  {
    preferredTheme: "system" | "light" | "dark";
    defaultOrgSlug: string | null;
    landingPreference: "account_overview" | "default_workspace";
    createdAtMs: number;
    updatedAtMs: number;
  },
  AuthError | ExternalServiceError | ValidationError,
  any
> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectMutationCtx;
    const ctx = confectCtx.ctx as unknown as MutationCtx;
    const identity = yield* requireIdentityEffect(ctx);
    yield* validateDefaultOrgSlugEffect(args.defaultOrgSlug);
    return yield* upsertUserPreferencesForClerkUserIdEffect(ctx, identity.subject, args);
  });
}

/**
 * Mutation boundary for current-user preference writes.
 *
 * @param ctx The Convex mutation context.
 * @param args The desired preference values.
 * @returns The normalized persisted preference state.
 * @remarks This is a thin Effect boundary over the user-preference program.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const upsertCurrentUserPreferences = schemaEffectMutation({
  args: upsertCurrentUserPreferencesArgsSchema,
  returns: userPreferencesResponseSchema,
  handler: upsertCurrentUserPreferencesEffect,
});
