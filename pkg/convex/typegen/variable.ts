import { Effect } from "effect";

import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  fallbackDeclaredType,
  toExactTypeScriptTypeForNormalizedValue,
  toTypeScriptTypeForDeclaredType,
} from "../lib/declared/types";
import { decryptSecretValueForProject } from "../lib/encryption";
import { ExternalServiceError } from "../lib/errors/effect";
import { getVariableVisibility } from "../lib/visibility";
import { toTypegenError } from "./errors";
import type { TypegenVariable } from "./shared";

function collapseTypeNames(typeNames: Array<string>): string {
  const unique = Array.from(new Set(typeNames)).sort((left, right) => left.localeCompare(right));
  if (unique.length === 0) {
    return "unknown";
  }
  return unique[0] === undefined ? "unknown" : unique.join(" | ");
}

function decryptNormalizedValueEffect(
  ctx: MutationCtx,
  project: Doc<"projects">,
  encryptedValue: string,
): Effect.Effect<string, ExternalServiceError> {
  return Effect.tryPromise({
    try: () =>
      decryptSecretValueForProject(ctx, {
        projectId: project._id,
        orgId: project.orgId,
        encryptedValue,
      }),
    catch: (error) => toTypegenError("Failed to decrypt a typegen variable value.", error),
  });
}

function buildSecretTypegenVariableEffect(
  ctx: MutationCtx,
  project: Doc<"projects">,
  row: Doc<"projectVariables">,
  declaredType: TypegenVariable["declaredType"],
): Effect.Effect<TypegenVariable, ExternalServiceError> {
  return Effect.gen(function* () {
    const normalizedJsonValue =
      declaredType === "json" && row.encryptedValue !== null
        ? yield* decryptNormalizedValueEffect(ctx, project, row.encryptedValue)
        : null;

    return {
      name: row.name,
      visibility: getVariableVisibility(row),
      kind: row.kind,
      declaredType,
      required: true,
      updatedAtMs: row.updatedAtMs,
      typeScriptType: toTypeScriptTypeForDeclaredType({
        declaredType,
        normalizedJsonValue,
      }),
      valueATypeScriptType: null,
      valueBTypeScriptType: null,
      rolloutFunction: null,
      rolloutMilestones: null,
    };
  });
}

function buildVariantTypegenVariableEffect(
  ctx: MutationCtx,
  project: Doc<"projects">,
  row: Doc<"projectVariables">,
  declaredType: TypegenVariable["declaredType"],
): Effect.Effect<TypegenVariable, ExternalServiceError> {
  return Effect.gen(function* () {
    const normalizedValues = yield* Effect.forEach(
      [row.encryptedValueA, row.encryptedValueB],
      (encryptedValue) =>
        encryptedValue === null
          ? Effect.succeed<string | null>(null)
          : decryptNormalizedValueEffect(ctx, project, encryptedValue),
    );

    const normalizedValueA = normalizedValues[0] ?? null;
    const normalizedValueB = normalizedValues[1] ?? null;
    const fallbackTypeScriptType = toTypeScriptTypeForDeclaredType({
      declaredType,
      normalizedJsonValue:
        declaredType === "json" ? normalizedValueA ?? normalizedValueB ?? null : undefined,
    });
    const valueATypeScriptType =
      normalizedValueA === null
        ? fallbackTypeScriptType
        : toExactTypeScriptTypeForNormalizedValue({
            declaredType,
            normalizedValue: normalizedValueA,
          });
    const valueBTypeScriptType =
      normalizedValueB === null
        ? fallbackTypeScriptType
        : toExactTypeScriptTypeForNormalizedValue({
            declaredType,
            normalizedValue: normalizedValueB,
          });

    return {
      name: row.name,
      visibility: getVariableVisibility(row),
      kind: row.kind,
      declaredType,
      required: true,
      updatedAtMs: row.updatedAtMs,
      typeScriptType: collapseTypeNames([valueATypeScriptType, valueBTypeScriptType]),
      valueATypeScriptType,
      valueBTypeScriptType,
      rolloutFunction: row.kind === "rollout" ? (row.rolloutFunction ?? "linear") : null,
      rolloutMilestones: row.kind === "rollout" ? (row.rolloutMilestones ?? []) : null,
    };
  });
}

/**
 * Builds one typegen variable entry from a persisted project-variable row.
 *
 * @param ctx The Convex mutation context used for secret decryption.
 * @param project The owning project row.
 * @param row The project-variable row to transform.
 * @returns An Effect that succeeds with the generated typegen variable entry.
 * @remarks JSON values decrypt plaintext so typegen can emit exact inferred shapes for stored values.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function buildTypegenVariableEffect(
  ctx: MutationCtx,
  project: Doc<"projects">,
  row: Doc<"projectVariables">,
): Effect.Effect<TypegenVariable, ExternalServiceError> {
  const declaredType = fallbackDeclaredType(row.declaredType);
  return row.kind === "secret"
    ? buildSecretTypegenVariableEffect(ctx, project, row, declaredType)
    : buildVariantTypegenVariableEffect(ctx, project, row, declaredType);
}
