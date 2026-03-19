import type { Id } from "../../_generated/dataModel";

export type DecryptForCurrentOrgProjectArgs = {
  expectedOrgSlug: string;
  projectSlug: string;
  scheduleId: Id<"projectVariableSchedules">;
};
