import { Effect } from "effect";

import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { dbCollectEffect } from "../../lib/convex/db";
import { toCutoverError } from "../shared";

/**
 * Loads every encrypted-data table row affected by the destructive cutover.
 *
 * @param ctx The Convex mutation context.
 * @returns The scheduled writes, project variables, project keys, and storage mirror rows to wipe.
 * @remarks This centralizes the cutover table scans so the program layer only orchestrates behavior.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function loadEncryptedCutoverRowsEffect(ctx: MutationCtx) {
  return Effect.all({
    schedules: dbCollectEffect<
      Doc<"projectVariableSchedules">,
      ReturnType<typeof toCutoverError>
    >(
      ctx,
      "projectVariableSchedules",
      (query) => query,
      (error) => toCutoverError("Failed to load scheduled variable writes for cutover.", error),
    ),
    projectVariables: dbCollectEffect<
      Doc<"projectVariables">,
      ReturnType<typeof toCutoverError>
    >(
      ctx,
      "projectVariables",
      (query) => query,
      (error) => toCutoverError("Failed to load project variables for cutover.", error),
    ),
    projectKeys: dbCollectEffect<Doc<"projectKeys">, ReturnType<typeof toCutoverError>>(
      ctx,
      "projectKeys",
      (query) => query,
      (error) => toCutoverError("Failed to load project keys for cutover.", error),
    ),
    orgStorageUsageRows: dbCollectEffect<
      Doc<"orgStorageUsage">,
      ReturnType<typeof toCutoverError>
    >(
      ctx,
      "orgStorageUsage",
      (query) => query,
      (error) => toCutoverError("Failed to load storage mirror rows for cutover.", error),
    ),
  });
}
