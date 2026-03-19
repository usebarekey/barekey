import { makeFunctionReference } from "convex/server";

import { httpAction } from "../../../../confect";
import { isAuthResolutionFailure, resolveAuthContext } from "../../auth";
import { authErrorResponse, buildJsonResponse, errorResponse, readRequestId } from "../../responses";
import { decodeCliStageListBody } from "./input";
import { readJsonBody } from "../shared";

const listStagesForCurrentOrgProjectReference = makeFunctionReference<
  "query",
  {
    expectedOrgSlug: string;
    projectSlug: string;
  },
  Array<unknown>
>("project_stages:listForCurrentOrgProject") as any;

/**
 * Lists stages for one CLI-selected project.
 *
 * @param ctx The HTTP action context.
 * @param request The incoming HTTP request.
 * @returns The stage list for the requested organization/project pair.
 * @remarks This route keeps stage discovery available to `barekey init` and other CLI flows without direct Convex coupling.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export const cliStagesList = httpAction(async (ctx, request) => {
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

  const parsed = decodeCliStageListBody(payload);
  if (parsed === null) {
    return errorResponse({
      status: 400,
      code: "INVALID_REQUEST",
      message: "orgSlug and projectSlug are required.",
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

  const stages = (await ctx.runQuery(listStagesForCurrentOrgProjectReference, {
    expectedOrgSlug: parsed.orgSlug,
    projectSlug: parsed.projectSlug,
  })) as Array<unknown>;

  return buildJsonResponse(200, {
    stages,
    requestId,
  });
});
