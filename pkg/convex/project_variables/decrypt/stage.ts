import { Id as ConfectId } from "@rjdellecese/confect/server";
import { Effect } from "effect";
import { Schema } from "effect";
import { v } from "convex/values";

import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { dbGetEffect } from "../../lib/convex/db";
import { declaredTypeValidator } from "../../lib/declared/types";
import { declaredTypeSchema } from "../../lib/confect/schema/common";
import { decryptSecretValueForProject } from "../../lib/encryption";
import { NotFoundError } from "../../lib/errors/effect";
import { getRowDeclaredType } from "../../lib/project_variables/rows";
import { validateChance } from "../../lib/project_variables/validation";
import {
  requireProjectStageByOrgIdAndSlugEffect,
} from "../../lib/projects/scope";
import {
  rolloutFunctionValidator,
  rolloutMilestoneValidator,
  validateRolloutMilestones,
} from "../../lib/rollout";
import { rolloutFunctionSchema, rolloutMilestoneSchema } from "../../lib/confect/schema/common";
import {
  projectVariableValidationError,
  toProjectVariableExternalServiceError,
} from "../errors";
import type { DecryptedVariableValue } from "../types";

export const decryptedVariableValueValidator = v.union(
  v.object({
    id: v.id("projectVariables"),
    name: v.string(),
    kind: v.literal("secret"),
    declaredType: declaredTypeValidator,
    value: v.string(),
  }),
  v.object({
    id: v.id("projectVariables"),
    name: v.string(),
    kind: v.literal("ab_roll"),
    declaredType: declaredTypeValidator,
    valueA: v.string(),
    valueB: v.string(),
    chance: v.number(),
  }),
  v.object({
    id: v.id("projectVariables"),
    name: v.string(),
    kind: v.literal("rollout"),
    declaredType: declaredTypeValidator,
    valueA: v.string(),
    valueB: v.string(),
    rolloutFunction: rolloutFunctionValidator,
    rolloutMilestones: v.array(rolloutMilestoneValidator),
  }),
);

export const decryptedVariableValueSchema = Schema.Union(
  Schema.Struct({
    id: ConfectId.Id("projectVariables"),
    name: Schema.String,
    kind: Schema.Literal("secret"),
    declaredType: declaredTypeSchema,
    value: Schema.String,
  }),
  Schema.Struct({
    id: ConfectId.Id("projectVariables"),
    name: Schema.String,
    kind: Schema.Literal("ab_roll"),
    declaredType: declaredTypeSchema,
    valueA: Schema.String,
    valueB: Schema.String,
    chance: Schema.Number,
  }),
  Schema.Struct({
    id: ConfectId.Id("projectVariables"),
    name: Schema.String,
    kind: Schema.Literal("rollout"),
    declaredType: declaredTypeSchema,
    valueA: Schema.String,
    valueB: Schema.String,
    rolloutFunction: rolloutFunctionSchema,
    rolloutMilestones: Schema.Array(rolloutMilestoneSchema),
  }),
);

/**
 * Decrypts a single variable after the caller has selected the owning org/project/stage scope.
 *
 * @param runtimeCtx The Convex mutation context used to read and decrypt the variable.
 * @param args The organization, project, stage, and variable identifier to decrypt.
 * @returns The decrypted variable value payload matching the variable kind.
 * @remarks This fails when the variable does not belong to the resolved stage or when a required ciphertext column is missing.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function decryptVariableForProjectStageEffect(
  runtimeCtx: MutationCtx,
  args: {
    orgId: string;
    projectSlug: string;
    stageSlug: string;
    variableId: Id<"projectVariables">;
  },
): Effect.Effect<DecryptedVariableValue, unknown, any> {
  return Effect.gen(function* () {
    const db = runtimeCtx.db;
    const { project, stage } = yield* requireProjectStageByOrgIdAndSlugEffect(db, {
      orgId: args.orgId,
      projectSlug: args.projectSlug,
      stageSlug: args.stageSlug,
    });

    const variable = yield* dbGetEffect<
      Doc<"projectVariables">,
      ReturnType<typeof toProjectVariableExternalServiceError>
    >(runtimeCtx, args.variableId, (error) =>
      toProjectVariableExternalServiceError(
        "Failed to load the requested variable for decryption.",
        error,
      ),
    );
    if (
      variable === null ||
      variable.projectId !== project._id ||
      variable.orgId !== project.orgId ||
      variable.stageSlug !== stage.slug
    ) {
      return yield* Effect.fail(
        new NotFoundError({ message: "Variable not found in this stage." }),
      );
    }

    if (variable.kind === "secret") {
      if (variable.encryptedValue === null) {
        return yield* Effect.fail(
          projectVariableValidationError("Secret variable ciphertext is missing."),
        );
      }
      const encryptedValue = variable.encryptedValue;

      const value = yield* Effect.tryPromise({
        try: () =>
          decryptSecretValueForProject(runtimeCtx, {
            projectId: project._id,
            orgId: project.orgId,
            encryptedValue,
          }),
        catch: (error) =>
          toProjectVariableExternalServiceError(
            "Failed to decrypt the secret variable value.",
            error,
          ),
      });

      return {
        id: variable._id,
        name: variable.name,
        kind: "secret",
        declaredType: getRowDeclaredType(variable),
        value,
      };
    }

    if (variable.encryptedValueA === null || variable.encryptedValueB === null) {
      return yield* Effect.fail(
        projectVariableValidationError(`${variable.kind} ciphertext is missing.`),
      );
    }
    const encryptedValueA = variable.encryptedValueA;
    const encryptedValueB = variable.encryptedValueB;

    const valueA = yield* Effect.tryPromise({
      try: () =>
        decryptSecretValueForProject(runtimeCtx, {
          projectId: project._id,
          orgId: project.orgId,
          encryptedValue: encryptedValueA,
        }),
      catch: (error) =>
        toProjectVariableExternalServiceError(
          `Failed to decrypt the ${variable.kind} A value.`,
          error,
        ),
    });
    const valueB = yield* Effect.tryPromise({
      try: () =>
        decryptSecretValueForProject(runtimeCtx, {
          projectId: project._id,
          orgId: project.orgId,
          encryptedValue: encryptedValueB,
        }),
      catch: (error) =>
        toProjectVariableExternalServiceError(
          `Failed to decrypt the ${variable.kind} B value.`,
          error,
        ),
    });

    if (variable.kind === "ab_roll") {
      return {
        id: variable._id,
        name: variable.name,
        kind: "ab_roll",
        declaredType: getRowDeclaredType(variable),
        valueA,
        valueB,
        chance: validateChance(variable.chance ?? 0),
      };
    }

    return {
      id: variable._id,
      name: variable.name,
      kind: "rollout",
      declaredType: getRowDeclaredType(variable),
      valueA,
      valueB,
      rolloutFunction: variable.rolloutFunction ?? "linear",
      rolloutMilestones: validateRolloutMilestones(variable.rolloutMilestones ?? []),
    };
  });
}
