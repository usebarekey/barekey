import { Schema } from "effect";

import type { EnvListRequest } from "../types";
import { decodePayloadOrNull } from "./shared";

const trimmedNonEmptyStringSchema = Schema.Trim.pipe(Schema.minLength(1));
const listRequestSchema = Schema.Struct({
  orgSlug: Schema.optional(Schema.NullOr(trimmedNonEmptyStringSchema)),
  projectSlug: trimmedNonEmptyStringSchema,
  stageSlug: trimmedNonEmptyStringSchema,
});

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
  const decoded = decodePayloadOrNull(listRequestSchema, payload);
  if (decoded === null) {
    return null;
  }

  return {
    orgSlug: decoded.orgSlug ?? undefined,
    projectSlug: decoded.projectSlug,
    stageSlug: decoded.stageSlug,
  };
}
