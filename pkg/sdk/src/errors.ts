import type { BarekeyErrorCode } from "./types";

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

export function parseNumberOrThrow(value: string): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new BarekeyError({
      code: "COERCE_FAILED",
      message: `Unable to coerce value to number: ${value}`,
    });
  }
  return parsed;
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
