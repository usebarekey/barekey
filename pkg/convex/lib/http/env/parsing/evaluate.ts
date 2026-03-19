import { Schema } from "effect";

import type { EvaluateBatchRequest, EvaluateSingleRequest } from "../types";
import { decodePayloadOrNull } from "./shared";

const trimmedNonEmptyStringSchema = Schema.Trim.pipe(Schema.minLength(1));
const optionalLooseStringSchema = Schema.optional(Schema.NullOr(Schema.String));
const singleRequestSchema = Schema.Struct({
  orgSlug: Schema.optional(Schema.NullOr(trimmedNonEmptyStringSchema)),
  projectSlug: trimmedNonEmptyStringSchema,
  stageSlug: trimmedNonEmptyStringSchema,
  name: trimmedNonEmptyStringSchema,
  key: optionalLooseStringSchema,
  seed: optionalLooseStringSchema,
});
const batchRequestSchema = Schema.Struct({
  orgSlug: Schema.optional(Schema.NullOr(trimmedNonEmptyStringSchema)),
  projectSlug: trimmedNonEmptyStringSchema,
  stageSlug: trimmedNonEmptyStringSchema,
  names: Schema.Array(trimmedNonEmptyStringSchema).pipe(
    Schema.filter((names) => names.length > 0 || "At least one variable name is required."),
    Schema.filter((names) => {
      const uniqueNames = new Set(names);
      return uniqueNames.size === names.length || "Variable names must be unique.";
    }),
  ),
  key: optionalLooseStringSchema,
  seed: optionalLooseStringSchema,
});

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
  const decoded = decodePayloadOrNull(singleRequestSchema, payload);
  if (decoded === null) {
    return null;
  }

  return {
    orgSlug: decoded.orgSlug ?? undefined,
    projectSlug: decoded.projectSlug,
    stageSlug: decoded.stageSlug,
    name: decoded.name,
    key: decoded.key ?? undefined,
    seed: decoded.seed ?? undefined,
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
  const decoded = decodePayloadOrNull(batchRequestSchema, payload);
  if (decoded === null) {
    return null;
  }

  return {
    orgSlug: decoded.orgSlug ?? undefined,
    projectSlug: decoded.projectSlug,
    stageSlug: decoded.stageSlug,
    names: [...decoded.names],
    key: decoded.key ?? undefined,
    seed: decoded.seed ?? undefined,
  };
}
