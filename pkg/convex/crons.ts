import { cronJobs, makeFunctionReference } from "convex/server";

const crons = cronJobs();
const pruneExpiredAuditEventsInternalReference = makeFunctionReference<
  "action",
  Record<string, never>,
  { deletedCount: number }
>("audit/prune:pruneExpiredEventsInternal");

crons.interval(
  "prune expired audit events",
  { hours: 24 },
  pruneExpiredAuditEventsInternalReference as never,
  {},
);

export default crons;
