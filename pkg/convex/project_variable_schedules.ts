import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import {
  assertExpectedOrgSlug,
  getActiveOrgIdClaimsOrNull,
  requireActiveOrgIdClaims,
  requireIdentity,
} from "./lib/auth";
import { decryptSecretValueForProject } from "./lib/encryption";
import { type DeclaredVariableType } from "./lib/declared_types";
import {
  projectVariablePreparedCreateValidator,
  projectVariablePreparedUpdateValidator,
  projectVariableScheduleCreateEntryValidator,
  projectVariableScheduleStatusValidator,
  projectVariableScheduleUpdateEntryValidator,
} from "./lib/project_variable_schedules";
import { type RolloutFunction, type RolloutMilestone } from "./lib/rollout";
import { type VariableVisibility } from "./lib/visibility";

type ScheduledCreateEntry =
  | {
      name: string;
      visibility: VariableVisibility;
      kind: "secret";
      declaredType: DeclaredVariableType;
      value: string;
    }
  | {
      name: string;
      visibility: VariableVisibility;
      kind: "ab_roll";
      declaredType: DeclaredVariableType;
      valueA: string;
      valueB: string;
      chance: number;
    }
  | {
      name: string;
      visibility: VariableVisibility;
      kind: "rollout";
      declaredType: DeclaredVariableType;
      valueA: string;
      valueB: string;
      rolloutFunction: RolloutFunction;
      rolloutMilestones: Array<RolloutMilestone>;
    };

type ScheduledUpdateEntry =
  | {
      id: Id<"projectVariables">;
      visibility: VariableVisibility;
      kind: "secret";
      declaredType: DeclaredVariableType;
      value: string;
    }
  | {
      id: Id<"projectVariables">;
      visibility: VariableVisibility;
      kind: "ab_roll";
      declaredType: DeclaredVariableType;
      valueA: string;
      valueB: string;
      chance: number;
    }
  | {
      id: Id<"projectVariables">;
      visibility: VariableVisibility;
      kind: "rollout";
      declaredType: DeclaredVariableType;
      valueA: string;
      valueB: string;
      rolloutFunction: RolloutFunction;
      rolloutMilestones: Array<RolloutMilestone>;
    };

const scheduledScheduleSummaryValidator = v.object({
  id: v.id("projectVariableSchedules"),
  stageSlug: v.string(),
  stageName: v.string(),
  timezone: v.string(),
  runAtMs: v.number(),
  status: projectVariableScheduleStatusValidator,
  createdCount: v.number(),
  updatedCount: v.number(),
  batchNames: v.array(v.string()),
  createdAtMs: v.number(),
  updatedAtMs: v.number(),
  executedAtMs: v.union(v.number(), v.null()),
  canceledAtMs: v.union(v.number(), v.null()),
  failedAtMs: v.union(v.number(), v.null()),
  failureMessage: v.union(v.string(), v.null()),
});

const decryptedScheduleUpdateSecretValidator = v.object({
  id: v.id("projectVariables"),
  name: v.string(),
  visibility: v.union(v.literal("private"), v.literal("public")),
  kind: v.literal("secret"),
  declaredType: v.union(
    v.literal("string"),
    v.literal("boolean"),
    v.literal("int64"),
    v.literal("float"),
    v.literal("date"),
    v.literal("json"),
  ),
  value: v.string(),
});

const decryptedScheduleUpdateAbRollValidator = v.object({
  id: v.id("projectVariables"),
  name: v.string(),
  visibility: v.union(v.literal("private"), v.literal("public")),
  kind: v.literal("ab_roll"),
  declaredType: v.union(
    v.literal("string"),
    v.literal("boolean"),
    v.literal("int64"),
    v.literal("float"),
    v.literal("date"),
    v.literal("json"),
  ),
  valueA: v.string(),
  valueB: v.string(),
  chance: v.number(),
});

const decryptedScheduleUpdateRolloutValidator = v.object({
  id: v.id("projectVariables"),
  name: v.string(),
  visibility: v.union(v.literal("private"), v.literal("public")),
  kind: v.literal("rollout"),
  declaredType: v.union(
    v.literal("string"),
    v.literal("boolean"),
    v.literal("int64"),
    v.literal("float"),
    v.literal("date"),
    v.literal("json"),
  ),
  valueA: v.string(),
  valueB: v.string(),
  rolloutFunction: v.union(v.literal("linear"), v.literal("step"), v.literal("ease_in_out")),
  rolloutMilestones: v.array(
    v.object({
      at: v.string(),
      percentage: v.number(),
    }),
  ),
});

const decryptedScheduleUpdateValidator = v.union(
  decryptedScheduleUpdateSecretValidator,
  decryptedScheduleUpdateAbRollValidator,
  decryptedScheduleUpdateRolloutValidator,
);

const decryptedScheduleValidator = v.object({
  id: v.id("projectVariableSchedules"),
  stageSlug: v.string(),
  timezone: v.string(),
  runAtMs: v.number(),
  status: projectVariableScheduleStatusValidator,
  creates: v.array(projectVariableScheduleCreateEntryValidator),
  updates: v.array(decryptedScheduleUpdateValidator),
});

function validateVariableName(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error("Variable name is required.");
  }
  if (trimmed.length > 160) {
    throw new Error("Variable name must be 160 characters or fewer.");
  }
  return trimmed;
}

function validateTimeZone(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error("Timezone is required.");
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed }).format(new Date());
  } catch {
    throw new Error("Timezone is invalid.");
  }

  return trimmed;
}

function validateRunAtMs(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("Schedule time is invalid.");
  }
  return Math.trunc(value);
}

async function buildPreparedScheduleSnapshot(input: {
  ctx: Parameters<typeof action>[0]["handler"] extends (ctx: infer T, args: never) => unknown
    ? T
    : never;
  orgId: string;
  clerkUserId: string;
  projectSlug: string;
  stageSlug: string;
  creates: Array<ScheduledCreateEntry>;
  updates: Array<ScheduledUpdateEntry>;
}): Promise<{
  preparedCreates: Array<
    (typeof projectVariablePreparedCreateValidator)["type"] extends never ? never : never
  >;
  preparedUpdates: Array<
    (typeof projectVariablePreparedUpdateValidator)["type"] extends never ? never : never
  >;
  updateTargets: Array<{
    id: Id<"projectVariables">;
    name: string;
  }>;
  createdCount: number;
  updatedCount: number;
}> {
  const existingRows: Array<{
    id: Id<"projectVariables">;
    name: string;
  }> = await input.ctx.runQuery(
    internal.project_variables.listVariableMetadataForOrgProjectStageInternal,
    {
      orgId: input.orgId,
      projectSlug: input.projectSlug,
      stageSlug: input.stageSlug,
    },
  );
  const existingById = new Map(existingRows.map((row) => [row.id, row] as const));
  const existingNames = new Set(existingRows.map((row) => row.name));

  const entries: Array<ScheduledCreateEntry> = [];
  const updateTargets: Array<{
    id: Id<"projectVariables">;
    name: string;
  }> = [];

  for (const create of input.creates) {
    const normalizedName = validateVariableName(create.name);
    if (existingNames.has(normalizedName)) {
      throw new Error(`Variable ${normalizedName} already exists in this stage.`);
    }
    entries.push({
      ...create,
      name: normalizedName,
    });
  }

  for (const update of input.updates) {
    const existing = existingById.get(update.id);
    if (existing === undefined) {
      throw new Error("Variable update target does not exist.");
    }

    updateTargets.push({
      id: update.id,
      name: existing.name,
    });

    if (update.kind === "secret") {
      entries.push({
        name: existing.name,
        visibility: update.visibility,
        kind: "secret",
        declaredType: update.declaredType,
        value: update.value,
      });
      continue;
    }

    if (update.kind === "ab_roll") {
      entries.push({
        name: existing.name,
        visibility: update.visibility,
        kind: "ab_roll",
        declaredType: update.declaredType,
        valueA: update.valueA,
        valueB: update.valueB,
        chance: update.chance,
      });
      continue;
    }

    entries.push({
      name: existing.name,
      visibility: update.visibility,
      kind: "rollout",
      declaredType: update.declaredType,
      valueA: update.valueA,
      valueB: update.valueB,
      rolloutFunction: update.rolloutFunction,
      rolloutMilestones: update.rolloutMilestones,
    });
  }

  const prepared = await input.ctx.runMutation(
    internal.project_variables.prepareVariableWritesForOrgProjectStageInternal,
    {
      orgId: input.orgId,
      clerkUserId: input.clerkUserId,
      projectSlug: input.projectSlug,
      stageSlug: input.stageSlug,
      mode: "upsert",
      entries,
      deletes: [],
    },
  );

  return {
    preparedCreates: prepared.creates,
    preparedUpdates: prepared.updates,
    updateTargets,
    createdCount: prepared.createdCount,
    updatedCount: prepared.updatedCount,
  };
}

function scheduleBatchNames(input: {
  creates: Array<{ name: string }>;
  updateTargets: Array<{ name: string }>;
}): Array<string> {
  return [
    ...input.creates.map((entry) => entry.name),
    ...input.updateTargets.map((entry) => entry.name),
  ];
}

function toScheduledScheduleSummary(input: {
  id: Id<"projectVariableSchedules">;
  stageSlug: string;
  stageName: string;
  timezone: string;
  runAtMs: number;
  status: "scheduled" | "applied" | "failed" | "canceled";
  createdCount: number;
  updatedCount: number;
  batchNames: Array<string>;
  createdAtMs: number;
  updatedAtMs: number;
  executedAtMs: number | null;
  canceledAtMs: number | null;
  failedAtMs: number | null;
  failureMessage: string | null;
}) {
  return {
    id: input.id,
    stageSlug: input.stageSlug,
    stageName: input.stageName,
    timezone: input.timezone,
    runAtMs: input.runAtMs,
    status: input.status,
    createdCount: input.createdCount,
    updatedCount: input.updatedCount,
    batchNames: input.batchNames,
    createdAtMs: input.createdAtMs,
    updatedAtMs: input.updatedAtMs,
    executedAtMs: input.executedAtMs,
    canceledAtMs: input.canceledAtMs,
    failedAtMs: input.failedAtMs,
    failureMessage: input.failureMessage,
  };
}

async function attachScheduledFunctionIdIfStillPending(input: {
  ctx: Parameters<typeof mutation>[0]["handler"] extends (ctx: infer T, args: never) => unknown
    ? T
    : never;
  scheduleId: Id<"projectVariableSchedules">;
  scheduledFunctionId: Id<"_scheduled_functions">;
}) {
  const latest = await input.ctx.db.get(input.scheduleId);
  if (latest === null || latest.status !== "scheduled") {
    return latest;
  }

  await input.ctx.db.patch(input.scheduleId, {
    scheduledFunctionId: input.scheduledFunctionId,
  });

  return await input.ctx.db.get(input.scheduleId);
}

export const listForCurrentOrgProject = query({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
  },
  returns: v.array(scheduledScheduleSummaryValidator),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return [];
    }

    const activeOrg = getActiveOrgIdClaimsOrNull(identity);
    if (activeOrg === null) {
      return [];
    }

    if (activeOrg.orgSlug !== null && activeOrg.orgSlug !== args.expectedOrgSlug) {
      return [];
    }

    const project = await ctx.db
      .query("projects")
      .withIndex("by_org_id_and_slug", (q) =>
        q.eq("orgId", activeOrg.orgId).eq("slug", args.projectSlug),
      )
      .unique();
    if (project === null) {
      return [];
    }

    const [rows, stages] = await Promise.all([
      ctx.db
        .query("projectVariableSchedules")
        .withIndex("by_project_id_and_run_at_ms", (q) => q.eq("projectId", project._id))
        .collect(),
      ctx.db
        .query("projectStages")
        .withIndex("by_project_id", (q) => q.eq("projectId", project._id))
        .collect(),
    ]);

    const stageNames = new Map(stages.map((stage) => [stage.slug, stage.name] as const));
    return rows
      .map((row) =>
        toScheduledScheduleSummary({
          id: row._id,
          stageSlug: row.stageSlug,
          stageName: stageNames.get(row.stageSlug) ?? row.stageSlug,
          timezone: row.timezone,
          runAtMs: row.runAtMs,
          status: row.status,
          createdCount: row.createdCount,
          updatedCount: row.updatedCount,
          batchNames: scheduleBatchNames({
            creates: row.preparedCreates,
            updateTargets: row.updateTargets,
          }),
          createdAtMs: row.createdAtMs,
          updatedAtMs: row.updatedAtMs,
          executedAtMs: row.executedAtMs,
          canceledAtMs: row.canceledAtMs,
          failedAtMs: row.failedAtMs,
          failureMessage: row.failureMessage,
        }),
      )
      .sort((left, right) => left.runAtMs - right.runAtMs);
  },
});

export const decryptForCurrentOrgProject = mutation({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
    scheduleId: v.id("projectVariableSchedules"),
  },
  returns: decryptedScheduleValidator,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    const project = await ctx.db
      .query("projects")
      .withIndex("by_org_id_and_slug", (q) =>
        q.eq("orgId", activeOrg.orgId).eq("slug", args.projectSlug),
      )
      .unique();
    if (project === null) {
      throw new Error("Project not found.");
    }

    const schedule = await ctx.db.get(args.scheduleId);
    if (schedule === null || schedule.projectId !== project._id) {
      throw new Error("Scheduled update not found.");
    }

    const updatesById = new Map(
      schedule.updateTargets.map((entry) => [entry.id, entry.name] as const),
    );

    const creates = await Promise.all(
      schedule.preparedCreates.map(async (entry) => {
        if (entry.kind === "secret") {
          const value = await decryptSecretValueForProject(ctx, {
            projectId: project._id,
            orgId: project.orgId,
            ciphertext: entry.encryptedValue,
          });
          return {
            name: entry.name,
            visibility: entry.visibility,
            kind: "secret" as const,
            declaredType: entry.declaredType,
            value,
          };
        }

        const valueA = await decryptSecretValueForProject(ctx, {
          projectId: project._id,
          orgId: project.orgId,
          ciphertext: entry.encryptedValueA,
        });
        const valueB = await decryptSecretValueForProject(ctx, {
          projectId: project._id,
          orgId: project.orgId,
          ciphertext: entry.encryptedValueB,
        });

        if (entry.kind === "ab_roll") {
          return {
            name: entry.name,
            visibility: entry.visibility,
            kind: "ab_roll" as const,
            declaredType: entry.declaredType,
            valueA,
            valueB,
            chance: entry.chance,
          };
        }

        return {
          name: entry.name,
          visibility: entry.visibility,
          kind: "rollout" as const,
          declaredType: entry.declaredType,
          valueA,
          valueB,
          rolloutFunction: entry.rolloutFunction,
          rolloutMilestones: entry.rolloutMilestones,
        };
      }),
    );

    const updates = await Promise.all(
      schedule.preparedUpdates.map(async (entry) => {
        const name = updatesById.get(entry.id);
        if (name === undefined) {
          throw new Error("Scheduled update metadata is corrupted.");
        }

        if (entry.kind === "secret") {
          const value = await decryptSecretValueForProject(ctx, {
            projectId: project._id,
            orgId: project.orgId,
            ciphertext: entry.encryptedValue,
          });
          return {
            id: entry.id,
            name,
            visibility: entry.visibility,
            kind: "secret" as const,
            declaredType: entry.declaredType,
            value,
          };
        }

        const valueA = await decryptSecretValueForProject(ctx, {
          projectId: project._id,
          orgId: project.orgId,
          ciphertext: entry.encryptedValueA,
        });
        const valueB = await decryptSecretValueForProject(ctx, {
          projectId: project._id,
          orgId: project.orgId,
          ciphertext: entry.encryptedValueB,
        });

        if (entry.kind === "ab_roll") {
          return {
            id: entry.id,
            name,
            visibility: entry.visibility,
            kind: "ab_roll" as const,
            declaredType: entry.declaredType,
            valueA,
            valueB,
            chance: entry.chance,
          };
        }

        return {
          id: entry.id,
          name,
          visibility: entry.visibility,
          kind: "rollout" as const,
          declaredType: entry.declaredType,
          valueA,
          valueB,
          rolloutFunction: entry.rolloutFunction,
          rolloutMilestones: entry.rolloutMilestones,
        };
      }),
    );

    return {
      id: schedule._id,
      stageSlug: schedule.stageSlug,
      timezone: schedule.timezone,
      runAtMs: schedule.runAtMs,
      status: schedule.status,
      creates,
      updates,
    };
  },
});

export const createForCurrentOrgProject = mutation({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
    stageSlug: v.string(),
    timezone: v.string(),
    runAtMs: v.number(),
    creates: v.array(projectVariableScheduleCreateEntryValidator),
    updates: v.array(projectVariableScheduleUpdateEntryValidator),
  },
  returns: scheduledScheduleSummaryValidator,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    const project = await ctx.db
      .query("projects")
      .withIndex("by_org_id_and_slug", (q) =>
        q.eq("orgId", activeOrg.orgId).eq("slug", args.projectSlug),
      )
      .unique();
    if (project === null) {
      throw new Error("Project not found.");
    }

    const stage = await ctx.db
      .query("projectStages")
      .withIndex("by_project_id_and_slug", (q) =>
        q.eq("projectId", project._id).eq("slug", args.stageSlug),
      )
      .unique();
    if (stage === null) {
      throw new Error("Stage not found.");
    }

    const timezone = validateTimeZone(args.timezone);
    const runAtMs = validateRunAtMs(args.runAtMs);
    const now = Date.now();

    const snapshot = await buildPreparedScheduleSnapshot({
      ctx,
      orgId: activeOrg.orgId,
      clerkUserId: activeOrg.clerkUserId,
      projectSlug: args.projectSlug,
      stageSlug: stage.slug,
      creates: args.creates as Array<ScheduledCreateEntry>,
      updates: args.updates as Array<ScheduledUpdateEntry>,
    });

    const scheduleId = await ctx.db.insert("projectVariableSchedules", {
      projectId: project._id,
      orgId: activeOrg.orgId,
      stageSlug: stage.slug,
      timezone,
      runAtMs,
      status: "scheduled",
      scheduledFunctionId: null,
      preparedCreates: snapshot.preparedCreates,
      preparedUpdates: snapshot.preparedUpdates,
      updateTargets: snapshot.updateTargets,
      createdCount: snapshot.createdCount,
      updatedCount: snapshot.updatedCount,
      createdByClerkUserId: activeOrg.clerkUserId,
      updatedByClerkUserId: activeOrg.clerkUserId,
      createdAtMs: now,
      updatedAtMs: now,
      executedAtMs: null,
      canceledAtMs: null,
      failedAtMs: null,
      failureMessage: null,
    });

    const scheduledFunctionId = await ctx.scheduler.runAt(
      runAtMs,
      internal.project_variable_schedules.executeScheduledVariableScheduleInternal,
      {
        scheduleId,
      },
    );

    const persistedSchedule = await attachScheduledFunctionIdIfStillPending({
      ctx,
      scheduleId,
      scheduledFunctionId,
    });
    const currentSchedule = persistedSchedule ?? (await ctx.db.get(scheduleId));
    const currentStatus = currentSchedule?.status ?? "scheduled";
    const currentExecutedAtMs = currentSchedule?.executedAtMs ?? null;
    const currentCanceledAtMs = currentSchedule?.canceledAtMs ?? null;
    const currentFailedAtMs = currentSchedule?.failedAtMs ?? null;
    const currentFailureMessage = currentSchedule?.failureMessage ?? null;

    return toScheduledScheduleSummary({
      id: scheduleId,
      stageSlug: stage.slug,
      stageName: stage.name,
      timezone,
      runAtMs,
      status: currentStatus,
      createdCount: snapshot.createdCount,
      updatedCount: snapshot.updatedCount,
      batchNames: scheduleBatchNames({
        creates: snapshot.preparedCreates,
        updateTargets: snapshot.updateTargets,
      }),
      createdAtMs: now,
      updatedAtMs: now,
      executedAtMs: currentExecutedAtMs,
      canceledAtMs: currentCanceledAtMs,
      failedAtMs: currentFailedAtMs,
      failureMessage: currentFailureMessage,
    });
  },
});

export const updateForCurrentOrgProject = mutation({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
    scheduleId: v.id("projectVariableSchedules"),
    stageSlug: v.string(),
    timezone: v.string(),
    runAtMs: v.number(),
    creates: v.array(projectVariableScheduleCreateEntryValidator),
    updates: v.array(projectVariableScheduleUpdateEntryValidator),
  },
  returns: scheduledScheduleSummaryValidator,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    const project = await ctx.db
      .query("projects")
      .withIndex("by_org_id_and_slug", (q) =>
        q.eq("orgId", activeOrg.orgId).eq("slug", args.projectSlug),
      )
      .unique();
    if (project === null) {
      throw new Error("Project not found.");
    }

    const existingSchedule = await ctx.db.get(args.scheduleId);
    if (existingSchedule === null || existingSchedule.projectId !== project._id) {
      throw new Error("Scheduled update not found.");
    }
    if (existingSchedule.status !== "scheduled") {
      throw new Error("Only scheduled updates can be edited.");
    }

    const stage = await ctx.db
      .query("projectStages")
      .withIndex("by_project_id_and_slug", (q) =>
        q.eq("projectId", project._id).eq("slug", args.stageSlug),
      )
      .unique();
    if (stage === null) {
      throw new Error("Stage not found.");
    }

    const timezone = validateTimeZone(args.timezone);
    const runAtMs = validateRunAtMs(args.runAtMs);
    const snapshot = await buildPreparedScheduleSnapshot({
      ctx,
      orgId: activeOrg.orgId,
      clerkUserId: activeOrg.clerkUserId,
      projectSlug: args.projectSlug,
      stageSlug: stage.slug,
      creates: args.creates as Array<ScheduledCreateEntry>,
      updates: args.updates as Array<ScheduledUpdateEntry>,
    });

    if (existingSchedule.scheduledFunctionId !== null) {
      await ctx.scheduler.cancel(existingSchedule.scheduledFunctionId);
    }

    const scheduledFunctionId = await ctx.scheduler.runAt(
      runAtMs,
      internal.project_variable_schedules.executeScheduledVariableScheduleInternal,
      {
        scheduleId: existingSchedule._id,
      },
    );

    const updatedAtMs = Date.now();
    await ctx.db.patch(existingSchedule._id, {
      stageSlug: stage.slug,
      timezone,
      runAtMs,
      status: "scheduled",
      scheduledFunctionId: null,
      preparedCreates: snapshot.preparedCreates,
      preparedUpdates: snapshot.preparedUpdates,
      updateTargets: snapshot.updateTargets,
      createdCount: snapshot.createdCount,
      updatedCount: snapshot.updatedCount,
      updatedByClerkUserId: activeOrg.clerkUserId,
      updatedAtMs,
      executedAtMs: null,
      canceledAtMs: null,
      failedAtMs: null,
      failureMessage: null,
    });
    const persistedSchedule = await attachScheduledFunctionIdIfStillPending({
      ctx,
      scheduleId: existingSchedule._id,
      scheduledFunctionId,
    });
    const currentStatus = persistedSchedule?.status ?? "scheduled";
    const currentExecutedAtMs = persistedSchedule?.executedAtMs ?? null;
    const currentCanceledAtMs = persistedSchedule?.canceledAtMs ?? null;
    const currentFailedAtMs = persistedSchedule?.failedAtMs ?? null;
    const currentFailureMessage = persistedSchedule?.failureMessage ?? null;

    return toScheduledScheduleSummary({
      id: existingSchedule._id,
      stageSlug: stage.slug,
      stageName: stage.name,
      timezone,
      runAtMs,
      status: currentStatus,
      createdCount: snapshot.createdCount,
      updatedCount: snapshot.updatedCount,
      batchNames: scheduleBatchNames({
        creates: snapshot.preparedCreates,
        updateTargets: snapshot.updateTargets,
      }),
      createdAtMs: existingSchedule.createdAtMs,
      updatedAtMs,
      executedAtMs: currentExecutedAtMs,
      canceledAtMs: currentCanceledAtMs,
      failedAtMs: currentFailedAtMs,
      failureMessage: currentFailureMessage,
    });
  },
});

export const cancelForCurrentOrgProject = mutation({
  args: {
    expectedOrgSlug: v.string(),
    projectSlug: v.string(),
    scheduleId: v.id("projectVariableSchedules"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    const project = await ctx.db
      .query("projects")
      .withIndex("by_org_id_and_slug", (q) =>
        q.eq("orgId", activeOrg.orgId).eq("slug", args.projectSlug),
      )
      .unique();
    if (project === null) {
      throw new Error("Project not found.");
    }

    const schedule = await ctx.db.get(args.scheduleId);
    if (schedule === null || schedule.projectId !== project._id) {
      throw new Error("Scheduled update not found.");
    }
    if (schedule.status !== "scheduled") {
      throw new Error("Only scheduled updates can be canceled.");
    }

    if (schedule.scheduledFunctionId !== null) {
      await ctx.scheduler.cancel(schedule.scheduledFunctionId);
    }

    const now = Date.now();
    await ctx.db.patch(schedule._id, {
      status: "canceled",
      scheduledFunctionId: null,
      updatedByClerkUserId: activeOrg.clerkUserId,
      updatedAtMs: now,
      canceledAtMs: now,
    });

    return null;
  },
});

const scheduleExecutionRowValidator = v.union(
  v.object({
    scheduleId: v.id("projectVariableSchedules"),
    projectSlug: v.string(),
    orgId: v.string(),
    stageSlug: v.string(),
    preparedCreates: v.array(projectVariablePreparedCreateValidator),
    preparedUpdates: v.array(projectVariablePreparedUpdateValidator),
    status: projectVariableScheduleStatusValidator,
  }),
  v.null(),
);

export const getScheduleForExecutionInternal = internalQuery({
  args: {
    scheduleId: v.id("projectVariableSchedules"),
  },
  returns: scheduleExecutionRowValidator,
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get(args.scheduleId);
    if (schedule === null) {
      return null;
    }

    const project = await ctx.db.get(schedule.projectId);
    if (project === null) {
      return null;
    }

    return {
      scheduleId: schedule._id,
      projectSlug: project.slug,
      orgId: schedule.orgId,
      stageSlug: schedule.stageSlug,
      preparedCreates: schedule.preparedCreates,
      preparedUpdates: schedule.preparedUpdates,
      status: schedule.status,
    };
  },
});

export const markScheduleAppliedInternal = internalMutation({
  args: {
    scheduleId: v.id("projectVariableSchedules"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get(args.scheduleId);
    if (schedule === null) {
      return null;
    }

    const now = Date.now();
    await ctx.db.patch(schedule._id, {
      status: "applied",
      scheduledFunctionId: null,
      updatedAtMs: now,
      executedAtMs: now,
      failedAtMs: null,
      failureMessage: null,
    });
    return null;
  },
});

export const markScheduleFailedInternal = internalMutation({
  args: {
    scheduleId: v.id("projectVariableSchedules"),
    failureMessage: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get(args.scheduleId);
    if (schedule === null) {
      return null;
    }

    const now = Date.now();
    await ctx.db.patch(schedule._id, {
      status: "failed",
      scheduledFunctionId: null,
      updatedAtMs: now,
      failedAtMs: now,
      failureMessage: args.failureMessage,
    });
    return null;
  },
});

export const executeScheduledVariableScheduleInternal = internalAction({
  args: {
    scheduleId: v.id("projectVariableSchedules"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const schedule = await ctx.runQuery(
      internal.project_variable_schedules.getScheduleForExecutionInternal,
      {
        scheduleId: args.scheduleId,
      },
    );
    if (schedule === null || schedule.status !== "scheduled") {
      return null;
    }

    try {
      await ctx.runAction(
        internal.project_variables.applyPreparedVariableWritesForOrgProjectStageWithUsageInternal,
        {
          orgId: schedule.orgId,
          orgSlug: null,
          clerkUserId: "scheduled-system",
          projectSlug: schedule.projectSlug,
          stageSlug: schedule.stageSlug,
          creates: schedule.preparedCreates,
          updates: schedule.preparedUpdates,
          deletes: [],
        },
      );

      await ctx.runMutation(internal.project_variable_schedules.markScheduleAppliedInternal, {
        scheduleId: schedule.scheduleId,
      });
    } catch (error: unknown) {
      const failureMessage = error instanceof Error ? error.message : "Scheduled update failed.";
      await ctx.runMutation(internal.project_variable_schedules.markScheduleFailedInternal, {
        scheduleId: schedule.scheduleId,
        failureMessage,
      });
      throw error;
    }

    return null;
  },
});
