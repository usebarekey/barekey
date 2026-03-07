import type { BarekeyErrorCode, BarekeyTemporalInstant } from "./types";

export class BarekeyError extends Error {
  readonly code: BarekeyErrorCode;
  readonly requestId: string | null;
  readonly status: number | null;

  constructor(input: {
    code: BarekeyErrorCode;
    message: string;
    requestId?: string | null;
    status?: number | null;
  }) {
    super(input.message);
    this.name = "BarekeyError";
    this.code = input.code;
    this.requestId = input.requestId ?? null;
    this.status = input.status ?? null;
  }
}

export function normalizeErrorCode(code: string): BarekeyErrorCode {
  if (
    code === "UNAUTHORIZED" ||
    code === "ORG_SCOPE_INVALID" ||
    code === "VARIABLE_NOT_FOUND" ||
    code === "INVALID_REQUEST" ||
    code === "BILLING_UNAVAILABLE" ||
    code === "USAGE_LIMIT_EXCEEDED" ||
    code === "EVALUATION_FAILED"
  ) {
    return code;
  }
  return "UNKNOWN_ERROR";
}

export function parseFloatOrThrow(value: string): number {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new BarekeyError({
      code: "COERCE_FAILED",
      message: `Unable to coerce value to float: ${value}`,
    });
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new BarekeyError({
      code: "COERCE_FAILED",
      message: `Unable to coerce value to float: ${value}`,
    });
  }
  return parsed;
}

export function parseNumberOrThrow(value: string): number {
  return parseFloatOrThrow(value);
}

export function parseBigIntOrThrow(value: string): bigint {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new BarekeyError({
      code: "COERCE_FAILED",
      message: `Unable to coerce value to int64: ${value}`,
    });
  }
  try {
    return BigInt(normalized);
  } catch {
    throw new BarekeyError({
      code: "COERCE_FAILED",
      message: `Unable to coerce value to int64: ${value}`,
    });
  }
}

export function parseBooleanOrThrow(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }
  throw new BarekeyError({
    code: "COERCE_FAILED",
    message: `Unable to coerce value to boolean: ${value}`,
  });
}

export function parseJsonOrThrow<TJson = unknown>(value: string): TJson {
  try {
    return JSON.parse(value) as TJson;
  } catch {
    throw new BarekeyError({
      code: "COERCE_FAILED",
      message: `Unable to coerce value to json: ${value}`,
    });
  }
}

export function parseDateOrThrow(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BarekeyError({
      code: "COERCE_FAILED",
      message: `Unable to coerce value to date: ${value}`,
    });
  }
  return parsed;
}

export function parseTemporalInstantOrThrow(value: string): BarekeyTemporalInstant {
  const temporalNamespace = (globalThis as typeof globalThis & {
    Temporal?: {
      Instant?: {
        from(value: string): BarekeyTemporalInstant;
      };
    };
  }).Temporal;
  const instantFactory = temporalNamespace?.Instant;
  if (!instantFactory) {
    throw new BarekeyError({
      code: "COERCE_FAILED",
      message:
        "Unable to coerce value to Temporal.Instant because this runtime does not provide Temporal. Use toDate() instead.",
    });
  }
  try {
    return instantFactory.from(value);
  } catch {
    throw new BarekeyError({
      code: "COERCE_FAILED",
      message: `Unable to coerce value to Temporal.Instant: ${value}`,
    });
  }
}
