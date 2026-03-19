import { Effect } from "effect";

import type { MutationCtx } from "../../_generated/server";
import { dbDeleteEffect } from "../../lib/convex/db";
import { toCutoverError } from "../shared";

/**
 * Deletes all encrypted-data rows loaded for the destructive cutover.
 *
 * @param ctx The Convex mutation context.
 * @param input The loaded rows to delete.
 * @returns An Effect that completes after all rows are deleted.
 * @remarks This deletes schedules, variables, wrapped DEKs, and storage mirror rows sequentially.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function deleteEncryptedCutoverRowsEffect(
  ctx: MutationCtx,
  input: {
    schedules: Array<{ _id: string }>;
    projectVariables: Array<{ _id: string }>;
    projectKeys: Array<{ _id: string }>;
    orgStorageUsageRows: Array<{ _id: string }>;
  },
) {
  return Effect.gen(function* () {
    yield* deleteRowsEffect(
      ctx,
      input.schedules,
      "Failed to delete a scheduled variable write during cutover.",
    );
    yield* deleteRowsEffect(
      ctx,
      input.projectVariables,
      "Failed to delete a project variable during cutover.",
    );
    yield* deleteRowsEffect(
      ctx,
      input.projectKeys,
      "Failed to delete a project key during cutover.",
    );
    yield* deleteRowsEffect(
      ctx,
      input.orgStorageUsageRows,
      "Failed to delete a storage mirror row during cutover.",
    );
  });
}

/**
 * Deletes a list of rows from one table during cutover.
 *
 * @param ctx The Convex mutation context.
 * @param rows The rows whose ids should be deleted.
 * @param failureMessage The message used when a delete fails.
 * @returns An Effect that completes after the rows are deleted.
 * @remarks This intentionally deletes one row at a time to keep failure reporting precise.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
function deleteRowsEffect(
  ctx: MutationCtx,
  rows: Array<{ _id: string }>,
  failureMessage: string,
) {
  return Effect.forEach(
    rows,
    (row) => dbDeleteEffect(ctx, row._id, (error) => toCutoverError(failureMessage, error)),
    { concurrency: 1, discard: true },
  );
}
