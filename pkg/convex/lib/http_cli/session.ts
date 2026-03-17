import { httpAction } from "../../confect";
import { isAuthResolutionFailure, resolveAuthContext } from "../http_auth";
import {
  authErrorResponse,
  buildJsonResponse,
  readRequestId,
} from "../http_responses";

/**
 * Returns the current authenticated CLI session context.
 *
 * @param ctx The HTTP action context.
 * @param request The incoming HTTP request.
 * @returns The current auth/session context or a normalized auth error response.
 * @remarks This delegates auth resolution to the shared HTTP auth helper.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const cliSession = httpAction(async (ctx, request) => {
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
  const authContext = authResult.context;

  return buildJsonResponse(200, {
    clerkUserId: authContext.clerkUserId,
    orgId: authContext.orgId,
    orgSlug: authContext.orgSlug,
    source: authContext.source,
    requestId,
  });
});
