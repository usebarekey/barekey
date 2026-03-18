import { v } from "convex/values";

import {
  effectInternalAction,
  effectInternalMutation,
  effectInternalQuery,
} from "../confect";
import { getScheduleForExecutionInternalEffect } from "./execution/load";
import { executeScheduledVariableScheduleInternalEffect } from "./execution/run";
import {
  markScheduleAppliedInternalEffect,
  markScheduleFailedInternalEffect,
} from "./execution/status";
import type {
  GetScheduleForExecutionArgs,
  MarkScheduleAppliedArgs,
  MarkScheduleFailedArgs,
  ScheduleExecutionRow,
} from "./execution/types";
import { scheduleExecutionRowValidator } from "./validators";

/**
 * Loads the data needed by the scheduler to execute a pending variable batch.
 *
 * @param ctx The Convex internal query context.
 * @param args The schedule identifier to load.
 * @returns The execution payload for the schedule, or `null` when it no longer exists.
 * @remarks This joins the schedule row with the owning project so scheduler actions do not need extra lookups.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const getScheduleForExecutionInternal = effectInternalQuery<
  GetScheduleForExecutionArgs,
  ScheduleExecutionRow | null,
  any
>({
  args: {
    scheduleId: v.id("projectVariableSchedules"),
  },
  returns: scheduleExecutionRowValidator,
  handler: getScheduleForExecutionInternalEffect,
});

/**
 * Marks a scheduled batch as applied after successful execution.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The schedule identifier to mark applied.
 * @returns `null` after the schedule row is updated.
 * @remarks This clears the scheduler handle and stamps the execution timestamp.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const markScheduleAppliedInternal = effectInternalMutation<
  MarkScheduleAppliedArgs,
  null,
  any
>({
  args: {
    scheduleId: v.id("projectVariableSchedules"),
  },
  returns: v.null(),
  handler: markScheduleAppliedInternalEffect,
});

/**
 * Marks a scheduled batch as failed after unsuccessful execution.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The schedule identifier and failure message.
 * @returns `null` after the schedule row is updated.
 * @remarks This clears the scheduler handle, stamps the failure timestamp, and stores the failure message.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const markScheduleFailedInternal = effectInternalMutation<
  MarkScheduleFailedArgs,
  null,
  any
>({
  args: {
    scheduleId: v.id("projectVariableSchedules"),
    failureMessage: v.string(),
  },
  returns: v.null(),
  handler: markScheduleFailedInternalEffect,
});

/**
 * Executes a pending scheduled variable batch.
 *
 * @param ctx The Convex internal action context.
 * @param args The schedule identifier to execute.
 * @returns `null` after execution or when the schedule is no longer pending.
 * @remarks This delegates actual writes to the prepared variable write pipeline, then appends success or failure audit events.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const executeScheduledVariableScheduleInternal = effectInternalAction<
  GetScheduleForExecutionArgs,
  null,
  any
>({
  args: {
    scheduleId: v.id("projectVariableSchedules"),
  },
  returns: v.null(),
  handler: executeScheduledVariableScheduleInternalEffect,
});
