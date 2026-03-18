import { Effect } from "effect";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { ExternalServiceError } from "../lib/errors/effect";
import { toProjectStageExternalServiceError } from "./errors";

/**
 * Normalizes a stage name into the base slug stem used for allocation.
 *
 * @param value The stage name to normalize.
 * @returns The normalized stage slug base.
 * @remarks Non-alphanumeric runs collapse to dashes and the stem is capped to 48 characters.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function normalizeStageSlugBase(value: string): string {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return normalized.length > 0 ? normalized : "stage";
}

/**
 * Generates a zero-padded random numeric suffix.
 *
 * @param length The suffix length to generate.
 * @returns The zero-padded numeric suffix string.
 * @remarks This is used during stage slug collision retries.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function randomNumericSuffix(length: number): string {
  const upperBound = 10 ** length;
  const value = Math.floor(Math.random() * upperBound);
  return String(value).padStart(length, "0");
}

/**
 * Allocates a unique stage slug within a project as an Effect program.
 *
 * @param ctx The Convex mutation context.
 * @param args The project id and desired slug base.
 * @returns An Effect that succeeds with the allocated unique stage slug.
 * @remarks This wraps the slug allocation retry loop in the shared external-service error model.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function allocateUniqueStageSlugEffect(
  ctx: MutationCtx,
  args: {
    projectId: Id<"projects">;
    slugBase: string;
  },
): Effect.Effect<string, ExternalServiceError> {
  return Effect.gen(function* () {
    const baseCandidate = yield* Effect.tryPromise({
      try: () =>
        ctx.db
          .query("projectStages")
          .withIndex("by_project_id_and_slug", (q) =>
            q.eq("projectId", args.projectId).eq("slug", args.slugBase),
          )
          .unique(),
      catch: (error) =>
        toProjectStageExternalServiceError("Failed to check the base stage slug.", error),
    });
    if (baseCandidate === null) {
      return args.slugBase;
    }

    for (const suffixLength of [2, 4] as const) {
      for (let attempt = 0; attempt < 16; attempt += 1) {
        const candidate = `${args.slugBase}-${randomNumericSuffix(suffixLength)}`;
        const existing = yield* Effect.tryPromise({
          try: () =>
            ctx.db
              .query("projectStages")
              .withIndex("by_project_id_and_slug", (q) =>
                q.eq("projectId", args.projectId).eq("slug", candidate),
              )
              .unique(),
          catch: (error) =>
            toProjectStageExternalServiceError(
              `Failed while checking candidate stage slug ${candidate}.`,
              error,
            ),
        });
        if (existing === null) {
          return candidate;
        }
      }
    }

    return yield* Effect.fail(
      toProjectStageExternalServiceError(
        "Unable to allocate a unique stage slug.",
        null,
      ),
    );
  });
}
