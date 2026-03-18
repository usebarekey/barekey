import { Effect } from "effect";
import { v } from "convex/values";
import type { MutationCtx } from "../../_generated/server";
import {
  BarekeyConfectMutationCtx,
  effectInternalMutation,
} from "../../confect";
import { ExternalServiceError } from "../../lib/errors/effect";
import { sha256Base64Url } from "../token_helpers";
import {
  revokedSessionValidator,
  type RefreshTokenArgs,
  type RevokedSession,
  toCliSessionError,
} from "./shared";

/**
 * Revokes a CLI session by refresh token.
 *
 * @param ctx The Convex mutation context.
 * @param args The raw refresh token.
 * @returns An Effect that succeeds with whether the session is revoked after the operation.
 * @remarks This treats repeated revocation as success.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
function revokeSessionInternalEffect(
  ctx: MutationCtx,
  args: RefreshTokenArgs,
): Effect.Effect<RevokedSession, ExternalServiceError> {
  return Effect.gen(function* () {
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
        toCliSessionError("Failed to load the CLI session for revocation.", error),
    });

    if (session === null) {
      return { revoked: false };
    }

    if (session.revokedAtMs !== null) {
      return { revoked: true };
    }

    const now = Date.now();
    yield* Effect.tryPromise({
      try: () =>
        ctx.db.patch(session._id, {
          revokedAtMs: now,
          updatedAtMs: now,
        }),
      catch: (error) =>
        toCliSessionError("Failed to revoke the CLI session.", error),
    });

    return { revoked: true };
  });
}

/**
 * Revokes a CLI session using its refresh token.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The raw refresh token.
 * @returns Whether the session is revoked after the operation.
 * @remarks This patches `revokedAtMs` for matching sessions and treats repeated revocation as success.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const revokeSessionInternal = effectInternalMutation<
  RefreshTokenArgs,
  RevokedSession,
  any
>({
  args: {
    refreshToken: v.string(),
  },
  returns: revokedSessionValidator,
  handler: (args) =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectMutationCtx;
      const ctx = confectCtx.ctx as unknown as MutationCtx;
      return yield* revokeSessionInternalEffect(ctx, args);
    }),
});
