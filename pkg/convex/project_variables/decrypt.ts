import { v } from "convex/values";

import type { MutationCtx } from "../_generated/server";
import { internalMutation, mutation } from "../confect";
import type { Id } from "../_generated/dataModel";
import type { DeclaredVariableType } from "../lib/declared_types";
import { declaredTypeValidator } from "../lib/declared_types";
import { decryptSecretValueForProject } from "../lib/encryption";
import {
  getRowDeclaredType,
  validateChance,
} from "../lib/project_variables_shared";
import {
  requireProjectStageByOrgIdAndSlug,
} from "../lib/project_scope";
import {
  rolloutFunctionValidator,
  rolloutMilestoneValidator,
  type RolloutFunction,
  type RolloutMilestone,
  validateRolloutMilestones,
} from "../lib/rollout";
import { requireCurrentOrgAccess } from "./access";
import type { DecryptedVariableValue } from "./types";

const decryptedVariableValueValidator = v.union(
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

/**
 * Decrypts a single variable in a validated project stage context.
 *
 * @param ctx The Convex mutation context used to read and decrypt the variable.
 * @param args The organization, project, stage, and variable identifier to decrypt.
 * @returns The decrypted variable value payload matching the variable kind.
 * @remarks This throws when the variable does not belong to the resolved stage or when required ciphertext columns are missing.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
async function decryptVariableForProjectStage(
  ctx: MutationCtx,
  args: {
    orgId: string;
    projectSlug: string;
    stageSlug: string;
    variableId: Id<"projectVariables">;
  },
): Promise<DecryptedVariableValue> {
  const { project, stage } = await requireProjectStageByOrgIdAndSlug(ctx.db, {
    orgId: args.orgId,
    projectSlug: args.projectSlug,
    stageSlug: args.stageSlug,
  });

  const variable = await ctx.db.get(args.variableId);
  if (
    variable === null ||
    variable.projectId !== project._id ||
    variable.orgId !== project.orgId ||
    variable.stageSlug !== stage.slug
  ) {
    throw new Error("Variable not found in this stage.");
  }

  if (variable.kind === "secret") {
    if (variable.encryptedValue === null) {
      throw new Error("Secret variable ciphertext is missing.");
    }
    const value = await decryptSecretValueForProject(ctx, {
      projectId: project._id,
      orgId: project.orgId,
      encryptedValue: variable.encryptedValue,
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
    throw new Error(`${variable.kind} ciphertext is missing.`);
  }

  const valueA = await decryptSecretValueForProject(ctx, {
    projectId: project._id,
    orgId: project.orgId,
    encryptedValue: variable.encryptedValueA,
  });
  const valueB = await decryptSecretValueForProject(ctx, {
    projectId: project._id,
    orgId: project.orgId,
    encryptedValue: variable.encryptedValueB,
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
}

/**
 * Decrypts one variable value in an org-scoped project stage.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The organization, project, stage, and variable identifier to decrypt.
 * @returns The decrypted variable payload for the requested row.
 * @remarks Internal HTTP and SDK flows use this to reveal variable values after resolving org scope.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const decryptValueForOrgProjectStageInternal = internalMutation({
  args: {
    orgId: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
    variableId: v.id("projectVariables"),
  },
  returns: decryptedVariableValueValidator,
  handler: async (ctx, args): Promise<DecryptedVariableValue> => {
    return await decryptVariableForProjectStage(ctx, args);
  },
});

/**
 * Decrypts one stage variable value for immediate UI reveal.
 *
 * Callers should treat the returned plaintext as ephemeral and avoid caching
 * beyond the current user interaction.
 *
 * @param ctx The Convex public mutation context.
 * @param args The workspace, project, stage, and variable identifier to decrypt.
 * @returns The decrypted variable payload for the requested row.
 * @remarks This validates current workspace access before delegating to the shared stage decrypt helper.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const decryptValueForCurrentOrgProjectStage = mutation({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
    variableId: v.id("projectVariables"),
  },
  returns: decryptedVariableValueValidator,
  handler: async (ctx, args): Promise<DecryptedVariableValue> => {
    const activeOrg = await requireCurrentOrgAccess(ctx, args.expectedOrgSlug);

    return await decryptVariableForProjectStage(ctx, {
      orgId: activeOrg.orgId,
      projectSlug: args.projectSlug,
      stageSlug: args.stageSlug,
      variableId: args.variableId,
    });
  },
});
