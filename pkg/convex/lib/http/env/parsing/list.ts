import type { EnvListRequest } from "../types";
import { readOptionalString } from "./shared";

/**
 * Parses an environment list request.
 *
 * @param payload The raw request payload.
 * @returns The normalized request, or `null` when invalid.
 * @remarks Project and stage slugs must be non-empty after trimming.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function parseListRequest(payload: unknown): EnvListRequest | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const input = payload as Record<string, unknown>;
  const projectSlug = typeof input.projectSlug === "string" ? input.projectSlug.trim() : "";
  const stageSlug = typeof input.stageSlug === "string" ? input.stageSlug.trim() : "";
  if (projectSlug.length === 0 || stageSlug.length === 0) {
    return null;
  }

  return {
    orgSlug: readOptionalString(input, "orgSlug") ?? undefined,
    projectSlug,
    stageSlug,
  };
}
