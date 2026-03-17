import { internal } from "../../_generated/api";
import { httpAction } from "../../confect";
import { isAuthResolutionFailure, resolveAuthContext } from "../http_auth";
import {
  classifyReserveError,
  parseDefinitionsRequest,
  readBillingRequestKey,
  resolveDefinitionsForRows,
  type ResolvedVariableRow,
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
} from "./shared";

/**
 * Resolves variable definitions for an authenticated environment request.
 *
 * @param ctx The HTTP action context.
 * @param request The incoming HTTP request.
 * @returns The resolved definition payload or a normalized error response.
 * @remarks This reserves static usage units, compensates on duplicate/failure, and supports scoped name filters.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
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
