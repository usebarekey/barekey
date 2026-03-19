import { makeFunctionReference } from "convex/server";

import { httpAction } from "../../../../confect";
import { isAuthResolutionFailure, resolveAuthContext } from "../../auth";
import { authErrorResponse, buildJsonResponse, errorResponse, readRequestId } from "../../responses";
import { decodeCliProjectListBody } from "./input";
import { readJsonBody } from "../shared";

const listProjectsForCurrentOrgReference = makeFunctionReference<
  "query",
  {
    expectedOrgSlug: string;
  },
  Array<unknown>
>("projects:listForCurrentOrg") as any;

/**
 * Lists projects for one CLI-selected organization.
 *
 * @param ctx The HTTP action context.
 * @param request The incoming HTTP request.
 * @returns The project list for the requested organization.
 * @remarks This route preserves the current project query contract while making it available to the standalone CLI.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export const cliProjectsList = httpAction(async (ctx, request) => {
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

  const parsed = decodeCliProjectListBody(payload);
  if (parsed === null) {
    return errorResponse({
      status: 400,
      code: "INVALID_REQUEST",
      message: "orgSlug is required.",
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

  const projects = (await ctx.runQuery(listProjectsForCurrentOrgReference, {
    expectedOrgSlug: parsed.orgSlug,
  })) as Array<unknown>;

  return buildJsonResponse(200, {
    projects,
    requestId,
  });
});
