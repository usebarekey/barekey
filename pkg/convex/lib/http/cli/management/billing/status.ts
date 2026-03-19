import { makeFunctionReference } from "convex/server";

import { httpAction } from "../../../../../confect";
import { isAuthResolutionFailure, resolveAuthContext } from "../../../auth";
import { authErrorResponse, buildJsonResponse, errorResponse, readRequestId } from "../../../responses";
import { decodeCliBillingStatusBody } from "../input";
import { readJsonBody } from "../../shared";

const getBillingStateForCurrentOrgReference = makeFunctionReference<
  "action",
  {
    expectedOrgSlug: string;
  },
  unknown
>("payments:getBillingStateForCurrentOrg") as any;

/**
 * Reads billing status for one CLI-selected organization.
 *
 * @param ctx The HTTP action context.
 * @param request The incoming HTTP request.
 * @returns The billing state for the requested organization.
 * @remarks This delegates to the existing Effect/Confect billing-state action used by the dashboard.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export const cliBillingStatus = httpAction(async (ctx, request) => {
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

  const parsed = decodeCliBillingStatusBody(payload);
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

  try {
    const billing = await ctx.runAction(getBillingStateForCurrentOrgReference, {
      expectedOrgSlug: parsed.orgSlug,
    });
    return buildJsonResponse(200, {
      ...((billing ?? {}) as object),
      requestId,
    });
  } catch (error) {
    return errorResponse({
      status: 400,
      code: "BILLING_STATUS_FAILED",
      message: error instanceof Error ? error.message : "Failed to load billing status.",
      requestId,
    });
  }
});
