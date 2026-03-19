import { Effect } from "effect";
import { v } from "convex/values";

import type { QueryCtx } from "../_generated/server";
import { BarekeyConfectQueryCtx, effectQuery } from "../confect";
import {
  getUserPreferenceRowEffect,
  toUserPreferencesResponse,
} from "./repo";
import {
  type UserPreferencesResponse,
  userPreferencesResponseValidator,
  toUserPreferenceError,
} from "./shared";

/**
 * Returns the current user's persisted preferences, or safe defaults when no row exists.
 *
 * @param ctx The Convex query context.
 * @returns The current user's preferences, or `null` when the request is unauthenticated.
 * @remarks This is a read-only boundary over the user-preference repo helper.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const getCurrentUserPreferences = effectQuery<
  {},
  UserPreferencesResponse | null,
  any
>({
  args: {},
  returns: v.union(userPreferencesResponseValidator, v.null()),
  handler: () =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectQueryCtx;
      const ctx = confectCtx.ctx as unknown as QueryCtx;
      const identity = yield* Effect.tryPromise({
        try: () => ctx.auth.getUserIdentity(),
        catch: (error) =>
          toUserPreferenceError("Failed to load user preferences.", error),
      });
      if (identity === null) {
        return null;
      }

      const preferenceRow = yield* getUserPreferenceRowEffect(ctx, identity.subject);
      return toUserPreferencesResponse(preferenceRow);
    }),
});
