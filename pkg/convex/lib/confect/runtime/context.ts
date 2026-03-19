import type { ActionCtx, MutationCtx, QueryCtx } from "../../../_generated/server";

export type BarekeyRuntimeCtx = QueryCtx | MutationCtx | ActionCtx;

/**
 * Generates cryptographically secure random bytes for Effect services that need
 * nonce, key, or token material.
 *
 * @param length The number of random bytes to generate.
 * @returns A new `Uint8Array` filled with secure random bytes.
 * @remarks This reads from `crypto.getRandomValues` and does not mutate any Convex state.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Detects whether the active runtime context can write directly through Convex DB mutations.
 *
 * @param convexCtx The raw runtime context to inspect.
 * @returns `true` when the context behaves like a Convex mutation context.
 * @remarks This enables mutation-only helpers without relying on fragile nominal typing.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function isMutationRuntimeCtx(convexCtx: BarekeyRuntimeCtx): convexCtx is MutationCtx {
  return "db" in convexCtx && typeof (convexCtx.db as { insert?: unknown }).insert === "function";
}

/**
 * Detects whether the active runtime context exposes a readable Convex database handle.
 *
 * @param convexCtx The raw runtime context to inspect.
 * @returns `true` when the context can issue direct database reads.
 * @remarks Query and mutation contexts satisfy this check; action contexts do not.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function hasDatabaseReader(convexCtx: BarekeyRuntimeCtx): convexCtx is QueryCtx | MutationCtx {
  return "db" in convexCtx;
}

/**
 * Detects whether the active runtime context can invoke internal mutations.
 *
 * @param convexCtx The raw runtime context to inspect.
 * @returns `true` when the context behaves like a Convex action context with mutation runners.
 * @remarks This is used for action-side audit writes and other boundary adapters.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function hasMutationRunner(convexCtx: BarekeyRuntimeCtx): convexCtx is ActionCtx {
  return "runMutation" in convexCtx && typeof convexCtx.runMutation === "function";
}

/**
 * Detects whether the active runtime context can invoke internal actions.
 *
 * @param convexCtx The raw runtime context to inspect.
 * @returns `true` when the context behaves like a Convex action context with action runners.
 * @remarks Metered billing reservations and compensations require this capability.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function hasActionRunner(convexCtx: BarekeyRuntimeCtx): convexCtx is ActionCtx {
  return "runAction" in convexCtx && typeof convexCtx.runAction === "function";
}
