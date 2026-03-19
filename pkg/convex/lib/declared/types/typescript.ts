import { Either, Schema } from "effect";

import { SAFE_IDENTIFIER_PATTERN } from "./constants";
import type { DeclaredVariableType } from "./declared_type";

const jsonStringSchema = Schema.String;
const jsonNumberSchema = Schema.Finite;
const jsonBooleanSchema = Schema.Boolean;
const jsonNullSchema = Schema.Null;
const jsonUnknownArraySchema = Schema.Array(Schema.Unknown);
const jsonUnknownRecordSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
});

function toPropertyKey(name: string): string {
  return SAFE_IDENTIFIER_PATTERN.test(name) ? name : JSON.stringify(name);
}

function collapseUnion(typeNames: Array<string>): string {
  const unique = Array.from(new Set(typeNames)).sort((left, right) => left.localeCompare(right));
  if (unique.length === 0) {
    return "never";
  }
  if (unique.length === 1) {
    return unique[0] ?? "never";
  }
  return unique.join(" | ");
}

function inferJsonTypeFromValue(value: unknown): string {
  const decodedNull = Schema.decodeUnknownEither(jsonNullSchema)(value);
  if (Either.isRight(decodedNull)) {
    return "null";
  }

  const decodedArray = Schema.decodeUnknownEither(jsonUnknownArraySchema)(value);
  if (Either.isRight(decodedArray)) {
    if (decodedArray.right.length === 0) {
      return "Array<never>";
    }
    const memberTypes = decodedArray.right.map((entry) => inferJsonTypeFromValue(entry));
    return `Array<${collapseUnion(memberTypes)}>`;
  }

  const decodedRecord = Schema.decodeUnknownEither(jsonUnknownRecordSchema)(value);
  if (Either.isRight(decodedRecord)) {
    const keys = Reflect.ownKeys(decodedRecord.right) as Array<string>;
    keys.sort((left, right) => left.localeCompare(right));
    if (keys.length === 0) {
      return "Record<string, never>";
    }
    const properties = keys
      .map((key) => `${toPropertyKey(key)}: ${inferJsonTypeFromValue(decodedRecord.right[key])};`)
      .join(" ");
    return `{ ${properties} }`;
  }

  const decodedString = Schema.decodeUnknownEither(jsonStringSchema)(value);
  if (Either.isRight(decodedString)) {
    return "string";
  }

  const decodedNumber = Schema.decodeUnknownEither(jsonNumberSchema)(value);
  if (Either.isRight(decodedNumber)) {
    return "number";
  }

  const decodedBoolean = Schema.decodeUnknownEither(jsonBooleanSchema)(value);
  if (Either.isRight(decodedBoolean)) {
    return "boolean";
  }

  return "unknown";
}

/**
 * Infers a TypeScript type from normalized JSON text.
 *
 * @param raw The normalized JSON string.
 * @returns The inferred TypeScript type, or `unknown` when parsing fails.
 * @remarks Keys are sorted so generated output stays deterministic.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function inferTypeScriptTypeFromNormalizedJson(raw: string): string {
  const decoded = Schema.decodeUnknownEither(Schema.parseJson())(raw);
  if (Either.isLeft(decoded)) {
    return "unknown";
  }
  return inferJsonTypeFromValue(decoded.right);
}

/**
 * Maps a declared variable type to its corresponding TypeScript surface type.
 *
 * @param input The declared type and optional normalized JSON sample.
 * @returns The TypeScript type string.
 * @remarks JSON types require a normalized sample to infer a precise structure.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function toTypeScriptTypeForDeclaredType(input: {
  declaredType: DeclaredVariableType;
  normalizedJsonValue?: string | null;
}): string {
  if (input.declaredType === "string") {
    return "string";
  }
  if (input.declaredType === "boolean") {
    return "boolean";
  }
  if (input.declaredType === "int64") {
    return "bigint";
  }
  if (input.declaredType === "float") {
    return "number";
  }
  if (input.declaredType === "date") {
    return "BarekeyTemporalInstant";
  }
  if (input.normalizedJsonValue === undefined || input.normalizedJsonValue === null) {
    return "unknown";
  }
  return inferTypeScriptTypeFromNormalizedJson(input.normalizedJsonValue);
}

/**
 * Produces the most specific TypeScript type for one normalized value.
 *
 * @param input The declared type and normalized value.
 * @returns The exact TypeScript type string for the provided value.
 * @remarks JSON values reuse the normalized JSON inference path instead of bespoke literal builders.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function toExactTypeScriptTypeForNormalizedValue(input: {
  declaredType: DeclaredVariableType;
  normalizedValue: string;
}): string {
  if (input.declaredType === "string") {
    return JSON.stringify(input.normalizedValue);
  }
  if (input.declaredType === "boolean") {
    return input.normalizedValue === "true" ? "true" : "false";
  }
  if (input.declaredType === "int64") {
    return `${input.normalizedValue}n`;
  }
  if (input.declaredType === "float") {
    return input.normalizedValue;
  }
  if (input.declaredType === "date") {
    return "BarekeyTemporalInstant";
  }
  return inferTypeScriptTypeFromNormalizedJson(input.normalizedValue);
}
