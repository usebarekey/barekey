import { Either, Effect, Schema } from "effect";
import { v } from "convex/values";

import { ExternalServiceError, ValidationError } from "../lib/errors/effect";

export const UserTheme = {
  System: "system",
  Light: "light",
  Dark: "dark",
} as const;

export const LandingPreference = {
  AccountOverview: "account_overview",
  DefaultWorkspace: "default_workspace",
} as const;

export const preferredThemeValidator = v.union(
  v.literal(UserTheme.System),
  v.literal(UserTheme.Light),
  v.literal(UserTheme.Dark),
);

export const landingPreferenceValidator = v.union(
  v.literal(LandingPreference.AccountOverview),
  v.literal(LandingPreference.DefaultWorkspace),
);

export const preferredThemeSchema = Schema.Literal(
  UserTheme.System,
  UserTheme.Light,
  UserTheme.Dark,
);

export const landingPreferenceSchema = Schema.Literal(
  LandingPreference.AccountOverview,
  LandingPreference.DefaultWorkspace,
);

export const userPreferencesResponseValidator = v.object({
  preferredTheme: preferredThemeValidator,
  defaultOrgSlug: v.union(v.string(), v.null()),
  landingPreference: landingPreferenceValidator,
  createdAtMs: v.union(v.number(), v.null()),
  updatedAtMs: v.union(v.number(), v.null()),
});

export const userPreferencesResponseSchema = Schema.Struct({
  preferredTheme: preferredThemeSchema,
  defaultOrgSlug: Schema.NullOr(Schema.String),
  landingPreference: landingPreferenceSchema,
  createdAtMs: Schema.NullOr(Schema.Number),
  updatedAtMs: Schema.NullOr(Schema.Number),
});

export type UserPreferencesResponse = {
  preferredTheme: "system" | "light" | "dark";
  defaultOrgSlug: string | null;
  landingPreference: "account_overview" | "default_workspace";
  createdAtMs: number | null;
  updatedAtMs: number | null;
};

export type UpsertCurrentUserPreferencesArgs = {
  preferredTheme: "system" | "light" | "dark";
  defaultOrgSlug: string | null;
  landingPreference: "account_overview" | "default_workspace";
};

export const upsertCurrentUserPreferencesArgsSchema = Schema.Struct({
  preferredTheme: preferredThemeSchema,
  defaultOrgSlug: Schema.NullOr(Schema.String),
  landingPreference: landingPreferenceSchema,
});

const ORG_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9]+$/;
const defaultOrgSlugSchema = Schema.NullOr(
  Schema.String.pipe(
    Schema.pattern(ORG_SLUG_PATTERN),
  ),
);
const errorWithMessageSchema = Schema.instanceOf(Error).pipe(
  Schema.filter((error) => error.message.length > 0),
);

/**
 * Validates the optional default organization slug for persisted user preferences.
 *
 * @param defaultOrgSlug The optional organization slug selected as the user's default workspace.
 * @returns An Effect that succeeds when the slug is valid or null.
 * @remarks This keeps the preference mutation on the typed validation error channel.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function validateDefaultOrgSlugEffect(
  defaultOrgSlug: string | null,
): Effect.Effect<void, ValidationError> {
  const decoded = Schema.decodeUnknownEither(defaultOrgSlugSchema)(defaultOrgSlug);
  if (Either.isRight(decoded)) {
    return Effect.void;
  }

  return Effect.fail(
    new ValidationError({
      message: "defaultOrgSlug must use lowercase kebab-case and end with digits.",
    }),
  );
}

/**
 * Normalizes user-preference persistence failures into typed service errors.
 *
 * @param fallbackMessage The fallback message to use when the failure is not an `Error`.
 * @param error The unknown failure value.
 * @returns A typed external-service error.
 * @remarks This keeps user-preference reads and writes on the shared Effect error channel.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function toUserPreferenceError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  const decodedError = Schema.decodeUnknownEither(errorWithMessageSchema)(error);
  return new ExternalServiceError({
    message: Either.isRight(decodedError) ? decodedError.right.message : fallbackMessage,
    cause: error,
  });
}
