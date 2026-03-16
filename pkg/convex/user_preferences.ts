import { v } from "convex/values";

import { mutation, query } from "./confect";
import { requireIdentity } from "./lib/auth";

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

function validateDefaultOrgSlug(defaultOrgSlug: string | null): void {
  if (defaultOrgSlug === null) {
    return;
  }

  if (!ORG_SLUG_PATTERN.test(defaultOrgSlug)) {
    throw new Error("defaultOrgSlug must use lowercase kebab-case and end with digits.");
  }
}

/**
 * Returns the current user's persisted preferences, or safe defaults when no row exists.
 */
export const getCurrentUserPreferences = query({
  args: {},
  returns: v.union(userPreferencesResponseValidator, v.null()),
  handler: async (ctx) => {
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
  },
});

/**
 * Creates or updates the current user's account preferences.
 */
export const upsertCurrentUserPreferences = mutation({
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
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    validateDefaultOrgSlug(args.defaultOrgSlug);

    const now = Date.now();
    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .unique();

    if (existing === null) {
      await ctx.db.insert("userPreferences", {
        clerkUserId: identity.subject,
        preferredTheme: args.preferredTheme,
        defaultOrgSlug: args.defaultOrgSlug,
        landingPreference: args.landingPreference,
        createdAtMs: now,
        updatedAtMs: now,
      });

      return {
        preferredTheme: args.preferredTheme,
        defaultOrgSlug: args.defaultOrgSlug,
        landingPreference: args.landingPreference,
        createdAtMs: now,
        updatedAtMs: now,
      };
    }

    await ctx.db.patch(existing._id, {
      preferredTheme: args.preferredTheme,
      defaultOrgSlug: args.defaultOrgSlug,
      landingPreference: args.landingPreference,
      updatedAtMs: now,
    });

    return {
      preferredTheme: args.preferredTheme,
      defaultOrgSlug: args.defaultOrgSlug,
      landingPreference: args.landingPreference,
      createdAtMs: existing.createdAtMs,
      updatedAtMs: now,
    };
  },
});
