import { throwValidationError } from "../errors/effect";

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
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return throwValidationError("Variable name is required.");
  }

  if (trimmed.length > 160) {
    return throwValidationError("Variable name must be 160 characters or fewer.");
  }

  return trimmed;
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
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    return throwValidationError("ab_roll chance must be a finite number between 0 and 1.");
  }
  return value;
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
