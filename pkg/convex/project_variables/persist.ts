import { Effect } from "effect";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { dbDeleteEffect, dbInsertEffect, dbPatchEffect } from "../lib/convex/db";
import type { DeclaredVariableType } from "../lib/declared/types";
import type { RolloutFunction, RolloutMilestone } from "../lib/rollout";
import { toProjectVariableExternalServiceError } from "./errors";

type ProjectVariablePersistValues = {
  visibility: "private" | "public";
  kind: "secret" | "ab_roll" | "rollout";
  declaredType: DeclaredVariableType;
  encryptedValue: string | null;
  encryptedValueA: string | null;
  encryptedValueB: string | null;
  chance: number | null;
  rolloutFunction: RolloutFunction | null;
  rolloutMilestones: Array<RolloutMilestone> | null;
};

/**
 * Updates one persisted project variable row.
 *
 * @param ctx The Convex mutation context.
 * @param args The row id, normalized values, and timestamp to persist.
 * @returns An Effect that succeeds when the row patch completes.
 * @remarks This centralizes the shared `projectVariables` patch payload for draft and prepared-write flows.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function patchProjectVariableRowEffect(
  ctx: MutationCtx,
  args: {
    id: Id<"projectVariables">;
    values: ProjectVariablePersistValues;
    updatedAtMs: number;
    failureMessage: string;
  },
) {
  return dbPatchEffect(
    ctx,
    args.id,
    {
      visibility: args.values.visibility,
      kind: args.values.kind,
      declaredType: args.values.declaredType,
      encryptedValue: args.values.encryptedValue,
      encryptedValueA: args.values.encryptedValueA,
      encryptedValueB: args.values.encryptedValueB,
      chance: args.values.chance,
      rolloutFunction: args.values.rolloutFunction,
      rolloutMilestones: args.values.rolloutMilestones,
      updatedAtMs: args.updatedAtMs,
    },
    (error) => toProjectVariableExternalServiceError(args.failureMessage, error),
  );
}

/**
 * Inserts one persisted project variable row.
 *
 * @param ctx The Convex mutation context.
 * @param args The project identity, normalized values, actor, and timestamps to persist.
 * @returns An Effect that succeeds with the inserted row id.
 * @remarks This centralizes the shared `projectVariables` insert payload for draft and prepared-write flows.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function insertProjectVariableRowEffect(
  ctx: MutationCtx,
  args: {
    projectId: Id<"projects">;
    orgId: string;
    stageSlug: string;
    name: string;
    clerkUserId: string;
    values: ProjectVariablePersistValues;
    createdAtMs: number;
    updatedAtMs: number;
    failureMessage: string;
  },
) {
  return dbInsertEffect(
    ctx,
    "projectVariables",
    {
      projectId: args.projectId,
      orgId: args.orgId,
      stageSlug: args.stageSlug,
      name: args.name,
      visibility: args.values.visibility,
      kind: args.values.kind,
      declaredType: args.values.declaredType,
      encryptedValue: args.values.encryptedValue,
      encryptedValueA: args.values.encryptedValueA,
      encryptedValueB: args.values.encryptedValueB,
      chance: args.values.chance,
      rolloutFunction: args.values.rolloutFunction,
      rolloutMilestones: args.values.rolloutMilestones,
      createdByClerkUserId: args.clerkUserId,
      createdAtMs: args.createdAtMs,
      updatedAtMs: args.updatedAtMs,
    },
    (error) => toProjectVariableExternalServiceError(args.failureMessage, error),
  );
}

/**
 * Deletes one persisted project variable row.
 *
 * @param ctx The Convex mutation context.
 * @param args The row id and failure message to use if deletion fails.
 * @returns An Effect that succeeds when the row delete completes.
 * @remarks This keeps delete failure messages consistent across variable-write workflows.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function deleteProjectVariableRowEffect(
  ctx: MutationCtx,
  args: {
    id: Id<"projectVariables">;
    failureMessage: string;
  },
) {
  return dbDeleteEffect(ctx, args.id, (error) =>
    toProjectVariableExternalServiceError(args.failureMessage, error),
  );
}
