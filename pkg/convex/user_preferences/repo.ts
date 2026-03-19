import { Effect } from "effect";

import type { MutationCtx, QueryCtx } from "../_generated/server";
import { dbInsertEffect, dbPatchEffect, dbUniqueEffect } from "../lib/convex/db";
import { ExternalServiceError } from "../lib/errors/effect";
import {
  LandingPreference,
  type UpsertCurrentUserPreferencesArgs,
  type UserPreferencesResponse,
  UserTheme,
  toUserPreferenceError,
} from "./shared";

/**
 * Loads the persisted user-preference row for one Clerk user.
 *
 * @param ctx The Convex query or mutation context.
 * @param clerkUserId The Clerk user identifier.
 * @returns An Effect that succeeds with the preference row or `null`.
 * @remarks This is the shared repo read used by preference query and mutation flows.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function getUserPreferenceRowEffect(
  ctx: QueryCtx | MutationCtx,
  clerkUserId: string,
): Effect.Effect<any, ExternalServiceError> {
  return dbUniqueEffect(
    ctx,
    "userPreferences",
    (query) =>
      query.withIndex("by_clerk_user_id", (indexQuery) =>
        indexQuery.eq("clerkUserId", clerkUserId),
      ),
    (error) => toUserPreferenceError("Failed to load existing user preferences.", error),
  );
}

/**
 * Maps a persisted preference row into the public response shape.
 *
 * @param preferenceRow The stored preference row, if present.
 * @returns The normalized response shape with safe defaults.
 * @remarks Missing rows default to the initial account preference values.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function toUserPreferencesResponse(
  preferenceRow: any | null,
): UserPreferencesResponse {
  if (preferenceRow === null) {
    return {
      preferredTheme: UserTheme.System,
      defaultOrgSlug: null,
      landingPreference: LandingPreference.AccountOverview,
      createdAtMs: null,
      updatedAtMs: null,
    };
  }

  return {
    preferredTheme: preferenceRow.preferredTheme,
    defaultOrgSlug: preferenceRow.defaultOrgSlug,
    landingPreference: preferenceRow.landingPreference,
    createdAtMs: preferenceRow.createdAtMs,
    updatedAtMs: preferenceRow.updatedAtMs,
  };
}

/**
 * Creates or updates the user-preference row for one Clerk user.
 *
 * @param ctx The Convex mutation context.
 * @param clerkUserId The Clerk user identifier.
 * @param args The desired preference values.
 * @returns An Effect that succeeds with the normalized persisted preference state.
 * @remarks This may insert or patch `userPreferences`.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function upsertUserPreferencesForClerkUserIdEffect(
  ctx: MutationCtx,
  clerkUserId: string,
  args: UpsertCurrentUserPreferencesArgs,
): Effect.Effect<
  Omit<UserPreferencesResponse, "createdAtMs" | "updatedAtMs"> & {
    createdAtMs: number;
    updatedAtMs: number;
  },
  ExternalServiceError
> {
  return Effect.gen(function* () {
    const now = Date.now();
    const existing = yield* getUserPreferenceRowEffect(ctx, clerkUserId);

    if (existing === null) {
      yield* dbInsertEffect(
        ctx,
        "userPreferences",
        {
          clerkUserId,
          preferredTheme: args.preferredTheme,
          defaultOrgSlug: args.defaultOrgSlug,
          landingPreference: args.landingPreference,
          createdAtMs: now,
          updatedAtMs: now,
        },
        (error) => toUserPreferenceError("Failed to insert user preferences.", error),
      );

      return {
        preferredTheme: args.preferredTheme,
        defaultOrgSlug: args.defaultOrgSlug,
        landingPreference: args.landingPreference,
        createdAtMs: now,
        updatedAtMs: now,
      };
    }

    yield* dbPatchEffect(
      ctx,
      existing._id,
      {
        preferredTheme: args.preferredTheme,
        defaultOrgSlug: args.defaultOrgSlug,
        landingPreference: args.landingPreference,
        updatedAtMs: now,
      },
      (error) => toUserPreferenceError("Failed to update user preferences.", error),
    );

    return {
      preferredTheme: args.preferredTheme,
      defaultOrgSlug: args.defaultOrgSlug,
      landingPreference: args.landingPreference,
      createdAtMs: existing.createdAtMs,
      updatedAtMs: now,
    };
  });
}
