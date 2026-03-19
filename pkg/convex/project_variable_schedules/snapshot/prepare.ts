import { Effect } from "effect";

import {
  NotFoundError,
  ValidationError,
  type ExternalServiceError,
} from "../../lib/errors/effect";
import type { BuildPreparedScheduleSnapshotInput, PreparedScheduleSnapshot } from "./prepare/types";
import {
  listScheduleSnapshotVariableMetadataEffect,
  prepareScheduledVariableWritesEffect,
} from "./prepare/repo";
import { normalizeScheduledSnapshotEntriesEffect } from "./prepare/entries";

export type { BuildPreparedScheduleSnapshotInput, PreparedScheduleSnapshot } from "./prepare/types";

/**
 * Builds the prepared encrypted snapshot for a scheduled variable batch.
 *
 * @param input The mutation context plus the org, project, stage, and user-authored create/update entries.
 * @returns The prepared encrypted creates, updates, update target metadata, and counts.
 * @remarks This delegates encryption and normalization to the `project_variables` write-preparation pipeline.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function buildPreparedScheduleSnapshotEffect(
  input: BuildPreparedScheduleSnapshotInput,
): Effect.Effect<
  PreparedScheduleSnapshot,
  ExternalServiceError | NotFoundError | ValidationError
> {
  return Effect.gen(function* () {
    const existingRows = yield* listScheduleSnapshotVariableMetadataEffect(input);
    const normalized = yield* normalizeScheduledSnapshotEntriesEffect({
      existingRows,
      snapshotInput: input,
    });
    const prepared = yield* prepareScheduledVariableWritesEffect({
      ...input,
      entries: normalized.entries,
    });

    return {
      preparedCreates: prepared.creates,
      preparedUpdates: prepared.updates,
      updateTargets: normalized.updateTargets,
      createdCount: prepared.createdCount,
      updatedCount: prepared.updatedCount,
    };
  });
}

/**
 * Builds the prepared encrypted snapshot for a scheduled variable batch.
 *
 * @param input The mutation context plus the org, project, stage, and user-authored create/update entries.
 * @returns The prepared encrypted creates, updates, update target metadata, and counts.
 * @remarks This compatibility wrapper keeps promise-based callers working while the domain moves to Effect.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export async function buildPreparedScheduleSnapshot(
  input: BuildPreparedScheduleSnapshotInput,
): Promise<PreparedScheduleSnapshot> {
  return await Effect.runPromise(
    buildPreparedScheduleSnapshotEffect(input).pipe(
      Effect.mapError((error) => new Error(error.message)),
    ),
  );
}
