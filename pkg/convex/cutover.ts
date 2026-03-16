import { v } from "convex/values";

import { internalMutation } from "./confect";

/**
 * One-time cutover helper for destructive encryption migrations.
 *
 * This removes only the data whose ciphertext/wrapping format changed:
 * project variable payloads, wrapped DEKs, scheduled variable writes, and the
 * mirrored encrypted-byte counters derived from those records.
 */
export const wipeEncryptedDataInternal = internalMutation({
  args: {
    confirm: v.literal("wipe_encrypted_data"),
  },
  returns: v.object({
    projectKeyCount: v.number(),
    projectVariableCount: v.number(),
    projectVariableScheduleCount: v.number(),
    orgStorageUsageCount: v.number(),
    cancelledScheduledFunctionCount: v.number(),
    completedAtMs: v.number(),
  }),
  handler: async (ctx) => {
    const schedules = await ctx.db.query("projectVariableSchedules").collect();
    let cancelledScheduledFunctionCount = 0;
    for (const schedule of schedules) {
      if (schedule.scheduledFunctionId !== null) {
        try {
          await ctx.scheduler.cancel(schedule.scheduledFunctionId);
          cancelledScheduledFunctionCount += 1;
        } catch (error) {
          console.error("Failed to cancel scheduled variable write during cutover.", {
            error,
            scheduleId: String(schedule._id),
            scheduledFunctionId: String(schedule.scheduledFunctionId),
          });
        }
      }
    }

    const projectVariables = await ctx.db.query("projectVariables").collect();
    const projectKeys = await ctx.db.query("projectKeys").collect();
    const orgStorageUsageRows = await ctx.db.query("orgStorageUsage").collect();

    for (const schedule of schedules) {
      await ctx.db.delete(schedule._id);
    }
    for (const row of projectVariables) {
      await ctx.db.delete(row._id);
    }
    for (const row of projectKeys) {
      await ctx.db.delete(row._id);
    }
    for (const row of orgStorageUsageRows) {
      await ctx.db.delete(row._id);
    }

    return {
      projectKeyCount: projectKeys.length,
      projectVariableCount: projectVariables.length,
      projectVariableScheduleCount: schedules.length,
      orgStorageUsageCount: orgStorageUsageRows.length,
      cancelledScheduledFunctionCount,
      completedAtMs: Date.now(),
    };
  },
});
