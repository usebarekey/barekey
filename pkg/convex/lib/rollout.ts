import { v } from "convex/values";

export const ROLLOUT_FUNCTIONS = ["linear", "step", "ease_in_out"] as const;

export const rolloutFunctionValidator = v.union(
  v.literal("linear"),
  v.literal("step"),
  v.literal("ease_in_out"),
);

export const rolloutMilestoneValidator = v.object({
  at: v.string(),
  percentage: v.number(),
});

export type RolloutFunction = (typeof ROLLOUT_FUNCTIONS)[number];

export type RolloutMatchedRule = "linear_rollout" | "step_rollout" | "ease_in_out_rollout";

export type RolloutMilestone = {
  at: string;
  percentage: number;
};

function parseRolloutInstant(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid rollout milestone instant: ${value}`);
  }
  return parsed;
}

export function isRolloutFunction(value: string): value is RolloutFunction {
  return (ROLLOUT_FUNCTIONS as ReadonlyArray<string>).includes(value);
}

export function validateRolloutMilestones(value: Array<RolloutMilestone>): Array<RolloutMilestone> {
  if (value.length === 0) {
    throw new Error("rollout milestones must contain at least one entry.");
  }

  let previousAtMs = -Infinity;
  return value.map((milestone) => {
    const percentage = milestone.percentage;
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      throw new Error("rollout milestone percentages must be between 0 and 100.");
    }

    const atMs = parseRolloutInstant(milestone.at);
    if (atMs <= previousAtMs) {
      throw new Error("rollout milestones must be strictly increasing by time.");
    }
    previousAtMs = atMs;

    return {
      at: new Date(atMs).toISOString(),
      percentage,
    };
  });
}

/**
 * Rollout schedules represent treatment adoption for valueB so a milestone of
 * 100 means everyone receives B after the final scheduled instant.
 */
export function resolveLinearRolloutChance(input: {
  milestones: Array<RolloutMilestone>;
  nowMs: number;
}): number {
  return resolveRolloutChance({
    function: "linear",
    milestones: input.milestones,
    nowMs: input.nowMs,
  }).chance;
}

function smoothstep(progress: number): number {
  return progress * progress * (3 - 2 * progress);
}

function resolveSegmentPercentage(input: {
  function: RolloutFunction;
  currentPercentage: number;
  nextPercentage: number;
  progress: number;
}): number {
  if (input.function === "step") {
    return input.currentPercentage;
  }

  if (input.function === "ease_in_out") {
    const easedProgress = smoothstep(input.progress);
    return (
      input.currentPercentage +
      (input.nextPercentage - input.currentPercentage) * easedProgress
    );
  }

  return (
    input.currentPercentage +
    (input.nextPercentage - input.currentPercentage) * input.progress
  );
}

function rolloutRuleForFunction(value: RolloutFunction): RolloutMatchedRule {
  if (value === "step") {
    return "step_rollout";
  }
  if (value === "ease_in_out") {
    return "ease_in_out_rollout";
  }
  return "linear_rollout";
}

export function resolveRolloutChance(input: {
  function: RolloutFunction;
  milestones: Array<RolloutMilestone>;
  nowMs: number;
}): {
  chance: number;
  matchedRule: RolloutMatchedRule;
} {
  const milestones = validateRolloutMilestones(input.milestones);
  const matchedRule = rolloutRuleForFunction(input.function);
  const first = milestones[0];
  if (first === undefined) {
    return {
      chance: 0,
      matchedRule,
    };
  }

  const firstAtMs = parseRolloutInstant(first.at);
  if (input.nowMs < firstAtMs) {
    return {
      chance: 0,
      matchedRule,
    };
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
      const percentage = resolveSegmentPercentage({
        function: input.function,
        currentPercentage: current.percentage,
        nextPercentage: next.percentage,
        progress,
      });
      return {
        chance: percentage / 100,
        matchedRule,
      };
    }
  }

  const last = milestones[milestones.length - 1];
  return {
    chance: last === undefined ? 0 : last.percentage / 100,
    matchedRule,
  };
}
