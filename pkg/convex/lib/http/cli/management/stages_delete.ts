import { makeFunctionReference } from "convex/server";

import { httpAction } from "../../../../confect";
import { isAuthResolutionFailure, resolveAuthContext } from "../../auth";
import { authErrorResponse, buildJsonResponse, errorResponse, readRequestId } from "../../responses";
import { decodeCliStageDeleteBody } from "./input";
import { readJsonBody } from "../shared";

const deleteStageForCurrentOrgProjectReference = makeFunctionReference<
  "mutation",
  {
    expectedOrgSlug: string;
    projectSlug: string;
    stageSlug: string;
  },
  unknown
>("project_stages:deleteForCurrentOrgProject") as any;

/**
 * Deletes one stage for one CLI-selected project.
 *
 * @param ctx The HTTP action context.
 * @param request The incoming HTTP request.
 * @returns The deleted stage summary payload.
 * @remarks This keeps destructive stage management on the same CLI HTTP boundary as the rest of v2.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export const cliStagesDelete = httpAction(async (ctx, request) => {
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

  const parsed = decodeCliStageDeleteBody(payload);
  if (parsed === null) {
    return errorResponse({
      status: 400,
      code: "INVALID_REQUEST",
      message: "orgSlug, projectSlug, and stageSlug are required.",
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
    const deleted = await ctx.runMutation(deleteStageForCurrentOrgProjectReference, {
      expectedOrgSlug: parsed.orgSlug,
      projectSlug: parsed.projectSlug,
      stageSlug: parsed.stageSlug,
    });

    return buildJsonResponse(200, {
      ...((deleted ?? {}) as object),
      requestId,
    });
  } catch (error) {
    return errorResponse({
      status: 400,
      code: "STAGE_DELETE_FAILED",
      message: error instanceof Error ? error.message : "Failed to delete stage.",
      requestId,
    });
  }
});
