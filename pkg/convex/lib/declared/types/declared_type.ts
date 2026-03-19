import { Either, Schema } from "effect";
import { v } from "convex/values";

import { throwValidationError } from "../../errors/effect";

export const declaredTypeValidator = v.union(
  v.literal("string"),
  v.literal("boolean"),
  v.literal("int64"),
  v.literal("float"),
  v.literal("date"),
  v.literal("json"),
);

export type DeclaredVariableType =
  | "string"
  | "boolean"
  | "int64"
  | "float"
  | "date"
  | "json";

export const declaredTypeValueSchema = Schema.Literal(
  "string",
  "boolean",
  "int64",
  "float",
  "date",
  "json",
);
const trimmedDeclaredTypeInputSchema = Schema.Trim;

function decodeDeclaredType(input: unknown): DeclaredVariableType | null {
  const trimmed = Schema.decodeUnknownEither(trimmedDeclaredTypeInputSchema)(input);
  if (Either.isLeft(trimmed)) {
    return null;
  }
  const decoded = Schema.decodeUnknownEither(declaredTypeValueSchema)(
    trimmed.right.toLowerCase(),
  );
  return Either.isRight(decoded) ? decoded.right : null;
}

/**
 * Falls back unsupported or missing declared types to `string`.
 *
 * @param value The stored declared-type value.
 * @returns A supported declared variable type.
 * @remarks This preserves compatibility with legacy rows that predate stricter validation.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function fallbackDeclaredType(
  value: string | null | undefined,
): DeclaredVariableType {
  if (value !== null && value !== undefined) {
    const decoded = decodeDeclaredType(value);
    if (decoded !== null) {
      return decoded;
    }
  }
  return "string";
}

/**
 * Validates a declared type string from untrusted input.
 *
 * @param input The raw declared type string.
 * @returns The normalized declared variable type.
 * @remarks Input is trimmed and lowercased before validation.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function normalizeDeclaredType(input: string): DeclaredVariableType {
  const decoded = decodeDeclaredType(input);
  if (decoded === null) {
    return throwValidationError(`Unsupported variable type: ${input}`);
  }
  return decoded;
}
