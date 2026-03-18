import { Effect } from "effect";
import { makeFunctionReference } from "convex/server";

import type { MutationCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import type { VariableMetadataRow } from "../../project_variables/queries";
import type {
  ProjectVariablePreparedCreateEntry,
  ProjectVariablePreparedUpdateEntry,
} from "../../lib/project_variables/schedules";
import { validateVariableName } from "../../lib/project_variables/validation";
import {
  NotFoundError,
  ValidationError,
  type ExternalServiceError,
} from "../../lib/errors/effect";
import type { ScheduledCreateEntry, ScheduledUpdateEntry } from "../types";
import {
  toScheduleSnapshotExternalError,
  toScheduleSnapshotValidationError,
} from "./errors";

const listVariableMetadataForOrgProjectStageInternalReference = makeFunctionReference<
  "query",
  {
    orgId: string;
    projectSlug: string;
    stageSlug: string;
  },
  Array<VariableMetadataRow>
>("project_variables:listVariableMetadataForOrgProjectStageInternal") as any;

const prepareVariableWritesForOrgProjectStageInternalReference = makeFunctionReference<
  "mutation",
  {
    orgId: string;
    clerkUserId: string;
    projectSlug: string;
    stageSlug: string;
    mode: "upsert";
    entries: Array<ScheduledCreateEntry>;
    deletes: Array<string>;
  },
  {
    creates: Array<ProjectVariablePreparedCreateEntry>;
    updates: Array<ProjectVariablePreparedUpdateEntry>;
    createdCount: number;
    updatedCount: number;
  }
>("project_variables:prepareVariableWritesForOrgProjectStageInternal") as any;

type BuildPreparedScheduleSnapshotInput = {
  ctx: MutationCtx;
  orgId: string;
  clerkUserId: string;
  projectSlug: string;
  stageSlug: string;
  creates: Array<ScheduledCreateEntry>;
  updates: Array<ScheduledUpdateEntry>;
};

type PreparedScheduleSnapshot = {
  preparedCreates: Array<ProjectVariablePreparedCreateEntry>;
  preparedUpdates: Array<ProjectVariablePreparedUpdateEntry>;
  updateTargets: Array<{
    id: Id<"projectVariables">;
    name: string;
  }>;
  createdCount: number;
  updatedCount: number;
};

/**
 * Builds the prepared encrypted snapshot for a scheduled variable batch.
 *
 * @param input The mutation context plus the org, project, stage, and user-authored create/update entries.
 * @returns The prepared encrypted creates, updates, update target metadata, and counts.
 * @remarks This delegates encryption and normalization to the `project_variables` write-preparation pipeline.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function buildPreparedScheduleSnapshotEffect(
  input: BuildPreparedScheduleSnapshotInput,
): Effect.Effect<
  PreparedScheduleSnapshot,
  ExternalServiceError | NotFoundError | ValidationError
> {
  return Effect.gen(function* () {
    const existingRows = (yield* Effect.tryPromise({
      try: () =>
        input.ctx.runQuery(
          listVariableMetadataForOrgProjectStageInternalReference,
          {
            orgId: input.orgId,
            projectSlug: input.projectSlug,
            stageSlug: input.stageSlug,
          },
        ),
      catch: (error) =>
        toScheduleSnapshotExternalError(
          "Failed to load variable metadata for schedule preparation.",
          error,
        ),
    })) as Array<VariableMetadataRow>;
    const existingById = new Map(existingRows.map((row) => [row.id, row] as const));
    const existingNames = new Set(existingRows.map((row) => row.name));

    const entries: Array<ScheduledCreateEntry> = [];
    const updateTargets: PreparedScheduleSnapshot["updateTargets"] = [];

    for (const create of input.creates) {
      const normalizedName = yield* Effect.try({
        try: () => validateVariableName(create.name),
        catch: (error) =>
          toScheduleSnapshotValidationError("Variable name is invalid.", error),
      });
      if (existingNames.has(normalizedName)) {
        return yield* Effect.fail(
          new ValidationError({
            message: `Variable ${normalizedName} already exists in this stage.`,
          }),
        );
      }

      entries.push({
        ...create,
        name: normalizedName,
      });
    }

    for (const update of input.updates) {
      const existing = existingById.get(update.id);
      if (existing === undefined) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Variable update target does not exist.",
          }),
        );
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

    const prepared: {
      creates: Array<ProjectVariablePreparedCreateEntry>;
      updates: Array<ProjectVariablePreparedUpdateEntry>;
      createdCount: number;
      updatedCount: number;
    } = yield* Effect.tryPromise({
      try: () =>
        input.ctx.runMutation(
          prepareVariableWritesForOrgProjectStageInternalReference,
          {
            orgId: input.orgId,
            clerkUserId: input.clerkUserId,
            projectSlug: input.projectSlug,
            stageSlug: input.stageSlug,
            mode: "upsert",
            entries,
            deletes: [],
          },
        ) as Promise<{
          creates: Array<ProjectVariablePreparedCreateEntry>;
          updates: Array<ProjectVariablePreparedUpdateEntry>;
          createdCount: number;
          updatedCount: number;
        }>,
      catch: (error) =>
        toScheduleSnapshotExternalError(
          "Failed to prepare variable writes for the scheduled batch.",
          error,
        ),
    });

    return {
      preparedCreates: prepared.creates,
      preparedUpdates: prepared.updates,
      updateTargets,
      createdCount: prepared.createdCount,
      updatedCount: prepared.updatedCount,
    };
  });
}

/**
 * Builds the prepared encrypted snapshot for a scheduled variable batch.
 *
 * @param input The mutation context plus the org, project, stage, and user-authored create/update entries.
 * @returns The prepared encrypted creates, updates, update target metadata, and counts.
 * @remarks This compatibility wrapper keeps promise-based callers working while the domain moves to Effect.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function buildPreparedScheduleSnapshot(
  input: BuildPreparedScheduleSnapshotInput,
): Promise<PreparedScheduleSnapshot> {
  return await Effect.runPromise(
    buildPreparedScheduleSnapshotEffect(input).pipe(
      Effect.mapError((error) => new Error(error.message)),
    ),
  );
}
