import { Effect } from "effect";

import type { ConvexValidatorLike } from "./validators";
import { toLegacyHandlerError } from "../errors/effect";

export type EffectDefinition<Args, Returns, Requirements> = {
  args: Record<string, ConvexValidatorLike>;
  returns: ConvexValidatorLike;
  handler: (args: Args) => Effect.Effect<Returns, unknown, Requirements>;
};

/**
 * Normalizes Effect-native handler failures so they surface through the same
 * compatibility error boundary as legacy handlers.
 *
 * @param handler The Effect-native handler to normalize.
 * @returns A Confect-compatible handler with shared error normalization.
 * @remarks This keeps new Effect programs and legacy handlers consistent at the Convex boundary.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function normalizeEffectHandler<Args, Returns, Requirements>(
  handler: (args: Args) => Effect.Effect<Returns, unknown, Requirements>,
) {
  const normalizedHandler = handler as unknown as (
    args: unknown,
  ) => Effect.Effect<unknown, unknown, never>;

  return ((args: unknown) =>
    normalizedHandler(args).pipe(
      Effect.catchAll((error) => Effect.fail(toLegacyHandlerError(error))),
    )) as (args: unknown) => Effect.Effect<unknown, unknown, never>;
}
