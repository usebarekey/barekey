import { Effect } from "effect";
import { v } from "convex/values";
import type { MutationCtx } from "../../_generated/server";
import {
  BarekeyConfectMutationCtx,
  effectInternalMutation,
} from "../../confect";
import { ExternalServiceError } from "../../lib/errors/effect";
import {
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
  TOKEN_BYTES,
  randomToken,
  sha256Base64Url,
} from "../token_helpers";
import {
  refreshedSessionValidator,
  type RefreshedSession,
  type RefreshTokenArgs,
  toCliSessionError,
} from "./shared";

/**
 * Rotates a CLI session using a refresh token.
 *
 * @param ctx The Convex mutation context.
 * @param args The raw refresh token.
 * @returns An Effect that succeeds with the next token pair and session context when valid, or `null`.
 * @remarks This patches `cliSessions` with new token hashes and expiry timestamps.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
function refreshSessionInternalEffect(
  ctx: MutationCtx,
  args: RefreshTokenArgs,
): Effect.Effect<RefreshedSession, ExternalServiceError> {
  return Effect.gen(function* () {
    const now = Date.now();
    const refreshTokenHash = yield* Effect.tryPromise({
      try: () => sha256Base64Url(args.refreshToken),
      catch: (error) =>
        toCliSessionError("Failed to hash the CLI refresh token.", error),
    });
    const session = yield* Effect.tryPromise({
      try: () =>
        ctx.db
          .query("cliSessions")
          .withIndex("by_refresh_token_hash", (q) => q.eq("refreshTokenHash", refreshTokenHash))
          .unique(),
      catch: (error) =>
        toCliSessionError("Failed to load the CLI session for the refresh token.", error),
    });

    if (
      session === null ||
      session.revokedAtMs !== null ||
      session.refreshTokenExpiresAtMs <= now
    ) {
      return null;
    }

    const accessToken = randomToken("bk_at_", TOKEN_BYTES);
    const refreshToken = randomToken("bk_rt_", TOKEN_BYTES);
    const accessTokenHash = yield* Effect.tryPromise({
      try: () => sha256Base64Url(accessToken),
      catch: (error) =>
        toCliSessionError("Failed to hash the rotated CLI access token.", error),
    });
    const nextRefreshTokenHash = yield* Effect.tryPromise({
      try: () => sha256Base64Url(refreshToken),
      catch: (error) =>
        toCliSessionError("Failed to hash the rotated CLI refresh token.", error),
    });
    const accessTokenExpiresAtMs = now + ACCESS_TOKEN_TTL_MS;
    const refreshTokenExpiresAtMs = now + REFRESH_TOKEN_TTL_MS;

    yield* Effect.tryPromise({
      try: () =>
        ctx.db.patch(session._id, {
          accessTokenHash,
          refreshTokenHash: nextRefreshTokenHash,
          accessTokenExpiresAtMs,
          refreshTokenExpiresAtMs,
          lastUsedAtMs: now,
          updatedAtMs: now,
        }),
      catch: (error) =>
        toCliSessionError("Failed to rotate the CLI session tokens.", error),
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
  });
}

/**
 * Rotates a CLI session using a refresh token.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The raw refresh token.
 * @returns The next token pair and session context when valid, or `null`.
 * @remarks This patches `cliSessions` with a new access token hash, refresh token hash, and expiry timestamps.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const refreshSessionInternal = effectInternalMutation<
  RefreshTokenArgs,
  RefreshedSession,
  any
>({
  args: {
    refreshToken: v.string(),
  },
  returns: refreshedSessionValidator,
  handler: (args) =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectMutationCtx;
      const ctx = confectCtx.ctx as unknown as MutationCtx;
      return yield* refreshSessionInternalEffect(ctx, args);
    }),
});
