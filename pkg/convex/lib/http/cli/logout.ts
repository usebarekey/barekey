import { makeFunctionReference } from "convex/server";
import { httpAction } from "../../../confect";
import { buildJsonResponse, errorResponse, readRequestId } from "../responses";
import { decodeCliRefreshTokenBody } from "./input";
import { readJsonBody } from "./shared";

const revokeSessionInternalReference = makeFunctionReference<
  "mutation",
  {
    refreshToken: string;
  },
  {
    revoked: boolean;
  }
>("cli_auth:revokeSessionInternal") as any;

/**
 * Revokes a CLI session from a refresh token.
 *
 * @param convexCtx The HTTP action context.
 * @param request The incoming HTTP request.
 * @returns The logout result or a normalized error response.
 * @remarks This is idempotent from the caller perspective; repeated revocation still returns success.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const cliLogout = httpAction(async (convexCtx, request) => {
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

  const parsed = decodeCliRefreshTokenBody(payload);
  if (parsed === null) {
    return errorResponse({
      status: 400,
      code: "INVALID_REQUEST",
      message: "refreshToken is required.",
      requestId,
    });
  }

  const result = (await convexCtx.runMutation(revokeSessionInternalReference, {
    refreshToken: parsed.refreshToken,
  })) as {
    revoked: boolean;
  };

  return buildJsonResponse(200, {
    revoked: result.revoked,
    requestId,
  });
});
