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
  const value = input[key];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
