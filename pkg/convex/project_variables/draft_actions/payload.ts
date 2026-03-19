import { Effect } from "effect";

import { validateRolloutMilestones } from "../../lib/rollout";
import { validateChance } from "../../lib/project_variables/validation";
import { mapVariableMetadataRow } from "../../lib/project_variables/rows";
import {
  projectVariableValidationError,
} from "../errors";
import type { ApplyDraftArgs, DraftTouchedEntry } from "./shared";

type VariableMetadataRow = ReturnType<typeof mapVariableMetadataRow>;

/**
 * Builds the write payload and audit summary for one staged variable draft.
 *
 * @param args The staged draft operations to normalize.
 * @param existingRows The current stage variable metadata rows.
 * @returns The prepared write entries, delete names, and touched-entry summary.
 * @remarks This validates update/delete targets before the metered write pipeline runs.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function buildDraftWritePayloadEffect(
  args: ApplyDraftArgs,
  existingRows: Array<VariableMetadataRow>,
): Effect.Effect<
  {
    entries: Array<ApplyDraftArgs["creates"][number]>;
    deletes: Array<string>;
    touchedEntries: Array<DraftTouchedEntry>;
  },
  ReturnType<typeof projectVariableValidationError>
> {
  return Effect.gen(function* () {
    const existingById = new Map(existingRows.map((row) => [row.id, row] as const));
    const entries = [...args.creates];

    for (const update of args.updates) {
      const existing = existingById.get(update.id);
      if (existing === undefined) {
        return yield* Effect.fail(
          projectVariableValidationError("Variable update target does not exist."),
        );
      }

      if (update.kind === "secret") {
        entries.push({
          name: existing.name,
          visibility: update.visibility,
          kind: "secret",
          declaredType: update.declaredType,
          value: update.value ?? "",
        });
        continue;
      }

      if (update.kind === "ab_roll") {
        entries.push({
          name: existing.name,
          visibility: update.visibility,
          kind: "ab_roll",
          declaredType: update.declaredType,
          valueA: update.valueA ?? "",
          valueB: update.valueB ?? "",
          chance: validateChance(update.chance ?? 0),
        });
        continue;
      }

      entries.push({
        name: existing.name,
        visibility: update.visibility,
        kind: "rollout",
        declaredType: update.declaredType,
        valueA: update.valueA ?? "",
        valueB: update.valueB ?? "",
        rolloutFunction: update.rolloutFunction ?? "linear",
        rolloutMilestones: validateRolloutMilestones([...(update.rolloutMilestones ?? [])]),
      });
    }

    const deletes: Array<string> = [];
    for (const variableId of args.deletes) {
      const existing = existingById.get(variableId);
      if (existing === undefined) {
        return yield* Effect.fail(
          projectVariableValidationError("Variable delete target does not exist."),
        );
      }
      deletes.push(existing.name);
    }

    const touchedEntries: Array<DraftTouchedEntry> = [
      ...args.creates.map((entry) => ({
        operation: "create" as const,
        name: entry.name,
        kind: entry.kind,
        visibility: entry.visibility,
        declaredType: entry.declaredType,
      })),
      ...args.updates.map((entry) => {
        const existing = existingById.get(entry.id);
        return {
          operation: "update" as const,
          name: existing?.name ?? "unknown",
          kind: entry.kind,
          visibility: entry.visibility,
          declaredType: entry.declaredType,
        };
      }),
      ...args.deletes.map((variableId) => {
        const existing = existingById.get(variableId);
        return {
          operation: "delete" as const,
          name: existing?.name ?? "unknown",
          kind: existing?.kind ?? "secret",
          visibility: existing?.visibility ?? "private",
          declaredType: existing?.declaredType ?? "string",
        };
      }),
    ];

    return {
      entries,
      deletes,
      touchedEntries,
    };
  });
}
