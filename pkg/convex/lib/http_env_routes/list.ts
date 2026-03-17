import { internal } from "../../_generated/api";
import { httpAction } from "../../confect";
import { isAuthResolutionFailure, resolveAuthContext } from "../http_auth";
import { parseListRequest } from "../http_env";
import {
  authErrorResponse,
  buildJsonResponse,
  errorResponse,
  readRequestId,
} from "../http_responses";
import { readJsonBody } from "./shared";

/**
 * Lists variable metadata for an authenticated environment request.
 *
 * @param ctx The HTTP action context.
 * @param request The incoming HTTP request.
 * @returns The normalized metadata list response or a normalized error response.
 * @remarks This does not decrypt values; it only returns variable metadata for the requested stage.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
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
    variables: variables.map((row: {
      name: string;
      visibility: string | null;
      kind: string;
      declaredType: string | null;
      createdAtMs: number;
      updatedAtMs: number;
      chance: number | null;
      rolloutFunction: string | null;
      rolloutMilestones: unknown;
    }) => ({
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
