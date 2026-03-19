import { v } from "convex/values";

import type { Id } from "../../_generated/dataModel";
import {
  fallbackDeclaredType,
  type DeclaredVariableType,
  declaredTypeValidator,
} from "../declared/types";
import {
  type RolloutFunction,
  type RolloutMilestone,
  validateRolloutMilestones,
} from "../rollout";
import { getVariableVisibility, type VariableVisibility } from "../visibility";
import {
  variableKindValidator,
  variableMetadataValidator,
  variableVisibilityValidator,
} from "./contracts";
import { validateChance } from "./validation";

export type VariableStorageRow = {
  _id: Id<"projectVariables">;
  projectId: Id<"projects">;
  orgId: string;
  stageSlug: string;
  name: string;
  visibility?: VariableVisibility | null;
  kind: "secret" | "ab_roll" | "rollout";
  declaredType?: string | null;
  createdAtMs: number;
  updatedAtMs: number;
  chance?: number | null;
  rolloutFunction?: RolloutFunction | null;
  rolloutMilestones?: Array<RolloutMilestone> | null;
};

/**
 * Reads the declared variable type from a row while preserving the repo fallback behavior.
 *
 * @param input The persisted row or partial row carrying the optional declared type column.
 * @returns The normalized declared variable type.
 * @remarks This applies the legacy fallback when the column is absent or null.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function getRowDeclaredType(input: {
  declaredType?: string | null;
}): DeclaredVariableType {
  return fallbackDeclaredType(input.declaredType);
}

export const variableResolverRowValidator = v.object({
  id: v.id("projectVariables"),
  projectId: v.id("projects"),
  orgId: v.string(),
  stageSlug: v.string(),
  name: v.string(),
  visibility: variableVisibilityValidator,
  kind: variableKindValidator,
  declaredType: declaredTypeValidator,
});

/**
 * Maps a stored variable row into the resolver shape used by env evaluation flows.
 *
 * @param row The persisted variable row.
 * @returns The normalized resolver row payload.
 * @remarks This never includes encrypted payload columns and only exposes metadata required for later decryption/resolution.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function mapVariableResolverRow(row: VariableStorageRow) {
  return {
    id: row._id,
    projectId: row.projectId,
    orgId: row.orgId,
    stageSlug: row.stageSlug,
    name: row.name,
    visibility: getVariableVisibility(row),
    kind: row.kind,
    declaredType: getRowDeclaredType(row),
  };
}

/**
 * Maps a stored variable row into the metadata payload returned by UI, CLI, and HTTP listing flows.
 *
 * @param row The persisted variable row.
 * @returns The normalized metadata payload matching the row kind.
 * @remarks This validates A/B chance values and rollout milestone arrays before they cross the boundary layer.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function mapVariableMetadataRow(row: VariableStorageRow) {
  const visibility = getVariableVisibility(row);
  if (row.kind === "secret") {
    return {
      id: row._id,
      projectId: row.projectId,
      orgId: row.orgId,
      stageSlug: row.stageSlug,
      name: row.name,
      visibility,
      kind: "secret" as const,
      declaredType: getRowDeclaredType(row),
      createdAtMs: row.createdAtMs,
      updatedAtMs: row.updatedAtMs,
      chance: null,
      rolloutFunction: null,
      rolloutMilestones: null,
    };
  }

  if (row.kind === "ab_roll") {
    return {
      id: row._id,
      projectId: row.projectId,
      orgId: row.orgId,
      stageSlug: row.stageSlug,
      name: row.name,
      visibility,
      kind: "ab_roll" as const,
      declaredType: getRowDeclaredType(row),
      createdAtMs: row.createdAtMs,
      updatedAtMs: row.updatedAtMs,
      chance: validateChance(row.chance ?? 0),
      rolloutFunction: null,
      rolloutMilestones: null,
    };
  }

  return {
    id: row._id,
    projectId: row.projectId,
    orgId: row.orgId,
    stageSlug: row.stageSlug,
    name: row.name,
    visibility,
    kind: "rollout" as const,
    declaredType: getRowDeclaredType(row),
    createdAtMs: row.createdAtMs,
    updatedAtMs: row.updatedAtMs,
    chance: null,
    rolloutFunction: row.rolloutFunction ?? "linear",
    rolloutMilestones:
      row.rolloutMilestones && row.rolloutMilestones.length > 0
        ? validateRolloutMilestones(row.rolloutMilestones)
        : [],
  };
}

export { variableMetadataValidator };
