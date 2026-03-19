import { Either, Schema } from "effect";

import { throwValidationError } from "../../errors/effect";
import {
  INT64_MAX,
  INT64_MIN,
  RFC3339_WITH_TIMEZONE_PATTERN,
} from "./constants";
import type { DeclaredVariableType } from "./declared_type";

const trimmedStringSchema = Schema.Trim;
const nonEmptyTrimmedStringSchema = Schema.Trim.pipe(Schema.minLength(1));
const int64Schema = Schema.BigInt.pipe(Schema.betweenBigInt(INT64_MIN, INT64_MAX));
const finiteNumberFromStringSchema = Schema.NumberFromString.pipe(Schema.finite());
const jsonTextSchema = Schema.parseJson();
const jsonPrimitiveSchema = Schema.Union(
  Schema.Null,
  Schema.Boolean,
  Schema.Finite,
  Schema.String,
);
const jsonUnknownArraySchema = Schema.Array(Schema.Unknown);
const jsonUnknownRecordSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
});

function decodeWithValidationMessage<A>(
  schema: Schema.Schema<A, any>,
  value: unknown,
  message: string,
): A {
  const decoded = Schema.decodeUnknownEither(schema)(value);
  return Either.isRight(decoded) ? decoded.right : throwValidationError(message);
}

function normalizeBoolean(raw: string): string {
  const normalized = decodeWithValidationMessage(
    trimmedStringSchema,
    raw,
    "Boolean variables must be true or false.",
  ).toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return "true";
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return "false";
  }
  return throwValidationError("Boolean variables must be true or false.");
}

function normalizeInt64(raw: string): string {
  const trimmed = raw.trim();
  if (!/^-?(0|[1-9]\d*)$/.test(trimmed)) {
    return throwValidationError("Integer variables must be valid signed 64-bit integers.");
  }
  const parsed = decodeWithValidationMessage(
    int64Schema,
    trimmed,
    "Integer variables must be valid signed 64-bit integers.",
  );
  return parsed.toString();
}

function normalizeFloat(raw: string): string {
  const trimmed = decodeWithValidationMessage(
    nonEmptyTrimmedStringSchema,
    raw,
    "Float variables must be finite numbers.",
  );
  decodeWithValidationMessage(
    finiteNumberFromStringSchema,
    trimmed,
    "Float variables must be finite numbers.",
  );
  return trimmed;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  if (month === 4 || month === 6 || month === 9 || month === 11) {
    return 30;
  }
  return 31;
}

function normalizeDate(raw: string): string {
  const trimmed = decodeWithValidationMessage(
    nonEmptyTrimmedStringSchema,
    raw,
    "Date variables must be ISO 8601 instants with timezone.",
  );
  if (!RFC3339_WITH_TIMEZONE_PATTERN.test(trimmed)) {
    return throwValidationError("Date variables must be ISO 8601 instants with timezone.");
  }
  const [datePart] = trimmed.split("T", 1);
  const [yearPart, monthPart, dayPart] = datePart?.split("-", 3) ?? [];
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    return throwValidationError("Date variables must be ISO 8601 instants with timezone.");
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return throwValidationError("Date variables must be ISO 8601 instants with timezone.");
  }
  return parsed.toISOString();
}

function normalizeJsonValue(value: unknown): unknown {
  const primitive = Schema.decodeUnknownEither(jsonPrimitiveSchema)(value);
  if (Either.isRight(primitive)) {
    return primitive.right;
  }

  const decodedArray = Schema.decodeUnknownEither(jsonUnknownArraySchema)(value);
  if (Either.isRight(decodedArray)) {
    return decodedArray.right.map((entry) => normalizeJsonValue(entry));
  }

  const decodedRecord = Schema.decodeUnknownEither(jsonUnknownRecordSchema)(value);
  if (Either.isRight(decodedRecord)) {
    const normalizedEntries: Array<readonly [string, unknown]> = [];
    const keys = Reflect.ownKeys(decodedRecord.right) as Array<string>;
    keys.sort((left, right) => left.localeCompare(right));
    for (const key of keys) {
      normalizedEntries.push([key, normalizeJsonValue(decodedRecord.right[key])]);
    }
    return Object.fromEntries(normalizedEntries);
  }

  return value;
}

function normalizeJson(raw: string): string {
  const parsed = decodeWithValidationMessage(
    jsonTextSchema,
    raw,
    "JSON variables must contain valid JSON.",
  );
  return JSON.stringify(normalizeJsonValue(parsed));
}

/**
 * Validates and normalizes one declared variable value.
 *
 * @param declaredType The declared type to normalize against.
 * @param raw The raw user-provided value.
 * @returns The normalized serialized value.
 * @remarks This keeps normalization deterministic so encrypted payloads and typegen stay stable.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function validateAndNormalizeDeclaredValue(
  declaredType: DeclaredVariableType,
  raw: string,
): string {
  if (declaredType === "string") {
    return raw;
  }
  if (declaredType === "boolean") {
    return normalizeBoolean(raw);
  }
  if (declaredType === "int64") {
    return normalizeInt64(raw);
  }
  if (declaredType === "float") {
    return normalizeFloat(raw);
  }
  if (declaredType === "date") {
    return normalizeDate(raw);
  }
  return normalizeJson(raw);
}

/**
 * Validates and normalizes both branches of an A/B variable value pair.
 *
 * @param declaredType The declared type to normalize against.
 * @param valueA The raw A branch value.
 * @param valueB The raw B branch value.
 * @returns The normalized A/B values.
 * @remarks Both branches share the same declared type contract.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function validateAndNormalizeDeclaredAbRoll(
  declaredType: DeclaredVariableType,
  valueA: string,
  valueB: string,
): { valueA: string; valueB: string } {
  return {
    valueA: validateAndNormalizeDeclaredValue(declaredType, valueA),
    valueB: validateAndNormalizeDeclaredValue(declaredType, valueB),
  };
}
