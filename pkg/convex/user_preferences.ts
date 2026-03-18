import { Effect } from "effect";
import { v } from "convex/values";

import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  BarekeyConfectMutationCtx,
  BarekeyConfectQueryCtx,
  effectMutation,
  effectQuery,
} from "./confect";
import { requireIdentityEffect } from "./lib/auth";
import { AuthError, ExternalServiceError, ValidationError } from "./lib/errors/effect";

const UserTheme = {
  System: "system",
  Light: "light",
  Dark: "dark",
} as const;

const LandingPreference = {
  AccountOverview: "account_overview",
  DefaultWorkspace: "default_workspace",
} as const;

const preferredThemeValidator = v.union(
  v.literal(UserTheme.System),
  v.literal(UserTheme.Light),
  v.literal(UserTheme.Dark),
);

const landingPreferenceValidator = v.union(
  v.literal(LandingPreference.AccountOverview),
  v.literal(LandingPreference.DefaultWorkspace),
);

const userPreferencesResponseValidator = v.object({
  preferredTheme: preferredThemeValidator,
  defaultOrgSlug: v.union(v.string(), v.null()),
  landingPreference: landingPreferenceValidator,
  createdAtMs: v.union(v.number(), v.null()),
  updatedAtMs: v.union(v.number(), v.null()),
});

const ORG_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9]+$/;

/**
 * Validates the optional default organization slug for persisted user preferences.
 *
 * @param defaultOrgSlug The optional organization slug selected as the user's default workspace.
 * @returns An Effect that succeeds when the slug is valid or null.
 * @remarks This keeps the preference mutation on the typed validation error channel.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function validateDefaultOrgSlugEffect(
  defaultOrgSlug: string | null,
): Effect.Effect<void, ValidationError> {
  if (defaultOrgSlug === null || ORG_SLUG_PATTERN.test(defaultOrgSlug)) {
    return Effect.void;
  }

  return Effect.fail(
    new ValidationError({
      message: "defaultOrgSlug must use lowercase kebab-case and end with digits.",
    }),
  );
}

function toUserPreferenceError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}

function withUserPreferenceQueryCtx<Result>(
  handler: (ctx: QueryCtx) => Promise<Result>,
): Effect.Effect<Result, ExternalServiceError, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectQueryCtx;
    const ctx = confectCtx.ctx as unknown as QueryCtx;
    return yield* Effect.tryPromise({
      try: () => handler(ctx),
      catch: (error) =>
        toUserPreferenceError("Failed to load user preferences.", error),
    });
  });
}

/**
 * Returns the current user's persisted preferences, or safe defaults when no row exists.
 */
export const getCurrentUserPreferences = effectQuery<
  {},
  {
    preferredTheme: "system" | "light" | "dark";
    defaultOrgSlug: string | null;
    landingPreference: "account_overview" | "default_workspace";
    createdAtMs: number | null;
    updatedAtMs: number | null;
  } | null,
  any
>({
  args: {},
  returns: v.union(userPreferencesResponseValidator, v.null()),
  handler: () =>
    withUserPreferenceQueryCtx(async (ctx) => {
      const identity = await ctx.auth.getUserIdentity();
      if (identity === null) {
        return null;
      }

      const preferenceRow = await ctx.db
        .query("userPreferences")
        .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
        .unique();

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
    }),
});

/**
 * Creates or updates the current user's account preferences.
 */
function upsertCurrentUserPreferencesEffect(
  args: {
    preferredTheme: "system" | "light" | "dark";
    defaultOrgSlug: string | null;
    landingPreference: "account_overview" | "default_workspace";
  },
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

    const now = Date.now();
    const existing = yield* Effect.tryPromise({
      try: () =>
        ctx.db
          .query("userPreferences")
          .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
          .unique(),
      catch: (error) =>
        toUserPreferenceError("Failed to load existing user preferences.", error),
    });

    if (existing === null) {
      yield* Effect.tryPromise({
        try: () =>
          ctx.db.insert("userPreferences", {
            clerkUserId: identity.subject,
            preferredTheme: args.preferredTheme,
            defaultOrgSlug: args.defaultOrgSlug,
            landingPreference: args.landingPreference,
            createdAtMs: now,
            updatedAtMs: now,
          }),
        catch: (error) =>
          toUserPreferenceError("Failed to insert user preferences.", error),
      });

      return {
        preferredTheme: args.preferredTheme,
        defaultOrgSlug: args.defaultOrgSlug,
        landingPreference: args.landingPreference,
        createdAtMs: now,
        updatedAtMs: now,
      };
    }

    yield* Effect.tryPromise({
      try: () =>
        ctx.db.patch(existing._id, {
          preferredTheme: args.preferredTheme,
          defaultOrgSlug: args.defaultOrgSlug,
          landingPreference: args.landingPreference,
          updatedAtMs: now,
        }),
      catch: (error) =>
        toUserPreferenceError("Failed to update user preferences.", error),
    });

    return {
      preferredTheme: args.preferredTheme,
      defaultOrgSlug: args.defaultOrgSlug,
      landingPreference: args.landingPreference,
      createdAtMs: existing.createdAtMs,
      updatedAtMs: now,
    };
  });
}

export const upsertCurrentUserPreferences = effectMutation({
  args: {
    preferredTheme: preferredThemeValidator,
    defaultOrgSlug: v.union(v.string(), v.null()),
    landingPreference: landingPreferenceValidator,
  },
  returns: v.object({
    preferredTheme: preferredThemeValidator,
    defaultOrgSlug: v.union(v.string(), v.null()),
    landingPreference: landingPreferenceValidator,
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  }),
  handler: upsertCurrentUserPreferencesEffect,
});
