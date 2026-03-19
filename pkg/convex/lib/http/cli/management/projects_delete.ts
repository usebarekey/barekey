import { makeFunctionReference } from "convex/server";

import { httpAction } from "../../../../confect";
import { isAuthResolutionFailure, resolveAuthContext } from "../../auth";
import { authErrorResponse, buildJsonResponse, errorResponse, readRequestId } from "../../responses";
import { decodeCliProjectDeleteBody } from "./input";
import { readJsonBody } from "../shared";

const deleteProjectForCurrentOrgReference = makeFunctionReference<
  "mutation",
  {
    expectedOrgSlug: string;
    projectSlug: string;
  },
  unknown
>("projects:deleteForCurrentOrg") as any;

/**
 * Deletes one project for one CLI-selected organization.
 *
 * @param ctx The HTTP action context.
 * @param request The incoming HTTP request.
 * @returns The deleted project summary payload.
 * @remarks This keeps project deletion behind the dedicated CLI management API instead of direct Convex refs.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export const cliProjectsDelete = httpAction(async (ctx, request) => {
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

  const parsed = decodeCliProjectDeleteBody(payload);
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

  try {
    const deleted = await ctx.runMutation(deleteProjectForCurrentOrgReference, {
      expectedOrgSlug: parsed.orgSlug,
      projectSlug: parsed.projectSlug,
    });

    return buildJsonResponse(200, {
      ...((deleted ?? {}) as object),
      requestId,
    });
  } catch (error) {
    return errorResponse({
      status: 400,
      code: "PROJECT_DELETE_FAILED",
      message: error instanceof Error ? error.message : "Failed to delete project.",
      requestId,
    });
  }
});
