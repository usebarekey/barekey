import { v } from "convex/values";

import { internalMutation } from "../confect";
import {
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
  TOKEN_BYTES,
  randomToken,
  sha256Base64Url,
} from "./token_helpers";

/**
 * Authenticates a CLI access token against an active session.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The raw access token.
 * @returns The session context when valid, or `null`.
 * @remarks This updates `lastUsedAtMs` for valid sessions.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const authenticateAccessTokenInternal = internalMutation({
  args: {
    accessToken: v.string(),
  },
  returns: v.union(
    v.object({
      sessionId: v.string(),
      clerkUserId: v.string(),
      orgId: v.string(),
      orgSlug: v.string(),
      accessTokenExpiresAtMs: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const now = Date.now();
    const accessTokenHash = await sha256Base64Url(args.accessToken);
    const session = await ctx.db
      .query("cliSessions")
      .withIndex("by_access_token_hash", (q) => q.eq("accessTokenHash", accessTokenHash))
      .unique();

    if (session === null || session.revokedAtMs !== null || session.accessTokenExpiresAtMs <= now) {
      return null;
    }

    await ctx.db.patch(session._id, {
      lastUsedAtMs: now,
      updatedAtMs: now,
    });

    return {
      sessionId: session.sessionId,
      clerkUserId: session.clerkUserId,
      orgId: session.orgId,
      orgSlug: session.orgSlug,
      accessTokenExpiresAtMs: session.accessTokenExpiresAtMs,
    };
  },
});

/**
 * Rotates a CLI session using a refresh token.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The raw refresh token.
 * @returns The next token pair and session context when valid, or `null`.
 * @remarks This patches `cliSessions` with a new access token hash, refresh token hash, and expiry timestamps.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const refreshSessionInternal = internalMutation({
  args: {
    refreshToken: v.string(),
  },
  returns: v.union(
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
  ),
  handler: async (ctx, args) => {
    const now = Date.now();
    const refreshTokenHash = await sha256Base64Url(args.refreshToken);
    const session = await ctx.db
      .query("cliSessions")
      .withIndex("by_refresh_token_hash", (q) => q.eq("refreshTokenHash", refreshTokenHash))
      .unique();

    if (
      session === null ||
      session.revokedAtMs !== null ||
      session.refreshTokenExpiresAtMs <= now
    ) {
      return null;
    }

    const accessToken = randomToken("bk_at_", TOKEN_BYTES);
    const refreshToken = randomToken("bk_rt_", TOKEN_BYTES);
    const accessTokenHash = await sha256Base64Url(accessToken);
    const nextRefreshTokenHash = await sha256Base64Url(refreshToken);
    const accessTokenExpiresAtMs = now + ACCESS_TOKEN_TTL_MS;
    const refreshTokenExpiresAtMs = now + REFRESH_TOKEN_TTL_MS;

    await ctx.db.patch(session._id, {
      accessTokenHash,
      refreshTokenHash: nextRefreshTokenHash,
      accessTokenExpiresAtMs,
      refreshTokenExpiresAtMs,
      lastUsedAtMs: now,
      updatedAtMs: now,
    });

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAtMs,
      refreshTokenExpiresAtMs,
      clerkUserId: session.clerkUserId,
      orgId: session.orgId,
      orgSlug: session.orgSlug,
    };
  },
});

/**
 * Revokes a CLI session using its refresh token.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The raw refresh token.
 * @returns Whether the session is revoked after the operation.
 * @remarks This patches `revokedAtMs` for matching sessions and treats repeated revocation as success.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const revokeSessionInternal = internalMutation({
  args: {
    refreshToken: v.string(),
  },
  returns: v.object({
    revoked: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const refreshTokenHash = await sha256Base64Url(args.refreshToken);
    const session = await ctx.db
      .query("cliSessions")
      .withIndex("by_refresh_token_hash", (q) => q.eq("refreshTokenHash", refreshTokenHash))
      .unique();

    if (session === null) {
      return { revoked: false };
    }

    if (session.revokedAtMs !== null) {
      return { revoked: true };
    }

    await ctx.db.patch(session._id, {
      revokedAtMs: Date.now(),
      updatedAtMs: Date.now(),
    });

    return { revoked: true };
  },
});
