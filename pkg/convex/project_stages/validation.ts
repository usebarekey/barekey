import { Effect } from "effect";

import { ValidationError } from "../lib/errors/effect";

/**
 * Validates and trims a stage name.
 *
 * @param name The untrusted stage name supplied by the caller.
 * @returns An Effect that succeeds with the trimmed stage name.
 * @remarks This is pure validation logic and does not read or write Convex state.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function validateStageNameEffect(name: string): Effect.Effect<string, ValidationError> {
  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    return Effect.fail(new ValidationError({ message: "Stage name is required." }));
  }

  if (trimmedName.length > 64) {
    return Effect.fail(
      new ValidationError({
        message: "Stage name must be 64 characters or fewer.",
      }),
    );
  }

  return Effect.succeed(trimmedName);
}
