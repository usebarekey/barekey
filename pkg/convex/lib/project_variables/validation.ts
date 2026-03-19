import { Either, Schema } from "effect";

import { throwValidationError } from "../errors/effect";

const variableNameSchema = Schema.Trim.pipe(Schema.minLength(1), Schema.maxLength(160));
const abRollChanceSchema = Schema.Number.pipe(Schema.finite(), Schema.between(0, 1));

/**
 * Normalizes and validates a project variable name before it is persisted or resolved.
 *
 * @param value The untrusted variable name input.
 * @returns The trimmed variable name when it is valid.
 * @remarks This throws when the name is empty or longer than the storage contract allows.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function validateVariableName(value: string): string {
  const decoded = Schema.decodeUnknownEither(variableNameSchema)(value);
  if (Either.isLeft(decoded)) {
    if (value.trim().length === 0) {
      return throwValidationError("Variable name is required.");
    }
    return throwValidationError("Variable name must be 160 characters or fewer.");
  }
  return decoded.right;
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/**
 * Validates the A/B roll chance value before storing or returning it.
 *
 * @param value The untrusted chance value.
 * @returns The same number when it is finite and within the inclusive 0..1 range.
 * @remarks This throws when the caller provides an out-of-range or non-finite value.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function validateChance(value: number): number {
  const decoded = Schema.decodeUnknownEither(abRollChanceSchema)(value);
  if (Either.isLeft(decoded)) {
    return throwValidationError("ab_roll chance must be a finite number between 0 and 1.");
  }
  return decoded.right;
}

/**
 * Computes the total UTF-8 byte size of the encrypted payload columns on a variable row.
 *
 * @param input The encrypted payload columns to measure.
 * @returns The summed UTF-8 byte count across the populated ciphertext fields.
 * @remarks Billing and storage accounting use this to compute deltas for create, update, and delete flows.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function encryptedPayloadByteLength(input: {
  encryptedValue: string | null;
  encryptedValueA: string | null;
  encryptedValueB: string | null;
}): number {
  let total = 0;
  if (input.encryptedValue !== null) {
    total += utf8ByteLength(input.encryptedValue);
  }
  if (input.encryptedValueA !== null) {
    total += utf8ByteLength(input.encryptedValueA);
  }
  if (input.encryptedValueB !== null) {
    total += utf8ByteLength(input.encryptedValueB);
  }
  return total;
}
