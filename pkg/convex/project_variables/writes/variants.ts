import { Effect } from "effect";

import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { validateAndNormalizeDeclaredAbRoll } from "../../lib/declared/types";
import { encryptSecretValueForProject } from "../../lib/encryption";
import { validateRolloutMilestones } from "../../lib/rollout";
import {
  encryptedPayloadByteLength,
  validateChance,
} from "../../lib/project_variables/validation";
import {
  toProjectVariableExternalServiceError,
  toProjectVariableValidationError,
} from "../errors";
import type { PreparedWriteCreateEntry, PreparedWriteUpdateEntry } from "../types";

type ExistingVariableRow = {
  _id: Id<"projectVariables">;
  encryptedValue: string | null;
  encryptedValueA: string | null;
  encryptedValueB: string | null;
};

type VariantWriteEntry = {
  visibility: PreparedWriteCreateEntry["visibility"];
  declaredType: PreparedWriteCreateEntry["declaredType"];
  kind: "ab_roll" | "rollout";
  valueA: string;
  valueB: string;
  chance?: number;
  rolloutFunction?: PreparedWriteCreateEntry["rolloutFunction"];
  rolloutMilestones?: PreparedWriteCreateEntry["rolloutMilestones"];
};

export type PreparedVariantWriteResult = {
  create: PreparedWriteCreateEntry | null;
  update: PreparedWriteUpdateEntry | null;
  storageDeltaBytes: number;
};

/**
 * Encrypts and shapes a prepared A/B or rollout variable write entry.
 *
 * @param ctx The mutation context used to encrypt the variant values.
 * @param project The owning project metadata required for encryption.
 * @param name The normalized variable name being prepared.
 * @param entry The incoming A/B or rollout write entry.
 * @param existing The existing stage row, if one already exists.
 * @returns The prepared create/update payload and storage delta for the variant entry.
 * @remarks This does not persist any writes; it only normalizes and encrypts the variant payload.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function prepareVariantWriteEffect(
  ctx: MutationCtx,
  project: Pick<Doc<"projects">, "_id" | "orgId">,
  name: string,
  entry: VariantWriteEntry,
  existing: ExistingVariableRow | null,
): Effect.Effect<PreparedVariantWriteResult, unknown, never> {
  return Effect.gen(function* () {
    const normalizedValues = yield* Effect.try({
      try: () =>
        validateAndNormalizeDeclaredAbRoll(
          entry.declaredType,
          entry.valueA,
          entry.valueB,
        ),
      catch: (error) =>
        toProjectVariableValidationError("Variant variable values are invalid.", error),
    });
    const encryptedValueA = yield* Effect.tryPromise({
      try: () =>
        encryptSecretValueForProject(ctx, {
          projectId: project._id,
          orgId: project.orgId,
          plaintext: normalizedValues.valueA,
        }),
      catch: (error) =>
        toProjectVariableExternalServiceError(
          "Failed to encrypt a variant variable value.",
          error,
        ),
    });
    const encryptedValueB = yield* Effect.tryPromise({
      try: () =>
        encryptSecretValueForProject(ctx, {
          projectId: project._id,
          orgId: project.orgId,
          plaintext: normalizedValues.valueB,
        }),
      catch: (error) =>
        toProjectVariableExternalServiceError(
          "Failed to encrypt a variant variable value.",
          error,
        ),
    });
    const nextBytes = encryptedPayloadByteLength({
      encryptedValue: null,
      encryptedValueA,
      encryptedValueB,
    });

    if (entry.kind === "ab_roll") {
      if (entry.chance === undefined) {
        return yield* Effect.fail(
          toProjectVariableValidationError(
            "A/B roll chance is invalid.",
            new Error("A/B roll chance is invalid."),
          ),
        );
      }
      const chanceInput = entry.chance;
      const chance = yield* Effect.try({
        try: () => validateChance(chanceInput),
        catch: (error) =>
          toProjectVariableValidationError("A/B roll chance is invalid.", error),
      });

      if (existing === null) {
        return {
          create: {
            name,
            visibility: entry.visibility,
            kind: "ab_roll",
            declaredType: entry.declaredType,
            encryptedValue: null,
            encryptedValueA,
            encryptedValueB,
            chance,
            rolloutFunction: null,
            rolloutMilestones: null,
          },
          update: null,
          storageDeltaBytes: nextBytes,
        };
      }

      const previousBytes = encryptedPayloadByteLength({
        encryptedValue: existing.encryptedValue,
        encryptedValueA: existing.encryptedValueA,
        encryptedValueB: existing.encryptedValueB,
      });
      return {
        create: null,
        update: {
          id: existing._id,
          visibility: entry.visibility,
          kind: "ab_roll",
          declaredType: entry.declaredType,
          encryptedValue: null,
          encryptedValueA,
          encryptedValueB,
          chance,
          rolloutFunction: null,
          rolloutMilestones: null,
        },
        storageDeltaBytes: nextBytes - previousBytes,
      };
    }

    const rolloutMilestones = yield* Effect.try({
      try: () => validateRolloutMilestones(entry.rolloutMilestones ?? []),
      catch: (error) =>
        toProjectVariableValidationError("Rollout milestones are invalid.", error),
    });

    if (existing === null) {
      return {
        create: {
          name,
          visibility: entry.visibility,
          kind: "rollout",
          declaredType: entry.declaredType,
          encryptedValue: null,
          encryptedValueA,
          encryptedValueB,
          chance: null,
          rolloutFunction: entry.rolloutFunction ?? "linear",
          rolloutMilestones,
        },
        update: null,
        storageDeltaBytes: nextBytes,
      };
    }

    const previousBytes = encryptedPayloadByteLength({
      encryptedValue: existing.encryptedValue,
      encryptedValueA: existing.encryptedValueA,
      encryptedValueB: existing.encryptedValueB,
    });
    return {
      create: null,
      update: {
        id: existing._id,
        visibility: entry.visibility,
        kind: "rollout",
        declaredType: entry.declaredType,
        encryptedValue: null,
        encryptedValueA,
        encryptedValueB,
        chance: null,
        rolloutFunction: entry.rolloutFunction ?? "linear",
        rolloutMilestones,
      },
      storageDeltaBytes: nextBytes - previousBytes,
    };
  });
}
