import { makeFunctionReference } from "convex/server";
import { httpAction } from "../../../../confect";
import { isAuthResolutionFailure, resolveAuthContext } from "../../auth";
import {
  classifyReserveError,
  parseSingleRequest,
  readBillingRequestKey,
  type ResolvedVariableRow,
} from "..";
import {
  authErrorResponse,
  buildJsonResponse,
  errorResponse,
  readRequestId,
} from "../../responses";
import {
  compensateCurrentOrgFeatureUnits,
  readJsonBody,
  reserveCurrentOrgFeatureUnits,
  resolveVariableForRow,
} from "./shared";

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

const logBillingRequestInternalReference = makeFunctionReference<
  "mutation",
  {
    orgId: string;
    requestKey: string;
    featureId: string;
    units: number;
  },
  {
    inserted: boolean;
  }
>("payments:logBillingRequestInternal") as any;

/**
 * Evaluates a single variable for an authenticated organization request.
 *
 * @param ctx The HTTP action context.
 * @param request The incoming HTTP request.
 * @returns The evaluated variable response or a normalized error response.
 * @remarks This reserves dynamic usage units, compensates on duplicate/failure, and logs idempotency keys.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
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
    resolveVariableRowsForOrgProjectStageInternalReference,
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
      console.error("HTTP single evaluate invariant failed: variable row missing.");
      return errorResponse({
        status: 500,
        code: "EVALUATION_FAILED",
        message: "Failed to evaluate this variable.",
        requestId,
      });
    }

    const resolved = await resolveVariableForRow(ctx, {
      orgId: authContext.orgId,
      projectSlug: parsed.projectSlug,
      stageSlug: parsed.stageSlug,
      row,
      seed: parsed.seed,
      key: parsed.key,
    });

    const billingLogResult = (await ctx.runMutation(
      logBillingRequestInternalReference,
      {
        orgId: authContext.orgId,
        requestKey: readBillingRequestKey(request, requestId, "env_evaluate_single"),
        featureId: "dynamic_requests",
        units: 1,
      },
    )) as { inserted: boolean };
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
