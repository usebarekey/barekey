import { makeFunctionReference } from "convex/server";

import { httpAction } from "../../../../confect";
import { isAuthResolutionFailure, resolveAuthContext } from "../../auth";
import { authErrorResponse, buildJsonResponse, errorResponse, readRequestId } from "../../responses";
import { decodeCliProjectCreateBody } from "./input";
import { readJsonBody } from "../shared";

const createProjectForCurrentOrgReference = makeFunctionReference<
  "action",
  {
    expectedOrgSlug: string;
    name: string;
  },
  unknown
>("projects:createForCurrentOrg") as any;

/**
 * Creates a project for one CLI-selected organization.
 *
 * @param ctx The HTTP action context.
 * @param request The incoming HTTP request.
 * @returns The created project summary.
 * @remarks This delegates to the existing Effect/Confect project-create action used by the dashboard.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export const cliProjectsCreate = httpAction(async (ctx, request) => {
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

  const parsed = decodeCliProjectCreateBody(payload);
  if (parsed === null) {
    return errorResponse({
      status: 400,
      code: "INVALID_REQUEST",
      message: "orgSlug and name are required.",
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
    const project = await ctx.runAction(createProjectForCurrentOrgReference, {
      expectedOrgSlug: parsed.orgSlug,
      name: parsed.name,
    });

    return buildJsonResponse(200, {
      project,
      requestId,
    });
  } catch (error) {
    return errorResponse({
      status: 400,
      code: "PROJECT_CREATE_FAILED",
      message: error instanceof Error ? error.message : "Failed to create project.",
      requestId,
    });
  }
});
