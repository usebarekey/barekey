import { Schema } from "effect";

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
import { decodePayloadOrNull } from "./shared";

const trimmedNonEmptyStringSchema = Schema.Trim.pipe(Schema.minLength(1));
const optionalNullableStringSchema = Schema.optional(Schema.NullOr(trimmedNonEmptyStringSchema));
const looseOptionalStringSchema = Schema.optional(Schema.NullOr(Schema.String));
const writeModeInputSchema = Schema.optional(Schema.NullOr(Schema.String));
const visibilityInputSchema = Schema.optional(Schema.NullOr(Schema.String));
const rolloutMilestoneSchema = Schema.Struct({
  at: Schema.String,
  percentage: Schema.Number.pipe(Schema.finite()),
});
const secretEntrySchema = Schema.Struct({
  name: trimmedNonEmptyStringSchema,
  kind: Schema.Literal("secret"),
  visibility: visibilityInputSchema,
  declaredType: looseOptionalStringSchema,
  value: Schema.String,
});
const abRollEntrySchema = Schema.Struct({
  name: trimmedNonEmptyStringSchema,
  kind: Schema.Literal("ab_roll"),
  visibility: visibilityInputSchema,
  declaredType: looseOptionalStringSchema,
  valueA: Schema.String,
  valueB: Schema.String,
  chance: Schema.Number.pipe(Schema.finite()),
});
const rolloutEntrySchema = Schema.Struct({
  name: trimmedNonEmptyStringSchema,
  kind: Schema.Literal("rollout"),
  visibility: visibilityInputSchema,
  declaredType: looseOptionalStringSchema,
  valueA: Schema.String,
  valueB: Schema.String,
  rolloutFunction: Schema.String,
  rolloutMilestones: Schema.Array(rolloutMilestoneSchema),
});
const writeRequestSchema = Schema.Struct({
  orgSlug: optionalNullableStringSchema,
  projectSlug: trimmedNonEmptyStringSchema,
  stageSlug: trimmedNonEmptyStringSchema,
  mode: writeModeInputSchema,
  entries: Schema.Array(Schema.Union(secretEntrySchema, abRollEntrySchema, rolloutEntrySchema)),
  deletes: Schema.optional(Schema.NullOr(Schema.Array(trimmedNonEmptyStringSchema))),
});

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
  const decoded = decodePayloadOrNull(writeRequestSchema, payload);
  if (decoded === null) {
    return null;
  }

  const projectSlug = decoded.projectSlug;
  const stageSlug = decoded.stageSlug;
  const modeValue = decoded.mode?.trim().toLowerCase() ?? "upsert";
  const mode: EnvWriteMode = modeValue === "create_only" ? "create_only" : "upsert";

  const entries: EnvWriteRequest["entries"] = [];
  for (const entry of decoded.entries) {
    const name = entry.name;
    const kind = entry.kind;
    const visibilityRaw = entry.visibility?.trim().toLowerCase() ?? "private";
    if (visibilityRaw !== "public" && visibilityRaw !== "private" && visibilityRaw.length !== 0) {
      return null;
    }
    const visibility: EnvVisibility = visibilityRaw === "public" ? "public" : "private";
    const declaredTypeRaw = entry.declaredType ?? "string";

    let declaredType: EnvWriteRequest["entries"][number]["declaredType"];
    try {
      declaredType = normalizeDeclaredType(declaredTypeRaw);
    } catch {
      return null;
    }

    if (kind === "secret") {
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
      if (entry.chance < 0 || entry.chance > 1) {
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
      if (!isRolloutFunction(entry.rolloutFunction)) {
        return null;
      }

      const rolloutMilestones = entry.rolloutMilestones
        .map((milestone) => ({
          at: milestone.at,
          percentage: milestone.percentage,
        }));
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

  const deletes = decoded.deletes === undefined || decoded.deletes === null ? [] : [...decoded.deletes];

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
    orgSlug: decoded.orgSlug ?? undefined,
    projectSlug,
    stageSlug,
    mode,
    entries,
    deletes,
  };
}
