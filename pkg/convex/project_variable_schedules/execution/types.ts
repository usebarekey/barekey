import type { Id } from "../../_generated/dataModel";
import type {
  ProjectVariablePreparedCreateEntry,
  ProjectVariablePreparedUpdateEntry,
} from "../../lib/project_variables/schedules";

export type GetScheduleForExecutionArgs = {
  scheduleId: Id<"projectVariableSchedules">;
};

export type MarkScheduleAppliedArgs = {
  scheduleId: Id<"projectVariableSchedules">;
};

export type MarkScheduleFailedArgs = {
  scheduleId: Id<"projectVariableSchedules">;
  failureMessage: string;
};

export type ScheduleExecutionRow = {
  scheduleId: Id<"projectVariableSchedules">;
  projectId: Id<"projects">;
  orgSlug: string;
  projectSlug: string;
  orgId: string;
  stageSlug: string;
  timezone: string;
  runAtMs: number;
  createdCount: number;
  updatedCount: number;
  preparedCreates: Array<ProjectVariablePreparedCreateEntry>;
  preparedUpdates: Array<ProjectVariablePreparedUpdateEntry>;
  updateTargets: Array<{
    id: Id<"projectVariables">;
    name: string;
  }>;
  status: "scheduled" | "applied" | "failed" | "canceled";
};
