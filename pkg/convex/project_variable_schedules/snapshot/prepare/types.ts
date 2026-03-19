import type { MutationCtx } from "../../../_generated/server";
import type { Id } from "../../../_generated/dataModel";
import type {
  ProjectVariablePreparedCreateEntry,
  ProjectVariablePreparedUpdateEntry,
} from "../../../lib/project_variables/schedules";
import type { ScheduledCreateEntry, ScheduledUpdateEntry } from "../../types";

export type BuildPreparedScheduleSnapshotInput = {
  ctx: MutationCtx;
  orgId: string;
  clerkUserId: string;
  projectSlug: string;
  stageSlug: string;
  creates: Array<ScheduledCreateEntry>;
  updates: Array<ScheduledUpdateEntry>;
};

export type PreparedScheduleSnapshot = {
  preparedCreates: Array<ProjectVariablePreparedCreateEntry>;
  preparedUpdates: Array<ProjectVariablePreparedUpdateEntry>;
  updateTargets: Array<{
    id: Id<"projectVariables">;
    name: string;
  }>;
  createdCount: number;
  updatedCount: number;
};
