import { makeFunctionReference } from "convex/server";
import { resolveRolloutChance } from "../../rollout";
import type {
  DecryptedVariable,
  EnvVisibility,
  ResolvedVariableRow,
  ResolvedVariableValue,
  VariableDefinition,
} from "./types";

const decryptValueForOrgProjectStageInternalReference = makeFunctionReference<
  "mutation",
  {
    orgId: string;
    projectSlug: string;
    stageSlug: string;
    variableId: string;
  },
  DecryptedVariable
>("project_variables:decryptValueForOrgProjectStageInternal") as any;

/**
 * Derives a deterministic bucket in the range `[0, 1)` from an input string.
 *
 * @param input The string to hash.
 * @returns The deterministic bucket value.
 * @remarks This uses the first 32 bits of a SHA-256 digest for stable rollout decisions.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
async function deterministicBucket(input: string): Promise<number> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  const bytes = new Uint8Array(digest);
  const value =
    ((bytes[0] ?? 0) << 24) | ((bytes[1] ?? 0) << 16) | ((bytes[2] ?? 0) << 8) | (bytes[3] ?? 0);
  return (value >>> 0) / 4294967296;
}

/**
 * Resolves the effective runtime value for a decrypted variable.
 *
 * @param input The decrypted variable, visibility, and optional seed/key inputs.
 * @returns The resolved variable value payload.
 * @remarks A/B and rollout values use deterministic bucketing when a seed or key is provided.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function resolveVariableValue(input: {
  variable: DecryptedVariable;
  visibility: EnvVisibility;
  seed?: string;
  key?: string;
}): Promise<ResolvedVariableValue> {
  if (input.variable.kind === "secret") {
    return {
      name: input.variable.name,
      kind: "secret",
      declaredType: input.variable.declaredType,
      visibility: input.visibility,
      value: input.variable.value,
    };
  }

  const seed = input.seed?.trim() ?? "";
  const key = input.key?.trim() ?? "";
  const bucket =
    seed.length > 0 || key.length > 0
      ? await deterministicBucket(`${input.variable.kind}:${input.variable.name}:${seed}:${key}`)
      : Math.random();

  if (input.variable.kind === "ab_roll") {
    const chance = input.variable.chance;
    return {
      name: input.variable.name,
      kind: "ab_roll",
      declaredType: input.variable.declaredType,
      visibility: input.visibility,
      value: bucket < chance ? input.variable.valueA : input.variable.valueB,
      decision: {
        bucket,
        chance,
        seed: seed.length > 0 ? seed : undefined,
        key: key.length > 0 ? key : undefined,
        matchedRule: "ab_roll",
      },
    };
  }

  const { chance, matchedRule } = resolveRolloutChance({
    function: input.variable.rolloutFunction,
    milestones: input.variable.rolloutMilestones,
    nowMs: Date.now(),
  });
  return {
    name: input.variable.name,
    kind: "rollout",
    declaredType: input.variable.declaredType,
    visibility: input.visibility,
    value: bucket < chance ? input.variable.valueB : input.variable.valueA,
    decision: {
      bucket,
      chance,
      seed: seed.length > 0 ? seed : undefined,
      key: key.length > 0 ? key : undefined,
      matchedRule,
    },
  };
}

/**
 * Builds the static variable-definition payload for a decrypted variable.
 *
 * @param variable The decrypted variable.
 * @param visibility The variable visibility to expose.
 * @returns The variable definition payload.
 * @remarks This preserves the raw A/B and rollout structures for definition routes.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function buildVariableDefinition(
  variable: DecryptedVariable,
  visibility: EnvVisibility,
): VariableDefinition {
  if (variable.kind === "secret") {
    return {
      name: variable.name,
      kind: "secret",
      declaredType: variable.declaredType,
      visibility,
      value: variable.value,
    };
  }

  if (variable.kind === "ab_roll") {
    return {
      name: variable.name,
      kind: "ab_roll",
      declaredType: variable.declaredType,
      visibility,
      valueA: variable.valueA,
      valueB: variable.valueB,
      chance: variable.chance,
    };
  }

  return {
    name: variable.name,
    kind: "rollout",
    declaredType: variable.declaredType,
    visibility,
    valueA: variable.valueA,
    valueB: variable.valueB,
    rolloutFunction: variable.rolloutFunction,
    rolloutMilestones: variable.rolloutMilestones,
  };
}

/**
 * Resolves static variable definitions for a set of already-selected rows.
 *
 * @param convexCtx The minimal mutation-capable context used for decryption.
 * @param input The org/project/stage scope plus the selected variable rows.
 * @returns The resolved variable definitions.
 * @remarks This decrypts each row in sequence and converts it into the definition response shape.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function resolveDefinitionsForRows(
  convexCtx: {
    runMutation(functionReference: unknown, args: Record<string, unknown>): Promise<unknown>;
  },
  input: {
    orgId: string;
    projectSlug: string;
    stageSlug: string;
    rows: Array<ResolvedVariableRow>;
  },
): Promise<Array<VariableDefinition>> {
  const definitions: Array<VariableDefinition> = [];
  for (const row of input.rows) {
    const decrypted = (await convexCtx.runMutation(
      decryptValueForOrgProjectStageInternalReference,
      {
        orgId: input.orgId,
        projectSlug: input.projectSlug,
        stageSlug: input.stageSlug,
        variableId: row.id,
      },
    )) as DecryptedVariable;
    definitions.push(buildVariableDefinition(decrypted, row.visibility));
  }
  return definitions;
}
