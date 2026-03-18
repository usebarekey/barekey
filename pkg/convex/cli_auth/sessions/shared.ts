import { v } from "convex/values";

import { ExternalServiceError } from "../../lib/errors/effect";

export type AccessTokenArgs = {
  accessToken: string;
};

export type RefreshTokenArgs = {
  refreshToken: string;
};

export type AuthenticatedSession = {
  sessionId: string;
  clerkUserId: string;
  orgId: string;
  orgSlug: string;
  accessTokenExpiresAtMs: number;
} | null;

export type RefreshedSession = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAtMs: number;
  refreshTokenExpiresAtMs: number;
  clerkUserId: string;
  orgId: string;
  orgSlug: string;
} | null;

export type RevokedSession = {
  revoked: boolean;
};

export const authenticatedSessionValidator = v.union(
  v.object({
    sessionId: v.string(),
    clerkUserId: v.string(),
    orgId: v.string(),
    orgSlug: v.string(),
    accessTokenExpiresAtMs: v.number(),
  }),
  v.null(),
);

export const refreshedSessionValidator = v.union(
  v.object({
    accessToken: v.string(),
    refreshToken: v.string(),
    accessTokenExpiresAtMs: v.number(),
    refreshTokenExpiresAtMs: v.number(),
    clerkUserId: v.string(),
    orgId: v.string(),
    orgSlug: v.string(),
  }),
  v.null(),
);

export const revokedSessionValidator = v.object({
  revoked: v.boolean(),
});

/**
 * Normalizes CLI session failures into typed external-service errors.
 *
 * @param fallbackMessage The fallback message to use when the failure is not an `Error`.
 * @param error The unknown failure value.
 * @returns A typed external-service error.
 * @remarks Session persistence and token hashing stay on the shared Effect error channel.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function toCliSessionError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}
