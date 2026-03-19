import { Effect } from "effect";
import { makeFunctionReference } from "convex/server";

import type { VariableMetadataRow } from "../../../project_variables/queries";
import type {
  ProjectVariablePreparedCreateEntry,
  ProjectVariablePreparedUpdateEntry,
} from "../../../lib/project_variables/schedules";
import type { ScheduledCreateEntry } from "../../types";
import { toScheduleSnapshotExternalError } from "../errors";
import type { BuildPreparedScheduleSnapshotInput } from "./types";

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

/**
 * Loads existing variable metadata rows for one project stage.
 *
 * @param input The schedule snapshot build input.
 * @returns The existing variable metadata rows for the stage.
 * @remarks This is used to validate create collisions and resolve update target names.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function listScheduleSnapshotVariableMetadataEffect(
  input: BuildPreparedScheduleSnapshotInput,
) {
  const { runQuery } = input.ctx;
  return Effect.tryPromise({
    try: () =>
      runQuery(
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
  }) as Effect.Effect<Array<VariableMetadataRow>, ReturnType<typeof toScheduleSnapshotExternalError>>;
}

/**
 * Prepares encrypted variable writes for a scheduled batch.
 *
 * @param input The schedule snapshot build input plus normalized entries.
 * @returns The prepared create/update payloads and resulting counts.
 * @remarks This delegates encryption and normalization to the project-variables write-preparation mutation.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function prepareScheduledVariableWritesEffect(
  input: BuildPreparedScheduleSnapshotInput & {
    entries: Array<ScheduledCreateEntry>;
  },
) {
  const { runMutation } = input.ctx;
  return Effect.tryPromise({
    try: () =>
      runMutation(
        prepareVariableWritesForOrgProjectStageInternalReference,
        {
          orgId: input.orgId,
          clerkUserId: input.clerkUserId,
          projectSlug: input.projectSlug,
          stageSlug: input.stageSlug,
          mode: "upsert",
          entries: input.entries,
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
}
