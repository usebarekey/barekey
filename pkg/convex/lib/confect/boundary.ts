import { Effect } from "effect";

import type { ActionCtx, MutationCtx, QueryCtx } from "../../_generated/server";
import {
  BarekeyConfectActionCtx,
  BarekeyConfectMutationCtx,
  BarekeyConfectQueryCtx,
} from "./schema";
import {
  type BarekeyRuntimeCtx,
  makeRuntimeLayer,
} from "./runtime_layer";
import type { ConvexValidatorLike } from "./validator_schemas";
import { LegacyHandlerError, toLegacyHandlerError } from "../effect_errors";

type LegacyHandler<Ctx extends BarekeyRuntimeCtx, Args, Returns> = (
  ctx: Ctx,
  args: Args,
) => Promise<Returns> | Returns;

export type LegacyQueryDefinition = {
  args: Record<string, ConvexValidatorLike>;
  returns: ConvexValidatorLike;
  handler: (ctx: QueryCtx, args: unknown) => unknown;
};

export type LegacyMutationDefinition = {
  args: Record<string, ConvexValidatorLike>;
  returns: ConvexValidatorLike;
  handler: (ctx: MutationCtx, args: unknown) => unknown;
};

export type LegacyActionDefinition = {
  args: Record<string, ConvexValidatorLike>;
  returns: ConvexValidatorLike;
  handler: (ctx: ActionCtx, args: unknown) => unknown;
};

/**
 * Runs a legacy handler effect and normalizes any typed or untyped failures into
 * the shared backend legacy error wrapper.
 *
 * @param effect The handler effect to execute.
 * @returns A promise for the successful handler result.
 * @remarks This is the last compatibility boundary before Confect hands results back to Convex.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
async function runLegacyHandler<T>(
  effect: Effect.Effect<T, unknown, never>,
): Promise<T> {
  return await Effect.runPromise(
    effect.pipe(
      Effect.catchAll((error) => Effect.fail(toLegacyHandlerError(error))),
    ),
  );
}

/**
 * Executes a legacy Convex handler inside the shared runtime layer and surfaces
 * all failures as `LegacyHandlerError`.
 *
 * @param legacyCtx The raw Convex context provided by the current function invocation.
 * @param args The decoded function arguments.
 * @param handler The legacy handler implementation to invoke.
 * @returns An Effect that completes with the handler result or fails with `LegacyHandlerError`.
 * @remarks This bridges imperative handlers into Effect while domain programs are still being rewritten.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function invokeLegacyHandler<Ctx extends BarekeyRuntimeCtx, Args, Returns>(
  legacyCtx: Ctx,
  args: Args,
  handler: LegacyHandler<Ctx, Args, Returns>,
): Effect.Effect<Returns, LegacyHandlerError, never> {
  return Effect.tryPromise({
    try: () =>
      runLegacyHandler(
        Effect.tryPromise({
          try: async () => await handler(legacyCtx, args),
          catch: toLegacyHandlerError,
        }).pipe(Effect.provide(makeRuntimeLayer(legacyCtx))),
      ),
    catch: toLegacyHandlerError,
  });
}

/**
 * Lifts a legacy query handler into a Confect handler that can be registered by
 * the shared query wrappers.
 *
 * @param handler The legacy query implementation.
 * @returns A Confect-compatible Effect handler for the query boundary.
 * @remarks This only adapts context and error flow; it does not change query semantics.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function liftLegacyQueryHandler<Args, Returns>(
  handler: LegacyHandler<QueryCtx, Args, Returns>,
) {
  return (args: Args) =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectQueryCtx;
      const legacyCtx = confectCtx.ctx as unknown as QueryCtx;
      return yield* invokeLegacyHandler(legacyCtx, args, handler);
    });
}

/**
 * Lifts a legacy mutation handler into a Confect handler that can be registered
 * by the shared mutation wrappers.
 *
 * @param handler The legacy mutation implementation.
 * @returns A Confect-compatible Effect handler for mutation boundaries.
 * @remarks The returned handler preserves the current mutation API while routing execution through Effect.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function liftLegacyMutationHandler<Args, Returns>(
  handler: LegacyHandler<MutationCtx, Args, Returns>,
) {
  return (args: Args) =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectMutationCtx;
      const legacyCtx = confectCtx.ctx as unknown as MutationCtx;
      return yield* invokeLegacyHandler(legacyCtx, args, handler);
    });
}

/**
 * Lifts a legacy action handler into a Confect handler that can be registered by
 * the shared action wrappers.
 *
 * @param handler The legacy action implementation.
 * @returns A Confect-compatible Effect handler for action boundaries.
 * @remarks This isolates the remaining imperative action code from the Confect registration surface.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function liftLegacyActionHandler<Args, Returns>(
  handler: LegacyHandler<ActionCtx, Args, Returns>,
) {
  return (args: Args) =>
    Effect.gen(function* () {
      const confectCtx = yield* BarekeyConfectActionCtx;
      const legacyCtx = confectCtx.ctx as unknown as ActionCtx;
      return yield* invokeLegacyHandler(legacyCtx, args, handler);
    });
}

/**
 * Executes a legacy HTTP action inside the shared runtime layer and normalizes
 * failures through the same compatibility boundary as Confect handlers.
 *
 * @param handler The legacy HTTP action implementation.
 * @param ctx The raw Convex action context.
 * @param request The inbound HTTP request.
 * @returns A promise for the HTTP response.
 * @remarks This preserves the current HTTP route surface while centralizing error normalization.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function runLegacyHttpHandler(
  handler: (ctx: ActionCtx, request: Request) => Promise<Response>,
  ctx: ActionCtx,
  request: Request,
): Promise<Response> {
  return await runLegacyHandler(
    Effect.tryPromise({
      try: async () => await handler(ctx, request),
      catch: toLegacyHandlerError,
    }).pipe(
      Effect.provide(makeRuntimeLayer(ctx)),
    ),
  );
}
