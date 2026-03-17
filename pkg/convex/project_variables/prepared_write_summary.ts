import type { Id } from "../_generated/dataModel";
import { encryptedPayloadByteLength } from "../lib/project_variables_shared";
import type {
  ExistingCiphertextVariableRow,
  PreparedWriteCreateEntry,
  PreparedWriteUpdateEntry,
} from "./types";

export type PreparedWriteApplicationSummaryInput = {
  existingRows: Array<ExistingCiphertextVariableRow>;
  creates: Array<PreparedWriteCreateEntry>;
  updates: Array<PreparedWriteUpdateEntry>;
  deletes: Array<Id<"projectVariables">>;
};

/**
 * Measures the byte impact of a prepared variable write set against the current
 * persisted stage state.
 *
 * @param input The current encrypted rows and the prepared create, update, and delete operations.
 * @returns The net encrypted storage delta for applying the prepared write set.
 * @remarks This is a pure helper used by both measurement and commit flows; it throws when write targets are invalid.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function summarizePreparedWriteApplication(
  input: PreparedWriteApplicationSummaryInput,
): {
  storageDeltaBytes: number;
} {
  const byId = new Map(input.existingRows.map((row) => [row._id, row] as const));
  const stageVariableNames = new Set(input.existingRows.map((row) => row.name));
  const deletedIds = new Set(input.deletes);
  let storageDeltaBytes = 0;

  for (const variableId of deletedIds) {
    const existing = byId.get(variableId);
    if (existing === undefined) {
      throw new Error("Variable delete target does not exist.");
    }
    stageVariableNames.delete(existing.name);
    storageDeltaBytes -= encryptedPayloadByteLength({
      encryptedValue: existing.encryptedValue,
      encryptedValueA: existing.encryptedValueA,
      encryptedValueB: existing.encryptedValueB,
    });
  }

  for (const update of input.updates) {
    const existing = byId.get(update.id);
    if (existing === undefined) {
      throw new Error("Variable update target does not exist.");
    }
    if (deletedIds.has(update.id)) {
      throw new Error("Cannot update a variable that is marked for deletion.");
    }

    const previousBytes = encryptedPayloadByteLength({
      encryptedValue: existing.encryptedValue,
      encryptedValueA: existing.encryptedValueA,
      encryptedValueB: existing.encryptedValueB,
    });
    const nextBytes = encryptedPayloadByteLength({
      encryptedValue: update.encryptedValue,
      encryptedValueA: update.encryptedValueA,
      encryptedValueB: update.encryptedValueB,
    });
    storageDeltaBytes += nextBytes - previousBytes;
  }

  for (const create of input.creates) {
    if (stageVariableNames.has(create.name)) {
      throw new Error(`Variable ${create.name} already exists in this stage.`);
    }

    const nextBytes = encryptedPayloadByteLength({
      encryptedValue: create.encryptedValue,
      encryptedValueA: create.encryptedValueA,
      encryptedValueB: create.encryptedValueB,
    });
    storageDeltaBytes += nextBytes;
    stageVariableNames.add(create.name);
  }

  return {
    storageDeltaBytes,
  };
}
