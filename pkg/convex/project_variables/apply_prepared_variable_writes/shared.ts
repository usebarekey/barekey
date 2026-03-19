import { v } from "convex/values";

import type { Id } from "../../_generated/dataModel";
import {
  projectVariablePreparedCreateValidator as preparedWriteCreateValidator,
  projectVariablePreparedUpdateValidator as preparedWriteUpdateValidator,
} from "../../lib/project_variables/schedules";

export type MeasurePreparedVariableWritesArgs = {
  orgId: string;
  projectSlug: string;
  stageSlug: string;
  creates: Array<any>;
  updates: Array<any>;
  deletes: Array<Id<"projectVariables">>;
};

export type ApplyPreparedVariableWritesArgs = {
  orgId: string;
  clerkUserId: string;
  projectSlug: string;
  stageSlug: string;
  creates: Array<any>;
  updates: Array<any>;
  deletes: Array<Id<"projectVariables">>;
};

export const measurePreparedVariableWritesArgs = {
  orgId: v.string(),
  projectSlug: v.string(),
  stageSlug: v.string(),
  creates: v.array(preparedWriteCreateValidator),
  updates: v.array(preparedWriteUpdateValidator),
  deletes: v.array(v.id("projectVariables")),
} as const;

export const applyPreparedVariableWritesArgs = {
  orgId: v.string(),
  clerkUserId: v.string(),
  projectSlug: v.string(),
  stageSlug: v.string(),
  creates: v.array(preparedWriteCreateValidator),
  updates: v.array(preparedWriteUpdateValidator),
  deletes: v.array(v.id("projectVariables")),
} as const;

export const storageDeltaResultValidator = v.object({
  storageDeltaBytes: v.number(),
});

export const writeWithUsageResultValidator = v.object({
  createdCount: v.number(),
  updatedCount: v.number(),
  deletedCount: v.number(),
});
