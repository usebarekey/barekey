import {
  ConfectActionCtx,
  ConfectMutationCtx,
  ConfectQueryCtx,
  type ConfectDataModelFromConfectSchemaDefinition,
  defineSchema,
} from "@rjdellecese/confect/server";

import { auditEvents } from "./schema/tables/audit";
import { billingRequestLog, orgBillingSnapshots, orgStorageUsage } from "./schema/tables/billing";
import { cliDeviceCodes, cliSessions } from "./schema/tables/cli";
import {
  projectKeys,
  projects,
  projectStages,
  projectVariables,
  projectVariableSchedules,
} from "./schema/tables/projects";
import { userFreePlanCredits, userPreferences, users } from "./schema/tables/users";

export const confectSchema = defineSchema({
  users,
  userFreePlanCredits,
  userPreferences,
  projects,
  projectStages,
  projectKeys,
  projectVariables,
  projectVariableSchedules,
  orgStorageUsage,
  orgBillingSnapshots,
  billingRequestLog,
  cliDeviceCodes,
  cliSessions,
  auditEvents,
});

export type BarekeyConfectDataModel = ConfectDataModelFromConfectSchemaDefinition<
  typeof confectSchema
>;

export const BarekeyConfectQueryCtx = ConfectQueryCtx<BarekeyConfectDataModel>();
export const BarekeyConfectMutationCtx = ConfectMutationCtx<BarekeyConfectDataModel>();
export const BarekeyConfectActionCtx = ConfectActionCtx<BarekeyConfectDataModel>();
