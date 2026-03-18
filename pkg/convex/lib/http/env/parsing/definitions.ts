import type { EnvDefinitionsRequest } from "../types";
import { normalizeName, readOptionalString } from "./shared";

/**
 * Parses a variable-definitions request.
 *
 * @param payload The raw request payload.
 * @returns The normalized request, or `null` when invalid.
 * @remarks Optional names must be unique and non-empty after trimming.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function parseDefinitionsRequest(payload: unknown): EnvDefinitionsRequest | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const input = payload as Record<string, unknown>;
  const projectSlug = typeof input.projectSlug === "string" ? input.projectSlug.trim() : "";
  const stageSlug = typeof input.stageSlug === "string" ? input.stageSlug.trim() : "";
  if (projectSlug.length === 0 || stageSlug.length === 0) {
    return null;
  }

  const rawNames = Array.isArray(input.names) ? input.names : null;
  const names =
    rawNames === null
      ? undefined
      : rawNames
          .filter((value): value is string => typeof value === "string")
          .map((value) => normalizeName(value));

  if (rawNames !== null && (names === undefined || names.length !== rawNames.length)) {
    return null;
  }

  if (names !== undefined) {
    const uniqueNames = new Set<string>();
    for (const name of names) {
      if (name.length === 0 || uniqueNames.has(name)) {
        return null;
      }
      uniqueNames.add(name);
    }
  }

  return {
    orgSlug: readOptionalString(input, "orgSlug") ?? undefined,
    projectSlug,
    stageSlug,
    names,
  };
}
