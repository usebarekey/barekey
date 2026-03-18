import { Effect } from "effect";

import type { QueryCtx } from "../../_generated/server";
import { BarekeyConfectQueryCtx } from "../../confect";
import { ExternalServiceError } from "../../lib/errors/effect";
import { mapVariableMetadataRow, mapVariableResolverRow } from "../../lib/project_variables/rows";

export type VariableMetadataRow = ReturnType<typeof mapVariableMetadataRow>;
export type VariableResolverRow = ReturnType<typeof mapVariableResolverRow>;
export type PublicVariableResolution = {
  orgId: string;
  rows: Array<VariableResolverRow>;
} | null;

/**
 * Normalizes project-variable query failures into shared typed service errors.
 *
 * @param error The unknown failure value.
 * @returns A typed external-service error.
 * @remarks Variable query handlers use this so Effect-backed boundaries share one error shape.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function toProjectVariableQueryError(error: unknown): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : "Failed to load project variable data.",
    cause: error,
  });
}

/**
 * Resolves the active Confect query context and runs one async variable query handler.
 *
 * @param handler The async handler to run against the underlying Convex query context.
 * @param args The handler arguments.
 * @returns An Effect wrapping the async query handler.
 * @remarks This keeps variable query exports small while preserving the existing validator contracts.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function withProjectVariableQueryCtx<Args, Result>(
  handler: (ctx: QueryCtx, args: Args) => Promise<Result>,
  args: Args,
): Effect.Effect<Result, ExternalServiceError, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectQueryCtx;
    const ctx = confectCtx.ctx as unknown as QueryCtx;
    return yield* Effect.tryPromise({
      try: () => handler(ctx, args),
      catch: toProjectVariableQueryError,
    });
  });
}
