import { Effect } from "effect";
import type { UserIdentity } from "convex/server";

import { AuthError, ExternalServiceError, NotFoundError } from "../../lib/errors/effect";

export type AuthDbCtxLike = {
  auth: {
    getUserIdentity(): Promise<UserIdentity | null>;
  };
  db: any;
};

/**
 * Converts typed schedule access failures back into standard `Error` values for
 * legacy promise-based callers.
 *
 * @param error The typed schedule access error.
 * @returns A standard `Error` carrying the same message.
 * @remarks This compatibility helper should disappear once all schedule flows are Effect-native.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function toThrownScheduleAccessError(
  error: AuthError | ExternalServiceError | NotFoundError,
): Error {
  return new Error(error.message);
}

/**
 * Runs an Effect-native schedule access helper for legacy promise-based callers.
 *
 * @param effect The typed schedule access effect.
 * @returns A promise for the access result.
 * @remarks This preserves compatibility while the access surface is still used by promise-style callers.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function runScheduleAccessPromise<Result>(
  effect: Effect.Effect<Result, AuthError | ExternalServiceError | NotFoundError>,
): Promise<Result> {
  return Effect.runPromise(effect.pipe(Effect.mapError(toThrownScheduleAccessError)));
}
