import { Effect } from "effect";
import { makeFunctionReference } from "convex/server";

import type { QueryCtx } from "../_generated/server";
import { BarekeyConfectQueryCtx } from "../confect";
import { AuthError, ExternalServiceError, ValidationError } from "../lib/errors/effect";

export const listProjectsForCurrentOrgDeletionCheckInternalReference = makeFunctionReference<
  "query",
  {
    expectedOrgSlug: string;
  },
  Array<{
    id: string;
  }>
>("orgs:listProjectsForCurrentOrgDeletionCheckInternal") as any;

/**
 * Normalizes unknown organization-query failures into typed service errors.
 *
 * @param fallbackMessage The fallback message to use when the failure is not an `Error`.
 * @param error The unknown failure value.
 * @returns A typed external-service error.
 * @remarks This keeps organization query boundaries on the shared Effect error channel.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function toOrgDeletionError(
  fallbackMessage: string,
  error: unknown,
): ExternalServiceError {
  return new ExternalServiceError({
    message: error instanceof Error ? error.message : fallbackMessage,
    cause: error,
  });
}

/**
 * Resolves the Confect query context and runs an organization query program.
 *
 * @param handler The Effect program that needs the raw Convex query context.
 * @returns An Effect that succeeds with the handler result.
 * @remarks This keeps query entrypoints thin while letting repo helpers stay in Effect form.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function withOrgQueryCtx<Result>(
  handler: (
    ctx: QueryCtx,
  ) => Effect.Effect<Result, AuthError | ExternalServiceError | ValidationError>,
): Effect.Effect<Result, AuthError | ExternalServiceError | ValidationError, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectQueryCtx;
    const ctx = confectCtx.ctx as unknown as QueryCtx;
    return yield* handler(ctx);
  });
}
