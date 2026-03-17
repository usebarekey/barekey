import { v } from "convex/values";

import {
  declaredTypeValidator,
} from "../lib/declared_types";
import {
  projectVariablePreparedCreateValidator,
  projectVariablePreparedUpdateValidator,
  projectVariableScheduleCreateEntryValidator,
  projectVariableScheduleStatusValidator,
  projectVariableScheduleUpdateEntryValidator,
} from "../lib/project_variable_schedules";
import {
  rolloutFunctionValidator,
  rolloutMilestoneValidator,
} from "../lib/rollout";

export {
  projectVariablePreparedCreateValidator,
  projectVariablePreparedUpdateValidator,
  projectVariableScheduleCreateEntryValidator,
  projectVariableScheduleStatusValidator,
  projectVariableScheduleUpdateEntryValidator,
};

export const scheduledScheduleSummaryValidator = v.object({
  id: v.id("projectVariableSchedules"),
  stageSlug: v.string(),
  stageName: v.string(),
  timezone: v.string(),
  runAtMs: v.number(),
  status: projectVariableScheduleStatusValidator,
  createdCount: v.number(),
  updatedCount: v.number(),
  batchNames: v.array(v.string()),
  createdAtMs: v.number(),
  updatedAtMs: v.number(),
  executedAtMs: v.union(v.number(), v.null()),
  canceledAtMs: v.union(v.number(), v.null()),
  failedAtMs: v.union(v.number(), v.null()),
  failureMessage: v.union(v.string(), v.null()),
});

const decryptedScheduleUpdateSecretValidator = v.object({
  id: v.id("projectVariables"),
  name: v.string(),
  visibility: v.union(v.literal("private"), v.literal("public")),
  kind: v.literal("secret"),
  declaredType: declaredTypeValidator,
  value: v.string(),
});

const decryptedScheduleUpdateAbRollValidator = v.object({
  id: v.id("projectVariables"),
  name: v.string(),
  visibility: v.union(v.literal("private"), v.literal("public")),
  kind: v.literal("ab_roll"),
  declaredType: declaredTypeValidator,
  valueA: v.string(),
  valueB: v.string(),
  chance: v.number(),
});

const decryptedScheduleUpdateRolloutValidator = v.object({
  id: v.id("projectVariables"),
  name: v.string(),
  visibility: v.union(v.literal("private"), v.literal("public")),
  kind: v.literal("rollout"),
  declaredType: declaredTypeValidator,
  valueA: v.string(),
  valueB: v.string(),
  rolloutFunction: rolloutFunctionValidator,
  rolloutMilestones: v.array(rolloutMilestoneValidator),
});

export const decryptedScheduleUpdateValidator = v.union(
  decryptedScheduleUpdateSecretValidator,
  decryptedScheduleUpdateAbRollValidator,
  decryptedScheduleUpdateRolloutValidator,
);

export const decryptedScheduleValidator = v.object({
  id: v.id("projectVariableSchedules"),
  stageSlug: v.string(),
  timezone: v.string(),
  runAtMs: v.number(),
  status: projectVariableScheduleStatusValidator,
  creates: v.array(projectVariableScheduleCreateEntryValidator),
  updates: v.array(decryptedScheduleUpdateValidator),
});

export const scheduleExecutionRowValidator = v.union(
  v.object({
    scheduleId: v.id("projectVariableSchedules"),
    projectId: v.id("projects"),
    orgSlug: v.string(),
    projectSlug: v.string(),
    orgId: v.string(),
    stageSlug: v.string(),
    timezone: v.string(),
    runAtMs: v.number(),
    createdCount: v.number(),
    updatedCount: v.number(),
    preparedCreates: v.array(projectVariablePreparedCreateValidator),
    preparedUpdates: v.array(projectVariablePreparedUpdateValidator),
    updateTargets: v.array(
      v.object({
        id: v.id("projectVariables"),
        name: v.string(),
      }),
    ),
    status: projectVariableScheduleStatusValidator,
  }),
  v.null(),
);

/**
 * Validates and normalizes a timezone identifier.
 *
 * @param value The timezone identifier supplied by the caller.
 * @returns The trimmed timezone identifier.
 * @remarks This throws when the timezone is blank or not recognized by `Intl.DateTimeFormat`.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function validateTimeZone(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error("Timezone is required.");
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed }).format(new Date());
  } catch {
    throw new Error("Timezone is invalid.");
  }

  return trimmed;
}

/**
 * Validates that a scheduled run time is a finite timestamp in the future.
 *
 * @param value The timestamp in milliseconds supplied by the caller.
 * @returns The normalized integer millisecond timestamp.
 * @remarks This throws when the timestamp is invalid or not strictly in the future.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function validateRunAtMs(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("Schedule time is invalid.");
  }

  const runAtMs = Math.trunc(value);
  if (runAtMs <= Date.now()) {
    throw new Error("Schedule time must be in the future.");
  }

  return runAtMs;
}
