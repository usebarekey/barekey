import { Either, Effect, Schema } from "effect";

import { ValidationError } from "../lib/errors/effect";

const projectNameSchema = Schema.Trim.pipe(Schema.minLength(1), Schema.maxLength(120));
const configProjectSlugSchema = Schema.Trim.pipe(Schema.minLength(1), Schema.maxLength(48));

function decodeWithValidationError<A>(
  schema: Schema.Schema<A, any, never>,
  input: unknown,
  message: string,
): Effect.Effect<A, ValidationError> {
  const decoded = Schema.decodeUnknownEither(schema)(input);
  return Either.isRight(decoded)
    ? Effect.succeed(decoded.right)
    : Effect.fail(new ValidationError({ message }));
}

function normalizeConfigProjectSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Validates and trims a user-provided project name.
 *
 * @param value The untrusted project name input.
 * @returns An Effect that succeeds with the trimmed project name.
 * @remarks This uses Effect Schema so project create/bootstrap do not duplicate raw trim checks.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function decodeProjectNameEffect(value: string): Effect.Effect<string, ValidationError> {
  return decodeWithValidationError(
    projectNameSchema,
    value,
    "Project name must be between 1 and 120 characters.",
  );
}

/**
 * Normalizes and validates a configured project slug.
 *
 * @param value The untrusted slug input.
 * @returns An Effect that succeeds with the normalized slug.
 * @remarks This preserves the existing hyphenated slug format while moving empty/length validation into Effect Schema.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function decodeConfigProjectSlugEffect(value: string): Effect.Effect<string, ValidationError> {
  return decodeWithValidationError(
    configProjectSlugSchema,
    normalizeConfigProjectSlug(value),
    "Project slug is required.",
  );
}
