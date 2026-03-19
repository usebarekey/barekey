import { Either, Schema } from "effect";
import { makeFunctionReference } from "convex/server";
import { httpAction } from "../../../confect";
import { getOrgClaimsFromIdentity } from "../auth";
import { readIdentityOrNull } from "../auth";
import { buildJsonResponse, errorResponse, readRequestId } from "../responses";
import { decodeCliDeviceCompleteBody } from "./input";
import { readJsonBody } from "./shared";

const nonEmptyErrorSchema = Schema.instanceOf(Error).pipe(
  Schema.filter((error) => error.message.length > 0),
);

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
 * @param convexCtx The HTTP action context.
 * @param request The incoming HTTP request.
 * @returns The completed device response or a normalized error response.
 * @remarks This requires a Clerk JWT with an active organization and delegates approval to the internal CLI auth mutation.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const cliDeviceComplete = httpAction(async (convexCtx, request) => {
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

  const decoded = decodeCliDeviceCompleteBody(payload);
  if (decoded === null) {
    return errorResponse({
      status: 400,
      code: "INVALID_REQUEST",
      message: "userCode is required.",
      requestId,
    });
  }

  const identity = await readIdentityOrNull(convexCtx.auth);
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
    const result = (await convexCtx.runMutation(
      completeDeviceCodeForCurrentUserInternalReference,
      {
        userCode: decoded.userCode,
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
    const decodedError = Schema.decodeUnknownEither(nonEmptyErrorSchema)(error);
    return errorResponse({
      status: 400,
      code: "DEVICE_COMPLETE_FAILED",
      message: Either.isRight(decodedError)
        ? decodedError.right.message
        : "Unable to complete device authorization.",
      requestId,
    });
  }
});
