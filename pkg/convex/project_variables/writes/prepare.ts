import { Effect } from "effect";

import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { BarekeyConfectMutationCtx } from "../../confect";
import {
  encryptedPayloadByteLength,
  validateVariableName,
} from "../../lib/project_variables/validation";
import {
  writeEntryValidator,
  writeModeValidator,
} from "../../lib/project_variables/contracts";
import {
  listProjectVariableRowsForStageEffect,
  requireProjectStageByOrgIdAndSlugEffect,
} from "../../lib/projects/scope";
import {
  projectVariableValidationError,
  toProjectVariableValidationError,
} from "../errors";
import type {
  PrepareVariableWritesArgs,
  PreparedWriteMutationResult,
} from "../types";
import { prepareSecretWriteEffect } from "./secret";
import { prepareVariantWriteEffect } from "./variants";

/**
 * Encrypts pending create and update payloads for HTTP and CLI writes before
 * any storage metering or billing reservation occurs.
 *
 * @param args The org, project, stage, write mode, write entries, and delete names to prepare.
 * @returns The encrypted create, update, and delete payloads plus the exact storage delta they imply.
 * @remarks This performs validation, normalization, and encryption but does not persist any variable changes.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function prepareVariableWritesForOrgProjectStageInternalEffect(
  args: PrepareVariableWritesArgs,
): Effect.Effect<PreparedWriteMutationResult, unknown, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectMutationCtx;
    const ctx = confectCtx.ctx as unknown as MutationCtx;
    const { project, stage } = yield* requireProjectStageByOrgIdAndSlugEffect(ctx.db, {
      orgId: args.orgId,
      projectSlug: args.projectSlug,
      stageSlug: args.stageSlug,
    });

    const rows = yield* listProjectVariableRowsForStageEffect(ctx.db, {
      projectId: project._id,
      stageSlug: stage.slug,
    });
    const rowsByName = new Map(rows.map((row) => [row.name, row] as const));

    const seenEntryNames = new Set<string>();
    const normalizedDeletes = new Set<string>();
    for (const name of args.deletes) {
      const normalized = yield* Effect.try({
        try: () => validateVariableName(name),
        catch: (error) =>
          toProjectVariableValidationError("Variable delete name is invalid.", error),
      });
      if (seenEntryNames.has(normalized)) {
        return yield* Effect.fail(
          projectVariableValidationError(
            `Duplicate write entry for variable ${normalized}.`,
          ),
        );
      }
      normalizedDeletes.add(normalized);
      seenEntryNames.add(normalized);
    }

    let createdCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;
    let storageDeltaBytes = 0;
    const creates: PreparedWriteMutationResult["creates"] = [];
    const updates: PreparedWriteMutationResult["updates"] = [];
    const deletes: Array<Id<"projectVariables">> = [];

    for (const entry of args.entries) {
      const name = yield* Effect.try({
        try: () => validateVariableName(entry.name),
        catch: (error) =>
          toProjectVariableValidationError("Variable name is invalid.", error),
      });
      if (seenEntryNames.has(name)) {
        return yield* Effect.fail(
          projectVariableValidationError(`Duplicate write entry for variable ${name}.`),
        );
      }
      seenEntryNames.add(name);
      if (normalizedDeletes.has(name)) {
        return yield* Effect.fail(
          projectVariableValidationError(
            `Variable ${name} cannot be both written and deleted.`,
          ),
        );
      }

      const existing = rowsByName.get(name) ?? null;
      if (args.mode === "create_only" && existing !== null) {
        return yield* Effect.fail(
          projectVariableValidationError(
            `Variable ${name} already exists in this stage.`,
          ),
        );
      }

      if (entry.kind === "secret") {
        const prepared = yield* prepareSecretWriteEffect(ctx, project, name, entry, existing);
        if (prepared.create !== null) {
          creates.push(prepared.create);
          createdCount += 1;
        }
        if (prepared.update !== null) {
          updates.push(prepared.update);
          updatedCount += 1;
        }
        storageDeltaBytes += prepared.storageDeltaBytes;
        continue;
      }

      const prepared = yield* prepareVariantWriteEffect(ctx, project, name, entry, existing);
      if (prepared.create !== null) {
        creates.push(prepared.create);
        createdCount += 1;
      }
      if (prepared.update !== null) {
        updates.push(prepared.update);
        updatedCount += 1;
      }
      storageDeltaBytes += prepared.storageDeltaBytes;
    }

    for (const name of normalizedDeletes) {
      const existing = rowsByName.get(name) ?? null;
      if (existing === null) {
        continue;
      }

      storageDeltaBytes -= encryptedPayloadByteLength({
        encryptedValue: existing.encryptedValue,
        encryptedValueA: existing.encryptedValueA,
        encryptedValueB: existing.encryptedValueB,
      });
      deletes.push(existing._id);
      deletedCount += 1;
    }

    return {
      createdCount,
      updatedCount,
      deletedCount,
      storageDeltaBytes,
      creates,
      updates,
      deletes,
    };
  });
}
