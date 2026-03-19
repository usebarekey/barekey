import { makeFunctionReference } from "convex/server";

import { httpAction } from "../../../../confect";
import { isAuthResolutionFailure, resolveAuthContext } from "../../auth";
import { authErrorResponse, buildJsonResponse, errorResponse, readRequestId } from "../../responses";
import { decodeCliStageCreateBody } from "./input";
import { readJsonBody } from "../shared";

const createStageForCurrentOrgProjectReference = makeFunctionReference<
  "mutation",
  {
    expectedOrgSlug: string;
    projectSlug: string;
    name: string;
  },
  unknown
>("project_stages:createForCurrentOrgProject") as any;

/**
 * Creates a stage for one CLI-selected project.
 *
 * @param ctx The HTTP action context.
 * @param request The incoming HTTP request.
 * @returns The created stage summary.
 * @remarks This delegates to the existing Effect/Confect stage-create mutation used by the dashboard.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export const cliStagesCreate = httpAction(async (ctx, request) => {
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

  const parsed = decodeCliStageCreateBody(payload);
  if (parsed === null) {
    return errorResponse({
      status: 400,
      code: "INVALID_REQUEST",
      message: "orgSlug, projectSlug, and name are required.",
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

  try {
    const stage = await ctx.runMutation(createStageForCurrentOrgProjectReference, {
      expectedOrgSlug: parsed.orgSlug,
      projectSlug: parsed.projectSlug,
      name: parsed.name,
    });

    return buildJsonResponse(200, {
      stage,
      requestId,
    });
  } catch (error) {
    return errorResponse({
      status: 400,
      code: "STAGE_CREATE_FAILED",
      message: error instanceof Error ? error.message : "Failed to create stage.",
      requestId,
    });
  }
});
