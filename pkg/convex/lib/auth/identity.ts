import type { UserIdentity } from "convex/server";
import { Effect } from "effect";

import { AuthError } from "../errors/effect";
import { toAuthError, toThrownAuthError } from "./shared";
import type { AuthLikeCtx } from "./types";

/**
 * Resolves the authenticated Clerk identity as an Effect program.
 *
 * @param ctx The Convex-like auth context that can resolve the current identity.
 * @returns An Effect that succeeds with the authenticated identity or fails with `AuthError`.
 * @remarks This is the Effect-native entrypoint future handlers should depend on.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function requireIdentityEffect(ctx: AuthLikeCtx): Effect.Effect<UserIdentity, AuthError> {
  return Effect.gen(function* () {
    const identity = yield* Effect.tryPromise({
      try: () => ctx.auth.getUserIdentity(),
      catch: (error) => toAuthError(error, "Failed to resolve user identity."),
    });

    if (identity === null) {
      return yield* Effect.fail(new AuthError({ message: "Unauthorized" }));
    }

    return identity;
  });
}

/**
 * Resolves the authenticated Clerk identity for existing promise-based callers.
 *
 * @param ctx The Convex-like auth context that can resolve the current identity.
 * @returns A promise for the authenticated identity.
 * @remarks This compatibility wrapper rethrows `AuthError` as a standard `Error`.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function requireIdentity(ctx: AuthLikeCtx): Promise<UserIdentity> {
  return await Effect.runPromise(
    requireIdentityEffect(ctx).pipe(
      Effect.mapError(toThrownAuthError),
    ),
  );
}
