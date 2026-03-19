import { Either, Schema } from "effect";

const trimmedNonEmptyStringSchema = Schema.Trim.pipe(Schema.minLength(1));

/**
 * Normalizes a variable name from request payloads.
 *
 * @param value The raw name value.
 * @returns The trimmed variable name.
 * @remarks Request parsing keeps name normalization intentionally minimal to preserve case.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function normalizeName(value: string): string {
  return value.trim();
}

const nullableStringSchema = Schema.NullOr(trimmedNonEmptyStringSchema);

/**
 * Decodes one request payload with an Effect schema, returning `null` when the payload does not match.
 *
 * @param schema The request schema to apply.
 * @param payload The raw JSON payload.
 * @returns The decoded payload, or `null` when invalid.
 * @remarks HTTP env routes intentionally translate schema decode failures into stable 400 responses.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export function decodePayloadOrNull<A>(schema: Schema.Schema<A, any>, payload: unknown): A | null {
  const decoded = Schema.decodeUnknownEither(schema)(payload);
  return Either.isRight(decoded) ? decoded.right : null;
}

/**
 * Reads an optional non-empty string field from a payload record.
 *
 * @param input The payload record.
 * @param key The field name to read.
 * @returns The trimmed string value, or `null`.
 * @remarks Empty strings are normalized to `null`.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function readOptionalString(input: Record<string, unknown>, key: string): string | null {
  if (!(key in input) || input[key] === undefined) {
    return null;
  }
  const decoded = decodePayloadOrNull(nullableStringSchema, input[key]);
  return decoded ?? null;
}
