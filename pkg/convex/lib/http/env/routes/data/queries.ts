import { makeFunctionReference } from "convex/server";
import { Effect } from "effect";

import { runQueryEffect } from "../../../../convex/functions";
import type {
  PublicVariableResolution,
  VariableMetadataRow,
} from "../../../../../project_variables/queries";
import type { ResolvedVariableRow } from "../..";
import type { HttpEnvActionCtx } from "../shared";

const listVariableMetadataForOrgProjectStageInternalReference = makeFunctionReference<
  "query",
  {
    orgId: string;
    projectSlug: string;
    stageSlug: string;
  },
  Array<VariableMetadataRow>
>("project_variables:listVariableMetadataForOrgProjectStageInternal") as any;

const resolveVariableRowsForOrgProjectStageInternalReference = makeFunctionReference<
  "query",
  {
    orgId: string;
    projectSlug: string;
    stageSlug: string;
    names: Array<string>;
  },
  Array<ResolvedVariableRow>
>("project_variables:resolveVariableRowsForOrgProjectStageInternal") as any;

const resolvePublicVariableRowsForOrgProjectStageInternalReference = makeFunctionReference<
  "query",
  {
    orgSlug: string;
    projectSlug: string;
    stageSlug: string;
    names?: Array<string>;
  },
  PublicVariableResolution
>("project_variables:resolvePublicVariableRowsForOrgProjectStageInternal") as any;

/**
 * Loads variable metadata rows for one org/project/stage scope.
 *
 * @param ctx The HTTP environment action context.
 * @param input The org/project/stage scope to query.
 * @returns The variable metadata rows for the requested stage.
 * @remarks This centralizes the metadata query reference for env HTTP routes.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export async function listVariableMetadataRows(
  ctx: HttpEnvActionCtx,
  input: {
    orgId: string;
    projectSlug: string;
    stageSlug: string;
  },
): Promise<Array<VariableMetadataRow>> {
  return await Effect.runPromise(
    runQueryEffect(ctx, listVariableMetadataForOrgProjectStageInternalReference, input, (error) => error),
  );
}

/**
 * Loads resolved variable rows for a scoped name subset.
 *
 * @param ctx The HTTP environment action context.
 * @param input The org/project/stage scope plus the requested names.
 * @returns The resolved variable rows for the requested names.
 * @remarks This keeps the route layer from owning the generated query reference.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export async function resolveVariableRows(
  ctx: HttpEnvActionCtx,
  input: {
    orgId: string;
    projectSlug: string;
    stageSlug: string;
    names: Array<string>;
  },
): Promise<Array<ResolvedVariableRow>> {
  return await Effect.runPromise(
    runQueryEffect(ctx, resolveVariableRowsForOrgProjectStageInternalReference, input, (error) => error),
  );
}

/**
 * Loads public variable rows for an unauthenticated environment definitions request.
 *
 * @param ctx The HTTP environment action context.
 * @param input The public org/project/stage scope and optional name filter.
 * @returns The resolved public variable set, or `null` when the environment is missing.
 * @remarks This keeps the public-definitions route on the same route-local data gateway as the authenticated routes.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export async function resolvePublicVariableRows(
  ctx: HttpEnvActionCtx,
  input: {
    orgSlug: string;
    projectSlug: string;
    stageSlug: string;
    names?: Array<string>;
  },
): Promise<PublicVariableResolution> {
  return await Effect.runPromise(
    runQueryEffect(
      ctx,
      resolvePublicVariableRowsForOrgProjectStageInternalReference,
      input,
      (error) => error,
    ),
  );
}
