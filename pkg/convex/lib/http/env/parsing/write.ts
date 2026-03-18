import { normalizeDeclaredType } from "../../../declared/types";
import {
  isRolloutFunction,
  type RolloutMilestone,
  validateRolloutMilestones,
} from "../../../rollout";
import type {
  EnvVisibility,
  EnvWriteMode,
  EnvWriteRequest,
} from "../types";
import { readOptionalString } from "./shared";

/**
 * Parses an environment write request.
 *
 * @param payload The raw request payload.
 * @returns The normalized request, or `null` when invalid.
 * @remarks Entry names and delete names must be unique across the whole request payload.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function parseWriteRequest(payload: unknown): EnvWriteRequest | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const input = payload as Record<string, unknown>;
  const projectSlug = typeof input.projectSlug === "string" ? input.projectSlug.trim() : "";
  const stageSlug = typeof input.stageSlug === "string" ? input.stageSlug.trim() : "";
  if (projectSlug.length === 0 || stageSlug.length === 0) {
    return null;
  }

  const modeValue = typeof input.mode === "string" ? input.mode.trim() : "upsert";
  const mode: EnvWriteMode = modeValue === "create_only" ? "create_only" : "upsert";

  const rawEntries = Array.isArray(input.entries) ? input.entries : [];
  const entries: EnvWriteRequest["entries"] = [];
  for (const rawEntry of rawEntries) {
    if (typeof rawEntry !== "object" || rawEntry === null) {
      return null;
    }
    const entry = rawEntry as Record<string, unknown>;
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    const kind = typeof entry.kind === "string" ? entry.kind : "";
    const visibilityRaw =
      typeof entry.visibility === "string" ? entry.visibility.trim().toLowerCase() : "private";
    if (visibilityRaw !== "public" && visibilityRaw !== "private" && visibilityRaw.length !== 0) {
      return null;
    }
    const visibility: EnvVisibility = visibilityRaw === "public" ? "public" : "private";
    const declaredTypeRaw = typeof entry.declaredType === "string" ? entry.declaredType : "string";
    if (name.length === 0) {
      return null;
    }

    let declaredType: EnvWriteRequest["entries"][number]["declaredType"];
    try {
      declaredType = normalizeDeclaredType(declaredTypeRaw);
    } catch {
      return null;
    }

    if (kind === "secret") {
      if (typeof entry.value !== "string") {
        return null;
      }
      entries.push({
        name,
        visibility,
        kind: "secret",
        declaredType,
        value: entry.value,
      });
      continue;
    }

    if (kind === "ab_roll") {
      if (
        typeof entry.valueA !== "string" ||
        typeof entry.valueB !== "string" ||
        typeof entry.chance !== "number" ||
        !Number.isFinite(entry.chance) ||
        entry.chance < 0 ||
        entry.chance > 1
      ) {
        return null;
      }
      entries.push({
        name,
        visibility,
        kind: "ab_roll",
        declaredType,
        valueA: entry.valueA,
        valueB: entry.valueB,
        chance: entry.chance,
      });
      continue;
    }

    if (kind === "rollout") {
      if (
        typeof entry.valueA !== "string" ||
        typeof entry.valueB !== "string" ||
        typeof entry.rolloutFunction !== "string" ||
        !isRolloutFunction(entry.rolloutFunction) ||
        !Array.isArray(entry.rolloutMilestones)
      ) {
        return null;
      }

      const rolloutMilestones = entry.rolloutMilestones
        .map((milestone) => {
          if (typeof milestone !== "object" || milestone === null) {
            return null;
          }
          const value = milestone as Record<string, unknown>;
          if (
            typeof value.at !== "string" ||
            typeof value.percentage !== "number" ||
            !Number.isFinite(value.percentage)
          ) {
            return null;
          }
          return {
            at: value.at,
            percentage: value.percentage,
          };
        })
        .filter((milestone): milestone is RolloutMilestone => milestone !== null);
      if (rolloutMilestones.length !== entry.rolloutMilestones.length) {
        return null;
      }
      const rolloutFunction = entry.rolloutFunction as "linear" | "step" | "ease_in_out";

      try {
        entries.push({
          name,
          visibility,
          kind: "rollout",
          declaredType,
          valueA: entry.valueA,
          valueB: entry.valueB,
          rolloutFunction,
          rolloutMilestones: validateRolloutMilestones(rolloutMilestones),
        });
      } catch {
        return null;
      }
      continue;
    }

    return null;
  }

  const deletes = Array.isArray(input.deletes)
    ? input.deletes
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    : [];

  const seenNames = new Set<string>();
  for (const entry of entries) {
    if (seenNames.has(entry.name)) {
      return null;
    }
    seenNames.add(entry.name);
  }
  for (const name of deletes) {
    if (seenNames.has(name)) {
      return null;
    }
    seenNames.add(name);
  }

  return {
    orgSlug: readOptionalString(input, "orgSlug") ?? undefined,
    projectSlug,
    stageSlug,
    mode,
    entries,
    deletes,
  };
}
