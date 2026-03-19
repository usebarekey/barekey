import { Effect } from "effect";

/**
 * Calls a Convex query reference with typed Effect error mapping.
 *
 * @param convexCtx The Convex context containing a `runQuery` function.
 * @param reference The query function reference.
 * @param args The query arguments.
 * @param onError Maps unknown failures into the caller's typed error.
 * @returns An Effect that yields the query result.
 * @remarks This keeps repo/runtime helpers from repeating `Effect.tryPromise` around `runQuery`.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function runQueryEffect<Result, Error>(
  convexCtx: {
    runQuery(reference: unknown, args: Record<string, unknown>): Promise<unknown>;
  },
  reference: unknown,
  args: Record<string, unknown>,
  onError: (error: unknown) => Error,
): Effect.Effect<Result, Error> {
  return Effect.tryPromise({
    try: () => convexCtx.runQuery(reference, args) as Promise<Result>,
    catch: onError,
  });
}

/**
 * Calls a Convex mutation reference with typed Effect error mapping.
 *
 * @param convexCtx The Convex context containing a `runMutation` function.
 * @param reference The mutation function reference.
 * @param args The mutation arguments.
 * @param onError Maps unknown failures into the caller's typed error.
 * @returns An Effect that yields the mutation result.
 * @remarks This keeps repo/runtime helpers from repeating `Effect.tryPromise` around `runMutation`.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function runMutationEffect<Result, Error>(
  convexCtx: {
    runMutation(reference: unknown, args: Record<string, unknown>): Promise<unknown>;
  },
  reference: unknown,
  args: Record<string, unknown>,
  onError: (error: unknown) => Error,
): Effect.Effect<Result, Error> {
  return Effect.tryPromise({
    try: () => convexCtx.runMutation(reference, args) as Promise<Result>,
    catch: onError,
  });
}

/**
 * Calls a Convex action reference with typed Effect error mapping.
 *
 * @param convexCtx The Convex context containing a `runAction` function.
 * @param reference The action function reference.
 * @param args The action arguments.
 * @param onError Maps unknown failures into the caller's typed error.
 * @returns An Effect that yields the action result.
 * @remarks This keeps repo/runtime helpers from repeating `Effect.tryPromise` around `runAction`.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function runActionEffect<Result, Error>(
  convexCtx: {
    runAction(reference: unknown, args: Record<string, unknown>): Promise<unknown>;
  },
  reference: unknown,
  args: Record<string, unknown>,
  onError: (error: unknown) => Error,
): Effect.Effect<Result, Error> {
  return Effect.tryPromise({
    try: () => convexCtx.runAction(reference, args) as Promise<Result>,
    catch: onError,
  });
}
