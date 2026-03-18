import { makeFunctionReference } from "convex/server";

export const executeScheduledVariableScheduleInternalReference = makeFunctionReference(
  "project_variable_schedules:executeScheduledVariableScheduleInternal",
) as any;

export const getScheduleForExecutionInternalReference = makeFunctionReference(
  "project_variable_schedules:getScheduleForExecutionInternal",
) as any;

export const markScheduleAppliedInternalReference = makeFunctionReference(
  "project_variable_schedules:markScheduleAppliedInternal",
) as any;

export const markScheduleFailedInternalReference = makeFunctionReference(
  "project_variable_schedules:markScheduleFailedInternal",
) as any;
