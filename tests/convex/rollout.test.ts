import { describe, expect, test } from "bun:test";

import {
  isRolloutFunction,
  resolveLinearRolloutChance,
  resolveRolloutChance,
  validateRolloutMilestones,
} from "../../pkg/convex/lib/rollout";

const start = "2025-01-01T00:00:00.000Z";
const middle = "2025-01-11T00:00:00.000Z";
const end = "2025-01-21T00:00:00.000Z";

describe("isRolloutFunction", () => {
  test("recognizes supported rollout functions", () => {
    expect(isRolloutFunction("linear")).toBeTrue();
    expect(isRolloutFunction("step")).toBeTrue();
    expect(isRolloutFunction("ease_in_out")).toBeTrue();
  });

  test("rejects unsupported rollout functions", () => {
    expect(isRolloutFunction("exponential")).toBeFalse();
  });
});

describe("validateRolloutMilestones", () => {
  test("normalizes valid milestones to canonical ISO instants", () => {
    expect(
      validateRolloutMilestones([
        {
          at: "2025-01-01T01:00:00+01:00",
          percentage: 0,
        },
        {
          at: "2025-01-02T00:00:00Z",
          percentage: 100,
        },
      ]),
    ).toEqual([
      {
        at: "2025-01-01T00:00:00.000Z",
        percentage: 0,
      },
      {
        at: "2025-01-02T00:00:00.000Z",
        percentage: 100,
      },
    ]);
  });

  test("rejects an empty milestone list", () => {
    expect(() => validateRolloutMilestones([])).toThrow(
      "rollout milestones must contain at least one entry.",
    );
  });

  test("rejects invalid percentages", () => {
    expect(() =>
      validateRolloutMilestones([
        {
          at: start,
          percentage: -1,
        },
      ]),
    ).toThrow("rollout milestone percentages must be between 0 and 100.");

    expect(() =>
      validateRolloutMilestones([
        {
          at: start,
          percentage: 101,
        },
      ]),
    ).toThrow("rollout milestone percentages must be between 0 and 100.");
  });

  test("rejects invalid milestone instants", () => {
    expect(() =>
      validateRolloutMilestones([
        {
          at: "not-a-date",
          percentage: 10,
        },
      ]),
    ).toThrow("Invalid rollout milestone instant: not-a-date");
  });

  test("rejects milestones that are not strictly increasing", () => {
    expect(() =>
      validateRolloutMilestones([
        {
          at: middle,
          percentage: 10,
        },
        {
          at: middle,
          percentage: 20,
        },
      ]),
    ).toThrow("rollout milestones must be strictly increasing by time.");
  });
});

describe("resolveLinearRolloutChance", () => {
  test("returns zero before the first milestone", () => {
    expect(
      resolveLinearRolloutChance({
        milestones: [
          { at: start, percentage: 25 },
          { at: end, percentage: 100 },
        ],
        nowMs: Date.parse("2024-12-31T23:59:59.000Z"),
      }),
    ).toBe(0);
  });

  test("interpolates linearly between milestones", () => {
    expect(
      resolveLinearRolloutChance({
        milestones: [
          { at: start, percentage: 0 },
          { at: end, percentage: 100 },
        ],
        nowMs: Date.parse("2025-01-11T00:00:00.000Z"),
      }),
    ).toBe(0.5);
  });
});

describe("resolveRolloutChance", () => {
  test("returns the final chance after the last milestone", () => {
    expect(
      resolveRolloutChance({
        function: "linear",
        milestones: [
          { at: start, percentage: 10 },
          { at: end, percentage: 80 },
        ],
        nowMs: Date.parse("2025-02-01T00:00:00.000Z"),
      }),
    ).toEqual({
      chance: 0.8,
      matchedRule: "linear_rollout",
    });
  });

  test("holds the current segment percentage for step rollouts", () => {
    expect(
      resolveRolloutChance({
        function: "step",
        milestones: [
          { at: start, percentage: 10 },
          { at: middle, percentage: 40 },
          { at: end, percentage: 100 },
        ],
        nowMs: Date.parse("2025-01-15T00:00:00.000Z"),
      }),
    ).toEqual({
      chance: 0.4,
      matchedRule: "step_rollout",
    });
  });

  test("eases progress for ease-in-out rollouts", () => {
    expect(
      resolveRolloutChance({
        function: "ease_in_out",
        milestones: [
          { at: start, percentage: 0 },
          { at: end, percentage: 100 },
        ],
        nowMs: Date.parse("2025-01-06T00:00:00.000Z"),
      }),
    ).toEqual({
      chance: 0.15625,
      matchedRule: "ease_in_out_rollout",
    });
  });

  test("returns the milestone percentage when there is only one milestone", () => {
    expect(
      resolveRolloutChance({
        function: "linear",
        milestones: [{ at: start, percentage: 35 }],
        nowMs: Date.parse("2025-01-01T00:00:01.000Z"),
      }),
    ).toEqual({
      chance: 0.35,
      matchedRule: "linear_rollout",
    });
  });

  test("returns zero before a single future milestone", () => {
    expect(
      resolveRolloutChance({
        function: "step",
        milestones: [{ at: start, percentage: 35 }],
        nowMs: Date.parse("2024-12-01T00:00:00.000Z"),
      }),
    ).toEqual({
      chance: 0,
      matchedRule: "step_rollout",
    });
  });
});
