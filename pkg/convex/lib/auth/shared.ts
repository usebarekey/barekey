import type { UserIdentity } from "convex/server";

import { AuthError } from "../errors/effect";

/**
 * Normalizes unknown auth failures into the shared typed auth error shape.
 *
 * @param error The unknown failure value to normalize.
 * @param fallbackMessage The message to use when the failure has no usable message.
 * @returns A typed auth error with a stable message.
 * @remarks This is used at Effect boundaries and does not read or write Convex state.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function toAuthError(error: unknown, fallbackMessage: string): AuthError {
  return new AuthError({
    message: error instanceof Error ? error.message : fallbackMessage,
  });
}

/**
 * Converts a typed auth error back into a thrown `Error` for compatibility with
 * legacy async and sync call sites.
 *
 * @param error The typed auth error to convert.
 * @returns A standard `Error` instance carrying the same message.
 * @remarks This compatibility shim should disappear as callers move to the Effect-native exports.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function toThrownAuthError(error: AuthError): Error {
  return new Error(error.message);
}

/**
 * Reads a string-valued Clerk claim from a user identity object.
 *
 * @param identity The authenticated Clerk identity.
 * @param key The claim key to read.
 * @returns The string claim value or `null` when the claim is absent or not a string.
 * @remarks This is a pure helper and does not perform any I/O.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function readStringClaim(identity: UserIdentity, key: string): string | null {
  const value = identity[key];
  return typeof value === "string" ? value : null;
}
