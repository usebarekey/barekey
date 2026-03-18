import type { EvaluateBatchRequest, EvaluateSingleRequest } from "../types";
import { normalizeName, readOptionalString } from "./shared";

/**
 * Parses a single-variable evaluation request.
 *
 * @param payload The raw request payload.
 * @returns The normalized request, or `null` when invalid.
 * @remarks Required slugs and variable name must be non-empty after trimming.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function parseSingleRequest(payload: unknown): EvaluateSingleRequest | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const input = payload as Record<string, unknown>;
  const projectSlug = typeof input.projectSlug === "string" ? input.projectSlug.trim() : "";
  const stageSlug = typeof input.stageSlug === "string" ? input.stageSlug.trim() : "";
  const name = typeof input.name === "string" ? normalizeName(input.name) : "";

  if (projectSlug.length === 0 || stageSlug.length === 0 || name.length === 0) {
    return null;
  }

  return {
    orgSlug: readOptionalString(input, "orgSlug") ?? undefined,
    projectSlug,
    stageSlug,
    name,
    key: typeof input.key === "string" ? input.key : undefined,
    seed: typeof input.seed === "string" ? input.seed : undefined,
  };
}

/**
 * Parses a batched variable evaluation request.
 *
 * @param payload The raw request payload.
 * @returns The normalized request, or `null` when invalid.
 * @remarks Names must be unique and non-empty after trimming.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function parseBatchRequest(payload: unknown): EvaluateBatchRequest | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const input = payload as Record<string, unknown>;
  const projectSlug = typeof input.projectSlug === "string" ? input.projectSlug.trim() : "";
  const stageSlug = typeof input.stageSlug === "string" ? input.stageSlug.trim() : "";
  const names = Array.isArray(input.names)
    ? input.names
        .filter((value): value is string => typeof value === "string")
        .map((value) => normalizeName(value))
    : [];

  if (projectSlug.length === 0 || stageSlug.length === 0 || names.length === 0) {
    return null;
  }

  const unique = new Set<string>();
  for (const name of names) {
    if (name.length === 0 || unique.has(name)) {
      return null;
    }
    unique.add(name);
  }

  return {
    orgSlug: readOptionalString(input, "orgSlug") ?? undefined,
    projectSlug,
    stageSlug,
    names,
    key: typeof input.key === "string" ? input.key : undefined,
    seed: typeof input.seed === "string" ? input.seed : undefined,
  };
}
