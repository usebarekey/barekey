import {
  CoerceFailedError,
  InvalidDynamicOptionsError,
  parseBigIntOrThrow,
  parseBooleanOrThrow,
  parseDateOrThrow,
  parseFloatOrThrow,
  parseJsonOrThrow,
} from "../errors.js";
import type {
  BarekeyDeclaredType,
  BarekeyDecision,
  BarekeyEvaluatedValue,
  BarekeyGetOptions,
  BarekeyRolloutMilestone,
  BarekeyVariableDefinition,
} from "../types.js";

export type BarekeyCoerceTarget = "string" | "boolean" | "int64" | "float" | "date" | "json";

function parseRolloutInstant(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new CoerceFailedError({
      message: `Invalid Barekey rollout milestone instant "${value}".`,
    });
  }
  return parsed;
}

function normalizeRolloutMilestones(
  value: Array<BarekeyRolloutMilestone>,
): Array<BarekeyRolloutMilestone> {
  if (value.length === 0) {
    throw new CoerceFailedError({
      message: "Rollout milestones must contain at least one entry.",
    });
  }

  let previousAtMs = -1;
  return value.map((milestone) => {
    if (
      !Number.isFinite(milestone.percentage) ||
      milestone.percentage < 0 ||
      milestone.percentage > 100
    ) {
      throw new CoerceFailedError({
        message: "Rollout milestone percentages must be between 0 and 100.",
      });
    }

    const atMs = parseRolloutInstant(milestone.at);
    if (atMs <= previousAtMs) {
      throw new CoerceFailedError({
        message: "Rollout milestones must be strictly increasing by time.",
      });
    }
    previousAtMs = atMs;

    return {
      at: new Date(atMs).toISOString(),
      percentage: milestone.percentage,
    };
  });
}

export function validateDynamicOptions(options?: BarekeyGetOptions): void {
  if (options?.dynamic === undefined || options.dynamic === true) {
    return;
  }

  if (
    !Number.isFinite(options.dynamic.ttl) ||
    options.dynamic.ttl <= 0 ||
    !Number.isInteger(options.dynamic.ttl)
  ) {
    throw new InvalidDynamicOptionsError({
      message: "dynamic.ttl must be a positive integer number of milliseconds.",
    });
  }
}

async function deterministicBucket(input: string): Promise<number> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  const bytes = new Uint8Array(digest);
  const value =
    ((bytes[0] ?? 0) << 24) | ((bytes[1] ?? 0) << 16) | ((bytes[2] ?? 0) << 8) | (bytes[3] ?? 0);
  return (value >>> 0) / 4294967296;
}

function resolveLinearRolloutChance(input: {
  milestones: Array<BarekeyRolloutMilestone>;
  nowMs: number;
}): number {
  const milestones = normalizeRolloutMilestones(input.milestones);
  const first = milestones[0];
  if (first === undefined) {
    return 0;
  }

  if (input.nowMs < parseRolloutInstant(first.at)) {
    return 0;
  }

  for (let index = 0; index < milestones.length - 1; index += 1) {
    const current = milestones[index];
    const next = milestones[index + 1];
    if (current === undefined || next === undefined) {
      continue;
    }

    const currentAtMs = parseRolloutInstant(current.at);
    const nextAtMs = parseRolloutInstant(next.at);
    if (input.nowMs >= currentAtMs && input.nowMs < nextAtMs) {
      const progress = (input.nowMs - currentAtMs) / (nextAtMs - currentAtMs);
      const percentage = current.percentage + (next.percentage - current.percentage) * progress;
      return percentage / 100;
    }
  }

  const last = milestones[milestones.length - 1];
  return last === undefined ? 0 : last.percentage / 100;
}

export async function evaluateDefinition(
  definition: BarekeyVariableDefinition,
  options?: Pick<BarekeyGetOptions, "seed" | "key">,
): Promise<BarekeyEvaluatedValue> {
  if (definition.kind === "secret") {
    return {
      name: definition.name,
      kind: definition.kind,
      declaredType: definition.declaredType,
      value: definition.value,
    };
  }

  const seed = options?.seed?.trim() ?? "";
  const key = options?.key?.trim() ?? "";
  const bucket =
    seed.length > 0 || key.length > 0
      ? await deterministicBucket(`${definition.kind}:${definition.name}:${seed}:${key}`)
      : Math.random();

  if (definition.kind === "ab_roll") {
    const selectedArm = bucket < definition.chance ? "A" : "B";
    return {
      name: definition.name,
      kind: definition.kind,
      declaredType: definition.declaredType,
      value: selectedArm === "A" ? definition.valueA : definition.valueB,
      selectedArm,
      decision: {
        bucket,
        chance: definition.chance,
        seed: seed.length > 0 ? seed : undefined,
        key: key.length > 0 ? key : undefined,
        matchedRule: "ab_roll",
      },
    };
  }

  const chance = resolveLinearRolloutChance({
    milestones: definition.rolloutMilestones,
    nowMs: Date.now(),
  });
  const selectedArm = bucket < chance ? "B" : "A";
  return {
    name: definition.name,
    kind: definition.kind,
    declaredType: definition.declaredType,
    value: selectedArm === "A" ? definition.valueA : definition.valueB,
    selectedArm,
    decision: {
      bucket,
      chance,
      seed: seed.length > 0 ? seed : undefined,
      key: key.length > 0 ? key : undefined,
      matchedRule: "linear_rollout",
    },
  };
}

export function inferSelectedArmFromDecision(decision?: BarekeyDecision): "A" | "B" | undefined {
  if (decision === undefined) {
    return undefined;
  }
  if (decision.matchedRule === "ab_roll") {
    return decision.bucket < decision.chance ? "A" : "B";
  }
  return decision.bucket < decision.chance ? "B" : "A";
}

export function parseDeclaredValue(value: string, declaredType: BarekeyDeclaredType): unknown {
  if (declaredType === "string") {
    return value;
  }
  if (declaredType === "boolean") {
    return parseBooleanOrThrow(value);
  }
  if (declaredType === "int64") {
    return parseBigIntOrThrow(value);
  }
  if (declaredType === "float") {
    return parseFloatOrThrow(value);
  }
  if (declaredType === "date") {
    return parseDateOrThrow(value);
  }
  return parseJsonOrThrow(value);
}

export function coerceEvaluatedValue(
  resolved: BarekeyEvaluatedValue,
  target: BarekeyCoerceTarget,
): unknown {
  if (target === "string") {
    return resolved.value;
  }

  if (target === "boolean" && resolved.selectedArm !== undefined) {
    return resolved.selectedArm === "B";
  }

  if (target === "boolean") {
    return parseBooleanOrThrow(resolved.value);
  }

  if (target === "int64") {
    return parseBigIntOrThrow(resolved.value);
  }

  if (target === "float") {
    return parseFloatOrThrow(resolved.value);
  }

  if (target === "date") {
    return parseDateOrThrow(resolved.value);
  }

  return parseJsonOrThrow(resolved.value);
}
