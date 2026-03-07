import { v } from "convex/values";

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

const INT64_MIN = BigInt("-9223372036854775808");
const INT64_MAX = BigInt("9223372036854775807");
const RFC3339_WITH_TIMEZONE_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function isDeclaredType(value: string): value is DeclaredVariableType {
  return (
    value === "string" ||
    value === "boolean" ||
    value === "int64" ||
    value === "float" ||
    value === "date" ||
    value === "json"
  );
}

export function fallbackDeclaredType(
  value: string | null | undefined,
): DeclaredVariableType {
  if (value !== null && value !== undefined && isDeclaredType(value)) {
    return value;
  }
  return "string";
}

export function normalizeDeclaredType(input: string): DeclaredVariableType {
  const normalized = input.trim().toLowerCase();
  if (!isDeclaredType(normalized)) {
    throw new Error(`Unsupported variable type: ${input}`);
  }
  return normalized;
}

function normalizeBoolean(raw: string): string {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return "true";
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return "false";
  }
  throw new Error("Boolean variables must be true or false.");
}

function normalizeInt64(raw: string): string {
  const trimmed = raw.trim();
  if (!/^-?(0|[1-9]\d*)$/.test(trimmed)) {
    throw new Error("Integer variables must be valid signed 64-bit integers.");
  }
  const parsed = BigInt(trimmed);
  if (parsed < INT64_MIN || parsed > INT64_MAX) {
    throw new Error("Integer variables must be valid signed 64-bit integers.");
  }
  return parsed.toString();
}

function normalizeFloat(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error("Float variables must be finite numbers.");
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    throw new Error("Float variables must be finite numbers.");
  }
  return trimmed;
}

function normalizeDate(raw: string): string {
  const trimmed = raw.trim();
  if (!RFC3339_WITH_TIMEZONE_PATTERN.test(trimmed)) {
    throw new Error("Date variables must be ISO 8601 instants with timezone.");
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Date variables must be ISO 8601 instants with timezone.");
  }
  return parsed.toISOString();
}

function normalizeJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeJsonValue(entry));
  }
  if (value !== null && typeof value === "object") {
    const normalizedEntries = Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => [key, normalizeJsonValue(entryValue)] as const);
    return Object.fromEntries(normalizedEntries);
  }
  return value;
}

function normalizeJson(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return JSON.stringify(normalizeJsonValue(parsed));
  } catch {
    throw new Error("JSON variables must contain valid JSON.");
  }
}

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
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "Array<never>";
    }
    const memberTypes = value.map((entry) => inferJsonTypeFromValue(entry));
    return `Array<${collapseUnion(memberTypes)}>`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    if (entries.length === 0) {
      return "Record<string, never>";
    }
    const properties = entries
      .map(([key, entryValue]) => `${toPropertyKey(key)}: ${inferJsonTypeFromValue(entryValue)};`)
      .join(" ");
    return `{ ${properties} }`;
  }
  if (typeof value === "string") {
    return "string";
  }
  if (typeof value === "number") {
    return "number";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  return "unknown";
}

export function inferTypeScriptTypeFromNormalizedJson(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return inferJsonTypeFromValue(parsed);
  } catch {
    return "unknown";
  }
}

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
