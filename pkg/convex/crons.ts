import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("prune expired audit events", { hours: 24 }, internal.audit.pruneExpiredEventsInternal);

export default crons;
