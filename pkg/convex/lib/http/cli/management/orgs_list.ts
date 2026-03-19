import { createClerkClient } from "@clerk/backend";

import { httpAction } from "../../../../confect";
import { isAuthResolutionFailure, resolveAuthContext } from "../../auth";
import { authErrorResponse, buildJsonResponse, errorResponse, readRequestId } from "../../responses";
import { runtimeConfig } from "../../../runtime/config";

/**
 * Lists organizations accessible to the authenticated CLI user.
 *
 * @param ctx The HTTP action context.
 * @param request The incoming HTTP request.
 * @returns The accessible organization memberships for the current user.
 * @remarks CLI auth is global, so this route resolves memberships from Clerk instead of treating the stored token as one fixed workspace.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export const cliOrganizationsList = httpAction(async (ctx, request) => {
  const requestId = readRequestId(request);
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
    const memberships = await clerk.users.getOrganizationMembershipList({
      userId: authResult.context.clerkUserId,
      limit: 100,
    });

    return buildJsonResponse(200, {
      organizations: memberships.data.map((membership) => ({
        id: membership.organization.id,
        slug: membership.organization.slug,
        name: membership.organization.name,
        role: membership.role,
        imageUrl: membership.organization.imageUrl,
      })),
      requestId,
    });
  } catch (error) {
    return errorResponse({
      status: 500,
      code: "ORG_LIST_FAILED",
      message: error instanceof Error ? error.message : "Failed to load organizations.",
      requestId,
    });
  }
});
