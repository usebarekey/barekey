import { Effect } from "effect";

import type { VariableMetadataRow } from "../../../project_variables/queries";
import { validateVariableName } from "../../../lib/project_variables/validation";
import {
  NotFoundError,
  ValidationError,
} from "../../../lib/errors/effect";
import type { ScheduledCreateEntry } from "../../types";
import {
  toScheduleSnapshotValidationError,
} from "../errors";
import type { BuildPreparedScheduleSnapshotInput, PreparedScheduleSnapshot } from "./types";

/**
 * Normalizes user-authored scheduled create/update entries into write-preparation entries.
 *
 * @param input The schedule snapshot build input plus existing stage rows.
 * @returns The normalized write-preparation entries and update target metadata.
 * @remarks This resolves update target names and validates create collisions before encryption.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function normalizeScheduledSnapshotEntriesEffect(input: {
  existingRows: Array<VariableMetadataRow>;
  snapshotInput: BuildPreparedScheduleSnapshotInput;
}): Effect.Effect<
  {
    entries: Array<ScheduledCreateEntry>;
    updateTargets: PreparedScheduleSnapshot["updateTargets"];
  },
  NotFoundError | ValidationError
> {
  return Effect.gen(function* () {
    const existingById = new Map(input.existingRows.map((row) => [row.id, row] as const));
    const existingNames = new Set(input.existingRows.map((row) => row.name));

    const entries: Array<ScheduledCreateEntry> = [];
    const updateTargets: PreparedScheduleSnapshot["updateTargets"] = [];

    for (const create of input.snapshotInput.creates) {
      const normalizedName = yield* Effect.try({
        try: () => validateVariableName(create.name),
        catch: (error) =>
          toScheduleSnapshotValidationError("Variable name is invalid.", error),
      });
      if (existingNames.has(normalizedName)) {
        return yield* Effect.fail(
          new ValidationError({
            message: `Variable ${normalizedName} already exists in this stage.`,
          }),
        );
      }

      entries.push({
        ...create,
        name: normalizedName,
      });
    }

    for (const update of input.snapshotInput.updates) {
      const existing = existingById.get(update.id);
      if (existing === undefined) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Variable update target does not exist.",
          }),
        );
      }

      updateTargets.push({
        id: update.id,
        name: existing.name,
      });

      if (update.kind === "secret") {
        entries.push({
          name: existing.name,
          visibility: update.visibility,
          kind: "secret",
          declaredType: update.declaredType,
          value: update.value,
        });
        continue;
      }

      if (update.kind === "ab_roll") {
        entries.push({
          name: existing.name,
          visibility: update.visibility,
          kind: "ab_roll",
          declaredType: update.declaredType,
          valueA: update.valueA,
          valueB: update.valueB,
          chance: update.chance,
        });
        continue;
      }

      entries.push({
        name: existing.name,
        visibility: update.visibility,
        kind: "rollout",
        declaredType: update.declaredType,
        valueA: update.valueA,
        valueB: update.valueB,
        rolloutFunction: update.rolloutFunction,
        rolloutMilestones: update.rolloutMilestones,
      });
    }

    return {
      entries,
      updateTargets,
    };
  });
}
