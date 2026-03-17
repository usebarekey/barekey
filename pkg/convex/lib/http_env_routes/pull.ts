import { internal } from "../../_generated/api";
import { httpAction } from "../../confect";
import { isAuthResolutionFailure, resolveAuthContext } from "../http_auth";
import {
  classifyReserveError,
  parseListRequest,
  readBillingRequestKey,
  type ResolvedVariableValue,
} from "../http_env";
import {
  authErrorResponse,
  buildJsonResponse,
  errorResponse,
  readRequestId,
} from "../http_responses";
import {
  compensateCurrentOrgFeatureUnits,
  readJsonBody,
  reserveCurrentOrgFeatureUnits,
  resolveVariableForRow,
} from "./shared";

/**
 * Pulls and evaluates all variables for an authenticated environment request.
 *
 * @param ctx The HTTP action context.
 * @param request The incoming HTTP request.
 * @returns The resolved environment payload or a normalized error response.
 * @remarks This reserves dynamic usage units, compensates on duplicate/failure, and returns both ordered values and a by-name map.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
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
      values.push(
        await resolveVariableForRow(ctx, {
          orgId: authContext.orgId,
          projectSlug: parsed.projectSlug,
          stageSlug: parsed.stageSlug,
          row,
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
