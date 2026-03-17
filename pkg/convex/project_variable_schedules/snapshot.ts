import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type {
  ProjectVariablePreparedCreateEntry,
  ProjectVariablePreparedUpdateEntry,
} from "../lib/project_variable_schedules";
import { validateVariableName } from "../lib/project_variables_shared";
import type { DeclaredVariableType } from "../lib/declared_types";
import type { VariableVisibility } from "../lib/visibility";
import type { ScheduledCreateEntry, ScheduledUpdateEntry } from "./types";

/**
 * Builds the prepared encrypted snapshot for a scheduled variable batch.
 *
 * @param input The mutation context plus the org, project, stage, and user-authored create/update entries.
 * @returns The prepared encrypted creates, updates, update target metadata, and counts.
 * @remarks This delegates encryption and normalization to the `project_variables` write-preparation pipeline.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function buildPreparedScheduleSnapshot(input: {
  ctx: MutationCtx;
  orgId: string;
  clerkUserId: string;
  projectSlug: string;
  stageSlug: string;
  creates: Array<ScheduledCreateEntry>;
  updates: Array<ScheduledUpdateEntry>;
}): Promise<{
  preparedCreates: Array<ProjectVariablePreparedCreateEntry>;
  preparedUpdates: Array<ProjectVariablePreparedUpdateEntry>;
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

/**
 * Lists all variable names touched by a scheduled batch in display order.
 *
 * @param input The prepared create entries and update target metadata.
 * @returns The batch variable names in create-then-update order.
 * @remarks This is a pure formatting helper used by schedule summaries.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function scheduleBatchNames(input: {
  creates: Array<{ name: string }>;
  updateTargets: Array<{ name: string }>;
}): Array<string> {
  return [
    ...input.creates.map((entry) => entry.name),
    ...input.updateTargets.map((entry) => entry.name),
  ];
}

/**
 * Builds audit-friendly summary rows for scheduled creates and updates.
 *
 * @param input The prepared create/update entries plus update target name metadata.
 * @returns A normalized list of create/update summary entries.
 * @remarks This is a pure helper used by both user-facing and scheduler-driven audit events.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function summarizeScheduleEntries(input: {
  creates: Array<{
    name: string;
    visibility: VariableVisibility;
    kind: "secret" | "ab_roll" | "rollout";
    declaredType: DeclaredVariableType;
  }>;
  updates: Array<{
    id: Id<"projectVariables">;
    visibility: VariableVisibility;
    kind: "secret" | "ab_roll" | "rollout";
    declaredType: DeclaredVariableType;
  }>;
  updateTargets: Array<{
    id: Id<"projectVariables">;
    name: string;
  }>;
}) {
  const namesById = new Map(input.updateTargets.map((entry) => [entry.id, entry.name] as const));

  return [
    ...input.creates.map((entry) => ({
      operation: "create",
      name: entry.name,
      kind: entry.kind,
      visibility: entry.visibility,
      declaredType: entry.declaredType,
    })),
    ...input.updates.map((entry) => ({
      operation: "update",
      name: namesById.get(entry.id) ?? "unknown",
      kind: entry.kind,
      visibility: entry.visibility,
      declaredType: entry.declaredType,
    })),
  ];
}

/**
 * Maps a persisted schedule row into the public summary shape used by list and
 * create/update responses.
 *
 * @param input The normalized schedule summary fields.
 * @returns The serialized schedule summary payload.
 * @remarks This is a pure formatter and does not query or mutate Convex state.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function toScheduledScheduleSummary(input: {
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

/**
 * Stores a scheduler function ID only if the schedule is still pending.
 *
 * @param input The mutation context, schedule ID, and scheduled function ID to attach.
 * @returns The latest persisted schedule row after the conditional patch, or `null` if the schedule no longer exists.
 * @remarks This guards against a race where the scheduled action fires before we persist the returned scheduler handle.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function attachScheduledFunctionIdIfStillPending(input: {
  ctx: MutationCtx;
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
