import type { Id } from "../_generated/dataModel";
import type { DeclaredVariableType } from "../lib/declared/types";
import type { VariableVisibility } from "../lib/visibility";

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
