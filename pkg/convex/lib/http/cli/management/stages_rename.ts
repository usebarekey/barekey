import { makeFunctionReference } from "convex/server";

import { httpAction } from "../../../../confect";
import { isAuthResolutionFailure, resolveAuthContext } from "../../auth";
import { authErrorResponse, buildJsonResponse, errorResponse, readRequestId } from "../../responses";
import { decodeCliStageRenameBody } from "./input";
import { readJsonBody } from "../shared";

const renameStageForCurrentOrgProjectReference = makeFunctionReference<
  "mutation",
  {
    expectedOrgSlug: string;
    projectSlug: string;
    stageSlug: string;
    name: string;
  },
  unknown
>("project_stages:renameForCurrentOrgProject") as any;

/**
 * Renames one stage for one CLI-selected project.
 *
 * @param ctx The HTTP action context.
 * @param request The incoming HTTP request.
 * @returns The updated stage summary.
 * @remarks This preserves the dedicated CLI API boundary while delegating to the existing stage rename mutation.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export const cliStagesRename = httpAction(async (ctx, request) => {
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

  const parsed = decodeCliStageRenameBody(payload);
  if (parsed === null) {
    return errorResponse({
      status: 400,
      code: "INVALID_REQUEST",
      message: "orgSlug, projectSlug, stageSlug, and name are required.",
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
    const stage = await ctx.runMutation(renameStageForCurrentOrgProjectReference, {
      expectedOrgSlug: parsed.orgSlug,
      projectSlug: parsed.projectSlug,
      stageSlug: parsed.stageSlug,
      name: parsed.name,
    });

    return buildJsonResponse(200, {
      stage,
      requestId,
    });
  } catch (error) {
    return errorResponse({
      status: 400,
      code: "STAGE_RENAME_FAILED",
      message: error instanceof Error ? error.message : "Failed to rename stage.",
      requestId,
    });
  }
});
