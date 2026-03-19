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
  authenticatedSessionValidator,
  type AccessTokenArgs,
  type AuthenticatedSession,
  toCliSessionError,
} from "./shared";

/**
 * Authenticates a raw CLI access token against an active session.
 *
 * @param runtimeCtx The Convex mutation context.
 * @param args The raw access token.
 * @returns An Effect that succeeds with the session context when valid, or `null`.
 * @remarks This updates `lastUsedAtMs` for valid sessions.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
function authenticateAccessTokenInternalEffect(
  runtimeCtx: MutationCtx,
  args: AccessTokenArgs,
): Effect.Effect<AuthenticatedSession, ExternalServiceError> {
  return Effect.gen(function* () {
    const now = Date.now();
    const accessTokenHash = yield* Effect.tryPromise({
      try: () => sha256Base64Url(args.accessToken),
      catch: (error) =>
        toCliSessionError("Failed to hash the CLI access token.", error),
    });
    const session = yield* Effect.tryPromise({
      try: () =>
        runtimeCtx.db
          .query("cliSessions")
          .withIndex("by_access_token_hash", (q) => q.eq("accessTokenHash", accessTokenHash))
          .unique(),
      catch: (error) =>
        toCliSessionError("Failed to load the CLI session for the access token.", error),
    });

    if (session === null || session.revokedAtMs !== null || session.accessTokenExpiresAtMs <= now) {
      return null;
    }

    yield* Effect.tryPromise({
      try: () =>
        runtimeCtx.db.patch(session._id, {
          lastUsedAtMs: now,
          updatedAtMs: now,
        }),
      catch: (error) =>
        toCliSessionError("Failed to update the CLI session last-used timestamp.", error),
    });

    return {
      sessionId: session.sessionId,
      clerkUserId: session.clerkUserId,
      orgId: session.orgId,
      orgSlug: session.orgSlug,
      accessTokenExpiresAtMs: session.accessTokenExpiresAtMs,
    };
  });
}

/**
 * Authenticates a CLI access token against an active session.
 *
 * @param runtimeCtx The Convex internal mutation context.
 * @param args The raw access token.
 * @returns The session context when valid, or `null`.
 * @remarks This updates `lastUsedAtMs` for valid sessions.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export const authenticateAccessTokenInternal = effectInternalMutation<
  AccessTokenArgs,
  AuthenticatedSession,
  any
>({
  args: {
    accessToken: v.string(),
  },
  returns: authenticatedSessionValidator,
  handler: (args) =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectMutationCtx;
      const runtimeCtx = confectCtx.ctx as unknown as MutationCtx;
      return yield* authenticateAccessTokenInternalEffect(runtimeCtx, args);
    }),
});
