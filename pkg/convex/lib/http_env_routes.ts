import { internal } from "../_generated/api";
import { httpAction } from "../confect";
import { isAuthResolutionFailure, resolveAuthContext } from "./http_auth";
import {
  classifyReserveError,
  parseBatchRequest,
  parseDefinitionsRequest,
  parseListRequest,
  parseSingleRequest,
  parseWriteRequest,
  readBillingRequestKey,
  resolveDefinitionsForRows,
  resolveVariableValue,
  type DecryptedVariable,
  type ResolvedVariableValue,
  type ResolvedVariableRow,
} from "./http_env";
import {
  authErrorResponse,
  buildJsonResponse,
  errorResponse,
  readRequestId,
} from "./http_responses";

async function readJsonBody(request: Request): Promise<unknown> {
  return await request.json();
}

async function reserveCurrentOrgFeatureUnits(
  ctx: Parameters<typeof httpAction>[0] extends (ctx: infer T, request: Request) => unknown ? T : never,
  input: {
    expectedOrgSlug: string;
    featureId: "dynamic_requests" | "static_requests";
    units: number;
    reason: string;
  },
): Promise<{ reservedUnits: number }> {
  return await ctx.runAction(internal.payments.reserveFeatureUnitsForCurrentOrgInternal, input);
}

async function compensateCurrentOrgFeatureUnits(
  ctx: Parameters<typeof httpAction>[0] extends (ctx: infer T, request: Request) => unknown ? T : never,
  input: {
    expectedOrgSlug: string;
    featureId: "dynamic_requests" | "static_requests";
    units: number;
    reason: string;
  },
): Promise<void> {
  await ctx.runAction(internal.payments.compensateFeatureUnitsForCurrentOrgInternal, input);
}

export const evaluateOne = httpAction(async (ctx, request) => {
  const requestId = readRequestId(request);
  let payload: unknown;
  try {
    payload = await readJsonBody(request);
  } catch {
    return errorResponse({
      status: 400,
      code: "INVALID_JSON",
      message: "Request body must be valid JSON.",
      requestId,
    });
  }

  const parsed = parseSingleRequest(payload);
  if (parsed === null) {
    return errorResponse({
      status: 400,
      code: "INVALID_REQUEST",
      message: "projectSlug, stageSlug, and name are required.",
      requestId,
    });
  }

  const authResult = await resolveAuthContext(ctx, request, parsed.orgSlug);
  if (isAuthResolutionFailure(authResult)) {
    return authErrorResponse({
      status: authResult.status,
      code: authResult.code,
      message: authResult.message,
      requestId,
    });
  }
  const authContext = authResult.context;

  const rows = (await ctx.runQuery(
    internal.project_variables.resolveVariableRowsForOrgProjectStageInternal,
    {
      orgId: authContext.orgId,
      projectSlug: parsed.projectSlug,
      stageSlug: parsed.stageSlug,
      names: [parsed.name],
    },
  )) as Array<ResolvedVariableRow>;
  if (rows.length !== 1) {
    return errorResponse({
      status: 404,
      code: "VARIABLE_NOT_FOUND",
      message: `Variable ${parsed.name} was not found in this stage.`,
      requestId,
    });
  }

  let reservedUnits = 0;
  try {
    const reservation = await reserveCurrentOrgFeatureUnits(ctx, {
      expectedOrgSlug: authContext.orgSlug,
      featureId: "dynamic_requests",
      units: 1,
      reason: "http_evaluate_single",
    });
    reservedUnits = reservation.reservedUnits;
  } catch (error: unknown) {
    const classified = classifyReserveError(error);
    return errorResponse({
      status: classified.status,
      code: classified.code,
      message: classified.message,
      requestId,
    });
  }

  try {
    const row = rows[0];
    if (!row) {
      throw new Error("Variable row missing.");
    }
    const decrypted = (await ctx.runMutation(
      internal.project_variables.decryptValueForOrgProjectStageInternal,
      {
        orgId: authContext.orgId,
        projectSlug: parsed.projectSlug,
        stageSlug: parsed.stageSlug,
        variableId: row.id,
      },
    )) as DecryptedVariable;
    const resolved = await resolveVariableValue({
      variable: decrypted,
      visibility: row.visibility,
      seed: parsed.seed,
      key: parsed.key,
    });

    const billingLogResult = await ctx.runMutation(internal.payments.logBillingRequestInternal, {
      orgId: authContext.orgId,
      requestKey: readBillingRequestKey(request, requestId, "env_evaluate_single"),
      featureId: "dynamic_requests",
      units: 1,
    });
    if (!billingLogResult.inserted && reservedUnits > 0) {
      const unitsToCompensate = reservedUnits;
      reservedUnits = 0;
      await compensateCurrentOrgFeatureUnits(ctx, {
        expectedOrgSlug: authContext.orgSlug,
        featureId: "dynamic_requests",
        units: unitsToCompensate,
        reason: "http_evaluate_single_duplicate_request",
      });
    }

    return buildJsonResponse(200, {
      name: resolved.name,
      kind: resolved.kind,
      declaredType: resolved.declaredType,
      visibility: resolved.visibility,
      value: resolved.value,
      decision: resolved.decision,
    });
  } catch (error: unknown) {
    if (reservedUnits > 0) {
      try {
        const unitsToCompensate = reservedUnits;
        reservedUnits = 0;
        await compensateCurrentOrgFeatureUnits(ctx, {
          expectedOrgSlug: authContext.orgSlug,
          featureId: "dynamic_requests",
          units: unitsToCompensate,
          reason: "http_evaluate_single_rollback",
        });
      } catch (rollbackError: unknown) {
        console.error("HTTP single evaluate rollback failed.", rollbackError);
      }
    }
    console.error("HTTP single evaluate failed.", error);
    return errorResponse({
      status: 500,
      code: "EVALUATION_FAILED",
      message: "Failed to evaluate this variable.",
      requestId,
    });
  }
});

export const evaluateBatch = httpAction(async (ctx, request) => {
  const requestId = readRequestId(request);
  let payload: unknown;
  try {
    payload = await readJsonBody(request);
  } catch {
    return errorResponse({
      status: 400,
      code: "INVALID_JSON",
      message: "Request body must be valid JSON.",
      requestId,
    });
  }

  const parsed = parseBatchRequest(payload);
  if (parsed === null) {
    return errorResponse({
      status: 400,
      code: "INVALID_REQUEST",
      message: "projectSlug, stageSlug, and non-empty unique names[] are required.",
      requestId,
    });
  }

  const authResult = await resolveAuthContext(ctx, request, parsed.orgSlug);
  if (isAuthResolutionFailure(authResult)) {
    return authErrorResponse({
      status: authResult.status,
      code: authResult.code,
      message: authResult.message,
      requestId,
    });
  }
  const authContext = authResult.context;

  const rows = (await ctx.runQuery(
    internal.project_variables.resolveVariableRowsForOrgProjectStageInternal,
    {
      orgId: authContext.orgId,
      projectSlug: parsed.projectSlug,
      stageSlug: parsed.stageSlug,
      names: parsed.names,
    },
  )) as Array<ResolvedVariableRow>;

  if (rows.length !== parsed.names.length) {
    return errorResponse({
      status: 404,
      code: "VARIABLE_NOT_FOUND",
      message: "One or more requested variables were not found.",
      requestId,
    });
  }

  let reservedUnits = 0;
  try {
    const reservation = await reserveCurrentOrgFeatureUnits(ctx, {
      expectedOrgSlug: authContext.orgSlug,
      featureId: "dynamic_requests",
      units: parsed.names.length,
      reason: "http_evaluate_batch",
    });
    reservedUnits = reservation.reservedUnits;
  } catch (error: unknown) {
    const classified = classifyReserveError(error);
    return errorResponse({
      status: classified.status,
      code: classified.code,
      message: classified.message,
      requestId,
    });
  }

  try {
    const byName = new Map(rows.map((row) => [row.name, row]));
    const values: Array<ResolvedVariableValue> = [];

    for (const name of parsed.names) {
      const row = byName.get(name);
      if (!row) {
        throw new Error("Batch resolution drift detected.");
      }
      const decrypted = (await ctx.runMutation(
        internal.project_variables.decryptValueForOrgProjectStageInternal,
        {
          orgId: authContext.orgId,
          projectSlug: parsed.projectSlug,
          stageSlug: parsed.stageSlug,
          variableId: row.id,
        },
      )) as DecryptedVariable;
      values.push(
        await resolveVariableValue({
          variable: decrypted,
          visibility: row.visibility,
          seed: parsed.seed,
          key: parsed.key,
        }),
      );
    }

    const billingLogResult = await ctx.runMutation(internal.payments.logBillingRequestInternal, {
      orgId: authContext.orgId,
      requestKey: readBillingRequestKey(request, requestId, "env_evaluate_batch"),
      featureId: "dynamic_requests",
      units: parsed.names.length,
    });
    if (!billingLogResult.inserted && reservedUnits > 0) {
      const unitsToCompensate = reservedUnits;
      reservedUnits = 0;
      await compensateCurrentOrgFeatureUnits(ctx, {
        expectedOrgSlug: authContext.orgSlug,
        featureId: "dynamic_requests",
        units: unitsToCompensate,
        reason: "http_evaluate_batch_duplicate_request",
      });
    }

    return buildJsonResponse(200, {
      values,
    });
  } catch (error: unknown) {
    if (reservedUnits > 0) {
      try {
        const unitsToCompensate = reservedUnits;
        reservedUnits = 0;
        await compensateCurrentOrgFeatureUnits(ctx, {
          expectedOrgSlug: authContext.orgSlug,
          featureId: "dynamic_requests",
          units: unitsToCompensate,
          reason: "http_evaluate_batch_rollback",
        });
      } catch (rollbackError: unknown) {
        console.error("HTTP batch evaluate rollback failed.", rollbackError);
      }
    }
    console.error("HTTP batch evaluate failed.", error);
    return errorResponse({
      status: 500,
      code: "EVALUATION_FAILED",
      message: "Failed to evaluate this batch request.",
      requestId,
    });
  }
});

export const envList = httpAction(async (ctx, request) => {
  const requestId = readRequestId(request);
  let payload: unknown;
  try {
    payload = await readJsonBody(request);
  } catch {
    return errorResponse({
      status: 400,
      code: "INVALID_JSON",
      message: "Request body must be valid JSON.",
      requestId,
    });
  }

  const parsed = parseListRequest(payload);
  if (parsed === null) {
    return errorResponse({
      status: 400,
      code: "INVALID_REQUEST",
      message: "projectSlug and stageSlug are required.",
      requestId,
    });
  }

  const authResult = await resolveAuthContext(ctx, request, parsed.orgSlug);
  if (isAuthResolutionFailure(authResult)) {
    return authErrorResponse({
      status: authResult.status,
      code: authResult.code,
      message: authResult.message,
      requestId,
    });
  }
  const authContext = authResult.context;

  const variables = await ctx.runQuery(
    internal.project_variables.listVariableMetadataForOrgProjectStageInternal,
    {
      orgId: authContext.orgId,
      projectSlug: parsed.projectSlug,
      stageSlug: parsed.stageSlug,
    },
  );

  return buildJsonResponse(200, {
    variables: variables.map((row) => ({
      name: row.name,
      visibility: row.visibility,
      kind: row.kind,
      declaredType: row.declaredType,
      createdAtMs: row.createdAtMs,
      updatedAtMs: row.updatedAtMs,
      chance: row.chance,
      rolloutFunction: row.rolloutFunction,
      rolloutMilestones: row.rolloutMilestones,
    })),
    requestId,
  });
});

export const envWrite = httpAction(async (ctx, request) => {
  const requestId = readRequestId(request);
  let payload: unknown;
  try {
    payload = await readJsonBody(request);
  } catch {
    return errorResponse({
      status: 400,
      code: "INVALID_JSON",
      message: "Request body must be valid JSON.",
      requestId,
    });
  }

  const parsed = parseWriteRequest(payload);
  if (parsed === null) {
    return errorResponse({
      status: 400,
      code: "INVALID_REQUEST",
      message: "Invalid write payload. Check projectSlug/stageSlug/mode/entries/deletes.",
      requestId,
    });
  }

  const authResult = await resolveAuthContext(ctx, request, parsed.orgSlug);
  if (isAuthResolutionFailure(authResult)) {
    return authErrorResponse({
      status: authResult.status,
      code: authResult.code,
      message: authResult.message,
      requestId,
    });
  }
  const authContext = authResult.context;

  try {
    const result = await ctx.runAction(
      internal.project_variables.writeVariablesForOrgProjectStageWithUsageInternal,
      {
        orgId: authContext.orgId,
        orgSlug: authContext.orgSlug,
        clerkUserId: authContext.clerkUserId,
        projectSlug: parsed.projectSlug,
        stageSlug: parsed.stageSlug,
        mode: parsed.mode,
        entries: parsed.entries,
        deletes: parsed.deletes,
      },
    );

    return buildJsonResponse(200, {
      createdCount: result.createdCount,
      updatedCount: result.updatedCount,
      deletedCount: result.deletedCount,
      requestId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to write variables.";
    const isReserveRelated =
      message === "Usage limit exceeded for this workspace plan." ||
      message === "This workspace is without a plan. Choose a billing plan to enable projects." ||
      message === "Billing service is temporarily unavailable.";
    const classified = isReserveRelated ? classifyReserveError(error) : null;
    return errorResponse({
      status: classified?.status ?? 400,
      code: classified?.code ?? "WRITE_FAILED",
      message: classified?.message ?? message,
      requestId,
    });
  }
});

export const envPull = httpAction(async (ctx, request) => {
  const requestId = readRequestId(request);
  let payload: unknown;
  try {
    payload = await readJsonBody(request);
  } catch {
    return errorResponse({
      status: 400,
      code: "INVALID_JSON",
      message: "Request body must be valid JSON.",
      requestId,
    });
  }

  const parsed = parseListRequest(payload);
  if (parsed === null) {
    return errorResponse({
      status: 400,
      code: "INVALID_REQUEST",
      message: "projectSlug and stageSlug are required.",
      requestId,
    });
  }
  const input = payload as Record<string, unknown>;
  const seed = typeof input.seed === "string" ? input.seed : undefined;
  const key = typeof input.key === "string" ? input.key : undefined;

  const authResult = await resolveAuthContext(ctx, request, parsed.orgSlug);
  if (isAuthResolutionFailure(authResult)) {
    return authErrorResponse({
      status: authResult.status,
      code: authResult.code,
      message: authResult.message,
      requestId,
    });
  }
  const authContext = authResult.context;

  const rows = await ctx.runQuery(
    internal.project_variables.listVariableMetadataForOrgProjectStageInternal,
    {
      orgId: authContext.orgId,
      projectSlug: parsed.projectSlug,
      stageSlug: parsed.stageSlug,
    },
  );

  let reservedUnits = 0;
  try {
    const reservation = await reserveCurrentOrgFeatureUnits(ctx, {
      expectedOrgSlug: authContext.orgSlug,
      featureId: "dynamic_requests",
      units: rows.length,
      reason: "http_env_pull",
    });
    reservedUnits = reservation.reservedUnits;
  } catch (error: unknown) {
    const classified = classifyReserveError(error);
    return errorResponse({
      status: classified.status,
      code: classified.code,
      message: classified.message,
      requestId,
    });
  }

  try {
    const values: Array<ResolvedVariableValue> = [];
    for (const row of rows) {
      const decrypted = (await ctx.runMutation(
        internal.project_variables.decryptValueForOrgProjectStageInternal,
        {
          orgId: authContext.orgId,
          projectSlug: parsed.projectSlug,
          stageSlug: parsed.stageSlug,
          variableId: row.id,
        },
      )) as DecryptedVariable;
      values.push(
        await resolveVariableValue({
          variable: decrypted,
          visibility: row.visibility,
          seed,
          key,
        }),
      );
    }

    const billingLogResult = await ctx.runMutation(internal.payments.logBillingRequestInternal, {
      orgId: authContext.orgId,
      requestKey: readBillingRequestKey(request, requestId, "env_pull"),
      featureId: "dynamic_requests",
      units: rows.length,
    });
    if (!billingLogResult.inserted && reservedUnits > 0) {
      const unitsToCompensate = reservedUnits;
      reservedUnits = 0;
      await compensateCurrentOrgFeatureUnits(ctx, {
        expectedOrgSlug: authContext.orgSlug,
        featureId: "dynamic_requests",
        units: unitsToCompensate,
        reason: "http_env_pull_duplicate_request",
      });
    }

    const byName = Object.fromEntries(values.map((row) => [row.name, row.value]));
    return buildJsonResponse(200, {
      values,
      byName,
      requestId,
    });
  } catch (error: unknown) {
    if (reservedUnits > 0) {
      try {
        const unitsToCompensate = reservedUnits;
        reservedUnits = 0;
        await compensateCurrentOrgFeatureUnits(ctx, {
          expectedOrgSlug: authContext.orgSlug,
          featureId: "dynamic_requests",
          units: unitsToCompensate,
          reason: "http_env_pull_rollback",
        });
      } catch (rollbackError: unknown) {
        console.error("HTTP env pull rollback failed.", rollbackError);
      }
    }
    console.error("HTTP env pull failed.", error);
    return errorResponse({
      status: 500,
      code: "EVALUATION_FAILED",
      message: "Failed to resolve this environment.",
      requestId,
    });
  }
});

export const envDefinitions = httpAction(async (ctx, request) => {
  const requestId = readRequestId(request);
  let payload: unknown;
  try {
    payload = await readJsonBody(request);
  } catch {
    return errorResponse({
      status: 400,
      code: "INVALID_JSON",
      message: "Request body must be valid JSON.",
      requestId,
    });
  }

  const parsed = parseDefinitionsRequest(payload);
  if (parsed === null) {
    return errorResponse({
      status: 400,
      code: "INVALID_REQUEST",
      message: "projectSlug and stageSlug are required.",
      requestId,
    });
  }

  const authResult = await resolveAuthContext(ctx, request, parsed.orgSlug);
  if (isAuthResolutionFailure(authResult)) {
    return authErrorResponse({
      status: authResult.status,
      code: authResult.code,
      message: authResult.message,
      requestId,
    });
  }
  const authContext = authResult.context;

  const rows: Array<ResolvedVariableRow> =
    parsed.names === undefined
      ? await ctx.runQuery(
          internal.project_variables.listVariableMetadataForOrgProjectStageInternal,
          {
            orgId: authContext.orgId,
            projectSlug: parsed.projectSlug,
            stageSlug: parsed.stageSlug,
          },
        )
      : ((await ctx.runQuery(
          internal.project_variables.resolveVariableRowsForOrgProjectStageInternal,
          {
            orgId: authContext.orgId,
            projectSlug: parsed.projectSlug,
            stageSlug: parsed.stageSlug,
            names: parsed.names,
          },
        )) as Array<ResolvedVariableRow>);

  if (parsed.names !== undefined && rows.length !== parsed.names.length) {
    const returnedNames = new Set(rows.map((row) => row.name));
    const missingName = parsed.names.find((name) => !returnedNames.has(name)) ?? parsed.names[0];
    return errorResponse({
      status: 404,
      code: "VARIABLE_NOT_FOUND",
      message: `Variable ${missingName ?? "unknown"} was not found in this stage.`,
      requestId,
    });
  }

  const units = parsed.names?.length ?? rows.length;
  let reservedUnits = 0;
  try {
    const reservation = await reserveCurrentOrgFeatureUnits(ctx, {
      expectedOrgSlug: authContext.orgSlug,
      featureId: "static_requests",
      units,
      reason: "http_env_definitions",
    });
    reservedUnits = reservation.reservedUnits;
  } catch (error: unknown) {
    const classified = classifyReserveError(error);
    return errorResponse({
      status: classified.status,
      code: classified.code,
      message: classified.message,
      requestId,
    });
  }

  try {
    const definitions = await resolveDefinitionsForRows(ctx, {
      orgId: authContext.orgId,
      projectSlug: parsed.projectSlug,
      stageSlug: parsed.stageSlug,
      rows,
    });

    const billingLogResult = await ctx.runMutation(internal.payments.logBillingRequestInternal, {
      orgId: authContext.orgId,
      requestKey: readBillingRequestKey(request, requestId, "env_definitions"),
      featureId: "static_requests",
      units,
    });
    if (!billingLogResult.inserted && reservedUnits > 0) {
      const unitsToCompensate = reservedUnits;
      reservedUnits = 0;
      await compensateCurrentOrgFeatureUnits(ctx, {
        expectedOrgSlug: authContext.orgSlug,
        featureId: "static_requests",
        units: unitsToCompensate,
        reason: "http_env_definitions_duplicate_request",
      });
    }

    return buildJsonResponse(200, {
      definitions,
      requestId,
    });
  } catch (error: unknown) {
    if (reservedUnits > 0) {
      try {
        const unitsToCompensate = reservedUnits;
        reservedUnits = 0;
        await compensateCurrentOrgFeatureUnits(ctx, {
          expectedOrgSlug: authContext.orgSlug,
          featureId: "static_requests",
          units: unitsToCompensate,
          reason: "http_env_definitions_rollback",
        });
      } catch (rollbackError: unknown) {
        console.error("HTTP definitions rollback failed.", rollbackError);
      }
    }
    console.error("HTTP definitions failed.", error);
    return errorResponse({
      status: 500,
      code: "EVALUATION_FAILED",
      message: "Failed to resolve variable definitions.",
      requestId,
    });
  }
});

export const publicEnvDefinitions = httpAction(async (ctx, request) => {
  const requestId = readRequestId(request);
  let payload: unknown;
  try {
    payload = await readJsonBody(request);
  } catch {
    return errorResponse({
      status: 400,
      code: "INVALID_JSON",
      message: "Request body must be valid JSON.",
      requestId,
    });
  }

  const parsed = parseDefinitionsRequest(payload);
  if (parsed === null || !parsed.orgSlug) {
    return errorResponse({
      status: 400,
      code: "INVALID_REQUEST",
      message: "orgSlug, projectSlug, and stageSlug are required.",
      requestId,
    });
  }

  const resolved = await ctx.runQuery(
    internal.project_variables.resolvePublicVariableRowsForOrgProjectStageInternal,
    {
      orgSlug: parsed.orgSlug,
      projectSlug: parsed.projectSlug,
      stageSlug: parsed.stageSlug,
      ...(parsed.names === undefined ? {} : { names: parsed.names }),
    },
  );
  if (resolved === null) {
    return errorResponse({
      status: 404,
      code: "ENVIRONMENT_NOT_FOUND",
      message: "Project or environment was not found.",
      requestId,
    });
  }

  if (parsed.names !== undefined && resolved.rows.length !== parsed.names.length) {
    const returnedNames = new Set(resolved.rows.map((row) => row.name));
    const missingName = parsed.names.find((name) => !returnedNames.has(name)) ?? parsed.names[0];
    return errorResponse({
      status: 404,
      code: "VARIABLE_NOT_FOUND",
      message: `Variable ${missingName ?? "unknown"} was not found in this stage.`,
      requestId,
    });
  }

  try {
    const definitions = await resolveDefinitionsForRows(ctx, {
      orgId: resolved.orgId,
      projectSlug: parsed.projectSlug,
      stageSlug: parsed.stageSlug,
      rows: resolved.rows,
    });

    return buildJsonResponse(200, {
      definitions,
      requestId,
    });
  } catch (error: unknown) {
    console.error("HTTP public definitions failed.", error);
    return errorResponse({
      status: 500,
      code: "EVALUATION_FAILED",
      message: "Failed to resolve public variable definitions.",
      requestId,
    });
  }
});
