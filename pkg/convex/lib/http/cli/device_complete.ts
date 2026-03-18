import { makeFunctionReference } from "convex/server";
import { httpAction } from "../../../confect";
import { getOrgClaimsFromIdentity } from "../auth";
import { readIdentityOrNull } from "../auth";
import { readOptionalString } from "../env";
import { buildJsonResponse, errorResponse, readRequestId } from "../responses";
import { readJsonBody } from "./shared";

const completeDeviceCodeForCurrentUserInternalReference = makeFunctionReference<
  "mutation",
  {
    userCode: string;
    clerkUserId: string;
    orgId: string;
    orgSlug: string;
  },
  {
    status: "completed";
    orgSlug: string;
  }
>("cli_auth:completeDeviceCodeForCurrentUserInternal") as any;

/**
 * Completes a CLI device authorization flow for the current Clerk-authenticated user.
 *
 * @param ctx The HTTP action context.
 * @param request The incoming HTTP request.
 * @returns The completed device response or a normalized error response.
 * @remarks This requires a Clerk JWT with an active organization and delegates approval to the internal CLI auth mutation.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const cliDeviceComplete = httpAction(async (ctx, request) => {
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
      message: "userCode is required.",
      requestId,
    });
  }

  const input = payload as Record<string, unknown>;
  const userCode = readOptionalString(input, "userCode");
  if (userCode === null) {
    return errorResponse({
      status: 400,
      code: "INVALID_REQUEST",
      message: "userCode is required.",
      requestId,
    });
  }

  const identity = await readIdentityOrNull(ctx.auth);
  if (identity === null) {
    return errorResponse({
      status: 401,
      code: "UNAUTHORIZED",
      message: "A valid Clerk JWT is required.",
      requestId,
    });
  }

  const claims = getOrgClaimsFromIdentity(identity);
  if (claims.orgId === null || claims.orgSlug === null) {
    return errorResponse({
      status: 403,
      code: "ORG_SCOPE_INVALID",
      message: "No active organization selected for this token.",
      requestId,
    });
  }

  try {
    const result = (await ctx.runMutation(
      completeDeviceCodeForCurrentUserInternalReference,
      {
        userCode,
        clerkUserId: claims.clerkUserId,
        orgId: claims.orgId,
        orgSlug: claims.orgSlug,
      },
    )) as {
      status: "completed";
      orgSlug: string;
    };

    return buildJsonResponse(200, {
      status: result.status,
      orgSlug: result.orgSlug,
      requestId,
    });
  } catch (error: unknown) {
    return errorResponse({
      status: 400,
      code: "DEVICE_COMPLETE_FAILED",
      message: error instanceof Error ? error.message : "Unable to complete device authorization.",
      requestId,
    });
  }
});
