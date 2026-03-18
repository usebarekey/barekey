import { Effect } from "effect";

import type { MutationCtx } from "../../_generated/server";
import { BarekeyConfectMutationCtx } from "../../confect";
import { encryptSecretValueForProject } from "../../lib/encryption";
import {
  encryptedPayloadByteLength,
  validateVariableName,
} from "../../lib/project_variables/validation";
import {
  listProjectVariableRowsForStageEffect,
  requireProjectStageByOrgIdAndSlugEffect,
} from "../../lib/projects/scope";
import { getVariableVisibility } from "../../lib/visibility";
import { requireCurrentOrgAccessEffect } from "../access";
import {
  projectVariableValidationError,
  toProjectVariableExternalServiceError,
  toProjectVariableValidationError,
} from "../errors";
import type {
  PrepareDraftArgs,
  PreparedDraft,
  PreparedDraftCreateEntry,
  PreparedDraftUpdateEntry,
} from "../types";

/**
 * Encrypts pending secret-only draft changes and computes their storage delta
 * before the final write transaction runs.
 *
 * @param args The workspace, project, stage, and secret draft changes to prepare.
 * @returns The encrypted draft payloads plus their exact storage delta.
 * @remarks This reads project variables and encrypts draft values, but does not persist any project variable mutations.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function prepareDraftForCurrentOrgProjectStageInternalEffect(
  args: PrepareDraftArgs,
): Effect.Effect<PreparedDraft, unknown, any> {
  return Effect.gen(function* () {
    const confectCtx = yield* BarekeyConfectMutationCtx;
    const ctx = confectCtx.ctx as unknown as MutationCtx;
    const activeOrg = yield* requireCurrentOrgAccessEffect(ctx, args.expectedOrgSlug);

    const { project, stage } = yield* requireProjectStageByOrgIdAndSlugEffect(ctx.db, {
      orgId: activeOrg.orgId,
      projectSlug: args.projectSlug,
      stageSlug: args.stageSlug,
    });

    const existingRows = yield* listProjectVariableRowsForStageEffect(ctx.db, {
      projectId: project._id,
      stageSlug: stage.slug,
    });
    const byId = new Map(existingRows.map((row) => [row._id, row] as const));
    const stageVariableNames = new Set(existingRows.map((row) => row.name));

    let storageDeltaBytes = 0;
    const deletedIds = new Set(args.deletes);
    for (const variableId of deletedIds) {
      const existing = byId.get(variableId);
      if (!existing) {
        return yield* Effect.fail(
          projectVariableValidationError("Variable delete target does not exist."),
        );
      }
      stageVariableNames.delete(existing.name);
      storageDeltaBytes -= encryptedPayloadByteLength({
        encryptedValue: existing.encryptedValue,
        encryptedValueA: existing.encryptedValueA,
        encryptedValueB: existing.encryptedValueB,
      });
    }

    const preparedUpdates: Array<PreparedDraftUpdateEntry> = [];
    for (const update of args.updates) {
      const existing = byId.get(update.id);
      if (!existing) {
        return yield* Effect.fail(
          projectVariableValidationError("Variable update target does not exist."),
        );
      }
      if (deletedIds.has(update.id)) {
        return yield* Effect.fail(
          projectVariableValidationError(
            "Cannot update a variable that is marked for deletion.",
          ),
        );
      }

      const encryptedValue = yield* Effect.tryPromise({
        try: () =>
          encryptSecretValueForProject(ctx, {
            projectId: project._id,
            orgId: project.orgId,
            plaintext: update.value,
          }),
        catch: (error) =>
          toProjectVariableExternalServiceError(
            "Failed to encrypt a secret draft value.",
            error,
          ),
      });

      storageDeltaBytes +=
        encryptedPayloadByteLength({
          encryptedValue,
          encryptedValueA: null,
          encryptedValueB: null,
        }) -
        encryptedPayloadByteLength({
          encryptedValue: existing.encryptedValue,
          encryptedValueA: existing.encryptedValueA,
          encryptedValueB: existing.encryptedValueB,
        });
      preparedUpdates.push({
        id: update.id,
        visibility: getVariableVisibility(existing),
        kind: update.kind,
        declaredType: "string",
        encryptedValue,
      });
    }

    const preparedCreates: Array<PreparedDraftCreateEntry> = [];
    for (const create of args.creates) {
      const name = yield* Effect.try({
        try: () => validateVariableName(create.name),
        catch: (error) =>
          toProjectVariableValidationError("Draft variable name is invalid.", error),
      });
      if (stageVariableNames.has(name)) {
        return yield* Effect.fail(
          projectVariableValidationError(
            `Variable ${name} already exists in this stage.`,
          ),
        );
      }

      const encryptedValue = yield* Effect.tryPromise({
        try: () =>
          encryptSecretValueForProject(ctx, {
            projectId: project._id,
            orgId: project.orgId,
            plaintext: create.value,
          }),
        catch: (error) =>
          toProjectVariableExternalServiceError(
            "Failed to encrypt a secret draft value.",
            error,
          ),
      });
      storageDeltaBytes += encryptedPayloadByteLength({
        encryptedValue,
        encryptedValueA: null,
        encryptedValueB: null,
      });
      preparedCreates.push({
        name,
        visibility: "private",
        kind: create.kind,
        declaredType: "string",
        encryptedValue,
      });
      stageVariableNames.add(name);
    }

    return {
      orgId: project.orgId,
      storageDeltaBytes,
      creates: preparedCreates,
      updates: preparedUpdates,
      deletes: Array.from(deletedIds),
      createdCount: preparedCreates.length,
      updatedCount: preparedUpdates.length,
      deletedCount: deletedIds.size,
    };
  });
}
