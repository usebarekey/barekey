import { Effect } from "effect";
import { v } from "convex/values";

import {
  declaredTypeValidator,
} from "../lib/declared/types";
import { ValidationError } from "../lib/errors/effect";
import {
  projectVariablePreparedCreateValidator,
  projectVariablePreparedUpdateValidator,
  projectVariableScheduleCreateEntryValidator,
  projectVariableScheduleStatusValidator,
  projectVariableScheduleUpdateEntryValidator,
} from "../lib/project_variables/schedules";
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
 * Converts a typed schedule validation error back into a standard `Error` for
 * legacy callers.
 *
 * @param error The typed validation error.
 * @returns A standard `Error` carrying the same message.
 * @remarks This compatibility helper should disappear as schedule callers move to Effect-native validators.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function toThrownScheduleValidationError(error: ValidationError): Error {
  return new Error(error.message);
}

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
  return Effect.runSync(
    validateTimeZoneEffect(value).pipe(
      Effect.mapError(toThrownScheduleValidationError),
    ),
  );
}

/**
 * Validates and normalizes a timezone identifier.
 *
 * @param value The timezone identifier supplied by the caller.
 * @returns An Effect that yields the trimmed timezone identifier.
 * @remarks This is the Effect-native validation path for scheduled run timezones.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function validateTimeZoneEffect(
  value: string,
): Effect.Effect<string, ValidationError> {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return Effect.fail(new ValidationError({ message: "Timezone is required." }));
  }

  return Effect.try({
    try: () => {
      new Intl.DateTimeFormat("en-US", { timeZone: trimmed }).format(new Date());
      return trimmed;
    },
    catch: () => new ValidationError({ message: "Timezone is invalid." }),
  });
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
  return Effect.runSync(
    validateRunAtMsEffect(value).pipe(
      Effect.mapError(toThrownScheduleValidationError),
    ),
  );
}

/**
 * Validates that a scheduled run time is a finite timestamp in the future.
 *
 * @param value The timestamp in milliseconds supplied by the caller.
 * @returns An Effect that yields the normalized integer millisecond timestamp.
 * @remarks This is the Effect-native validation path for schedule execution times.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function validateRunAtMsEffect(
  value: number,
): Effect.Effect<number, ValidationError> {
  if (!Number.isFinite(value)) {
    return Effect.fail(new ValidationError({ message: "Schedule time is invalid." }));
  }

  const runAtMs = Math.trunc(value);
  if (runAtMs <= Date.now()) {
    return Effect.fail(
      new ValidationError({ message: "Schedule time must be in the future." }),
    );
  }

  return Effect.succeed(runAtMs);
}
