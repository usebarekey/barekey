import { Effect } from "effect";

import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { validateAndNormalizeDeclaredValue } from "../../lib/declared/types";
import { encryptSecretValueForProject } from "../../lib/encryption";
import { encryptedPayloadByteLength } from "../../lib/project_variables/validation";
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

type SecretWriteEntry = {
  visibility: PreparedWriteCreateEntry["visibility"];
  declaredType: PreparedWriteCreateEntry["declaredType"];
  value: string;
};

export type PreparedSecretWriteResult = {
  create: PreparedWriteCreateEntry | null;
  update: PreparedWriteUpdateEntry | null;
  storageDeltaBytes: number;
};

/**
 * Encrypts and shapes a prepared secret variable write entry.
 *
 * @param ctx The mutation context used to encrypt the secret value.
 * @param project The owning project metadata required for encryption.
 * @param name The normalized variable name being prepared.
 * @param entry The incoming secret write entry.
 * @param existing The existing stage row, if one already exists.
 * @returns The prepared create/update payload and storage delta for the secret entry.
 * @remarks This does not persist any writes; it only normalizes and encrypts the secret payload.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function prepareSecretWriteEffect(
  ctx: MutationCtx,
  project: Pick<Doc<"projects">, "_id" | "orgId">,
  name: string,
  entry: SecretWriteEntry,
  existing: ExistingVariableRow | null,
): Effect.Effect<PreparedSecretWriteResult, unknown, never> {
  return Effect.gen(function* () {
    const normalizedValue = yield* Effect.try({
      try: () => validateAndNormalizeDeclaredValue(entry.declaredType, entry.value),
      catch: (error) =>
        toProjectVariableValidationError("Secret variable value is invalid.", error),
    });
    const encryptedValue = yield* Effect.tryPromise({
      try: () =>
        encryptSecretValueForProject(ctx, {
          projectId: project._id,
          orgId: project.orgId,
          plaintext: normalizedValue,
        }),
      catch: (error) =>
        toProjectVariableExternalServiceError(
          "Failed to encrypt a secret variable value.",
          error,
        ),
    });
    const nextBytes = encryptedPayloadByteLength({
      encryptedValue,
      encryptedValueA: null,
      encryptedValueB: null,
    });

    if (existing === null) {
      return {
        create: {
          name,
          visibility: entry.visibility,
          kind: "secret",
          declaredType: entry.declaredType,
          encryptedValue,
          encryptedValueA: null,
          encryptedValueB: null,
          chance: null,
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
        kind: "secret",
        declaredType: entry.declaredType,
        encryptedValue,
        encryptedValueA: null,
        encryptedValueB: null,
        chance: null,
        rolloutFunction: null,
        rolloutMilestones: null,
      },
      storageDeltaBytes: nextBytes - previousBytes,
    };
  });
}
