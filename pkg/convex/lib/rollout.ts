import { v } from "convex/values";

export const rolloutFunctionValidator = v.literal("linear");

export const rolloutMilestoneValidator = v.object({
  at: v.string(),
  percentage: v.number(),
});

export type RolloutFunction = "linear";

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

export function validateRolloutMilestones(value: Array<RolloutMilestone>): Array<RolloutMilestone> {
  if (value.length === 0) {
    throw new Error("rollout milestones must contain at least one entry.");
  }

  let previousAtMs = -1;
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
  const milestones = validateRolloutMilestones(input.milestones);
  const first = milestones[0];
  if (first === undefined) {
    return 0;
  }

  const firstAtMs = parseRolloutInstant(first.at);
  if (input.nowMs < firstAtMs) {
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
