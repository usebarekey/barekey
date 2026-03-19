import { Schema } from "effect";

import type { EnvDefinitionsRequest } from "../types";
import { decodePayloadOrNull } from "./shared";

const trimmedNonEmptyStringSchema = Schema.Trim.pipe(Schema.minLength(1));
const definitionsRequestSchema = Schema.Struct({
  orgSlug: Schema.optional(Schema.NullOr(trimmedNonEmptyStringSchema)),
  projectSlug: trimmedNonEmptyStringSchema,
  stageSlug: trimmedNonEmptyStringSchema,
  names: Schema.optional(
    Schema.NullOr(
      Schema.Array(trimmedNonEmptyStringSchema).pipe(
        Schema.filter((names) => {
          const uniqueNames = new Set(names);
          return uniqueNames.size === names.length || "Variable names must be unique.";
        }),
      ),
    ),
  ),
});

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
  const decoded = decodePayloadOrNull(definitionsRequestSchema, payload);
  if (decoded === null) {
    return null;
  }

  return {
    orgSlug: decoded.orgSlug ?? undefined,
    projectSlug: decoded.projectSlug,
    stageSlug: decoded.stageSlug,
    names: decoded.names === undefined || decoded.names === null ? undefined : [...decoded.names],
  };
}
