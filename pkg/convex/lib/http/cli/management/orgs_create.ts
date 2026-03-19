import { createClerkClient } from "@clerk/backend";

import { httpAction } from "../../../../confect";
import { isAuthResolutionFailure, resolveAuthContext } from "../../auth";
import { authErrorResponse, buildJsonResponse, errorResponse, readRequestId } from "../../responses";
import { runtimeConfig } from "../../../runtime/config";
import { decodeCliOrgCreateBody } from "./input";
import { readJsonBody } from "../shared";

/**
 * Creates an organization for the authenticated CLI user.
 *
 * @param ctx The HTTP action context.
 * @param request The incoming HTTP request.
 * @returns The created organization summary.
 * @remarks This uses Clerk as the source of truth for workspace creation so CLI and dashboard stay aligned.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export const cliOrganizationsCreate = httpAction(async (ctx, request) => {
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

  const parsed = decodeCliOrgCreateBody(payload);
  if (parsed === null) {
    return errorResponse({
      status: 400,
      code: "INVALID_REQUEST",
      message: "name is required.",
      requestId,
    });
  }

  const authResult = await resolveAuthContext(ctx, request);
  if (isAuthResolutionFailure(authResult)) {
    return authErrorResponse({
      status: authResult.status,
      code: authResult.code,
      message: authResult.message,
      requestId,
    });
  }

  try {
    const clerk = createClerkClient({
      secretKey: runtimeConfig.clerkSecretKey,
    });
    const created = await clerk.organizations.createOrganization({
      name: parsed.name,
      slug: parsed.slug ?? undefined,
      createdBy: authResult.context.clerkUserId,
    });

    return buildJsonResponse(200, {
      organization: {
        id: created.id,
        slug: created.slug,
        name: created.name,
        imageUrl: created.imageUrl,
      },
      requestId,
    });
  } catch (error) {
    return errorResponse({
      status: 400,
      code: "ORG_CREATE_FAILED",
      message: error instanceof Error ? error.message : "Failed to create organization.",
      requestId,
    });
  }
});
