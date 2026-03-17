import { internal } from "../../_generated/api";
import { httpAction } from "../../confect";
import { readOptionalString } from "../http_env";
import { buildJsonResponse, errorResponse, readRequestId } from "../http_responses";
import { readJsonBody } from "./shared";

/**
 * Revokes a CLI session from a refresh token.
 *
 * @param ctx The HTTP action context.
 * @param request The incoming HTTP request.
 * @returns The logout result or a normalized error response.
 * @remarks This is idempotent from the caller perspective; repeated revocation still returns success.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const cliLogout = httpAction(async (ctx, request) => {
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

  if (typeof payload !== "object" || payload === null) {
    return errorResponse({
      status: 400,
      code: "INVALID_REQUEST",
      message: "refreshToken is required.",
      requestId,
    });
  }

  const input = payload as Record<string, unknown>;
  const refreshToken = readOptionalString(input, "refreshToken");
  if (refreshToken === null) {
    return errorResponse({
      status: 400,
      code: "INVALID_REQUEST",
      message: "refreshToken is required.",
      requestId,
    });
  }

  const result = await ctx.runMutation(internal.cli_auth.revokeSessionInternal, {
    refreshToken,
  });

  return buildJsonResponse(200, {
    revoked: result.revoked,
    requestId,
  });
});
