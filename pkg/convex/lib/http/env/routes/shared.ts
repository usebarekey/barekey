import { makeFunctionReference } from "convex/server";
import { Effect } from "effect";

import { httpAction } from "../../../../confect";
import { runActionEffect, runMutationEffect } from "../../../../lib/convex/functions";
import {
  resolveVariableValue,
  type DecryptedVariable,
  type ResolvedVariableRow,
  type ResolvedVariableValue,
} from "..";

export type HttpEnvActionCtx = Parameters<typeof httpAction>[0] extends (
  ctx: infer T,
  request: Request,
) => unknown
  ? T
  : never;

const reserveFeatureUnitsForCurrentOrgInternalReference = makeFunctionReference<
  "action",
  {
    expectedOrgSlug: string;
    featureId: "dynamic_requests" | "static_requests";
    units: number;
    reason: string;
  },
  {
    reservedUnits: number;
  }
>("payments:reserveFeatureUnitsForCurrentOrgInternal") as any;

const compensateFeatureUnitsForCurrentOrgInternalReference = makeFunctionReference<
  "action",
  {
    expectedOrgSlug: string;
    featureId: "dynamic_requests" | "static_requests";
    units: number;
    reason: string;
  },
  unknown
>("payments:compensateFeatureUnitsForCurrentOrgInternal") as any;

const decryptValueForOrgProjectStageInternalReference = makeFunctionReference<
  "mutation",
  {
    orgId: string;
    projectSlug: string;
    stageSlug: string;
    variableId: string;
  },
  DecryptedVariable
>("project_variables:decryptValueForOrgProjectStageInternal") as any;

/**
 * Reads a JSON request body for an HTTP environment route.
 *
 * @param request The incoming HTTP request.
 * @returns The parsed JSON payload.
 * @remarks Callers are expected to catch parsing errors and convert them into route-specific responses.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function readJsonBody(request: Request): Promise<unknown> {
  return await request.json();
}

/**
 * Reserves metered feature units for the current authenticated organization.
 *
 * @param ctx The HTTP environment action context.
 * @param input The org slug, feature id, unit count, and billing reason.
 * @returns The reserved unit count.
 * @remarks This delegates to the shared billing internal action.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function reserveCurrentOrgFeatureUnits(
  ctx: HttpEnvActionCtx,
  input: {
    expectedOrgSlug: string;
    featureId: "dynamic_requests" | "static_requests";
    units: number;
    reason: string;
  },
): Promise<{ reservedUnits: number }> {
  return await Effect.runPromise(
    runActionEffect<{ reservedUnits: number }, unknown>(
      ctx,
      reserveFeatureUnitsForCurrentOrgInternalReference,
      input,
      (error) => error,
    ),
  );
}

/**
 * Compensates previously reserved metered feature units for the current authenticated organization.
 *
 * @param ctx The HTTP environment action context.
 * @param input The org slug, feature id, unit count, and compensation reason.
 * @returns A promise that resolves after the compensation action completes.
 * @remarks This delegates to the shared billing internal action and does not suppress rollback failures.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function compensateCurrentOrgFeatureUnits(
  ctx: HttpEnvActionCtx,
  input: {
    expectedOrgSlug: string;
    featureId: "dynamic_requests" | "static_requests";
    units: number;
    reason: string;
  },
): Promise<void> {
  await Effect.runPromise(
    runActionEffect<unknown, unknown>(
      ctx,
      compensateFeatureUnitsForCurrentOrgInternalReference,
      input,
      (error) => error,
    ),
  );
}

/**
 * Decrypts and resolves a single variable row for an HTTP environment response.
 *
 * @param ctx The HTTP environment action context.
 * @param input The org/project/stage scope plus the resolved row and optional seed/key.
 * @returns The resolved variable value ready for HTTP serialization.
 * @remarks This performs the mutation-side decrypt step before running the value resolver.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function resolveVariableForRow(
  ctx: HttpEnvActionCtx,
  input: {
    orgId: string;
    projectSlug: string;
    stageSlug: string;
    row: ResolvedVariableRow;
    seed?: string;
    key?: string;
  },
): Promise<ResolvedVariableValue> {
  const decrypted = await Effect.runPromise(
    runMutationEffect<DecryptedVariable, unknown>(
      ctx,
      decryptValueForOrgProjectStageInternalReference,
      {
        orgId: input.orgId,
        projectSlug: input.projectSlug,
        stageSlug: input.stageSlug,
        variableId: input.row.id,
      },
      (error) => error,
    ),
  );

  return await resolveVariableValue({
    variable: decrypted,
    visibility: input.row.visibility,
    seed: input.seed,
    key: input.key,
  });
}
