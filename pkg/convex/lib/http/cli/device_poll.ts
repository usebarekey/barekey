import { makeFunctionReference } from "convex/server";
import { httpAction } from "../../../confect";
import { buildJsonResponse, errorResponse, readRequestId } from "../responses";
import { decodeCliDevicePollBody } from "./input";
import { readJsonBody } from "./shared";

const pollDeviceCodeInternalReference = makeFunctionReference<
  "mutation",
  {
    deviceCode: string;
  },
  {
    status: "pending" | "approved" | "invalid" | "expired" | "already_exchanged";
    intervalSec: number;
    accessToken: string | null;
    refreshToken: string | null;
    accessTokenExpiresAtMs: number | null;
    refreshTokenExpiresAtMs: number | null;
    orgId: string | null;
    orgSlug: string | null;
    clerkUserId: string | null;
  }
>("cli_auth:pollDeviceCodeInternal") as any;

/**
 * Polls a CLI device authorization flow.
 *
 * @param convexCtx The HTTP action context.
 * @param request The incoming HTTP request.
 * @returns The device polling state or issued CLI session tokens.
 * @remarks This normalizes invalid, expired, and already-consumed device states into explicit HTTP responses.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const cliDevicePoll = httpAction(async (convexCtx, request) => {
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

  const decoded = decodeCliDevicePollBody(payload);
  if (decoded === null) {
    return errorResponse({
      status: 400,
      code: "INVALID_REQUEST",
      message: "deviceCode is required.",
      requestId,
    });
  }

  const pollResult = (await convexCtx.runMutation(pollDeviceCodeInternalReference, {
    deviceCode: decoded.deviceCode,
  })) as {
    status: "pending" | "approved" | "invalid" | "expired" | "already_exchanged";
    intervalSec: number;
    accessToken: string | null;
    refreshToken: string | null;
    accessTokenExpiresAtMs: number | null;
    refreshTokenExpiresAtMs: number | null;
    orgId: string | null;
    orgSlug: string | null;
    clerkUserId: string | null;
  };

  if (pollResult.status === "invalid") {
    return errorResponse({
      status: 404,
      code: "INVALID_DEVICE_CODE",
      message: "Device code is invalid.",
      requestId,
    });
  }

  if (pollResult.status === "expired") {
    return errorResponse({
      status: 410,
      code: "DEVICE_CODE_EXPIRED",
      message: "Device code expired before approval.",
      requestId,
    });
  }

  if (pollResult.status === "already_exchanged") {
    return errorResponse({
      status: 409,
      code: "DEVICE_CODE_ALREADY_CONSUMED",
      message: "Device code has already been consumed.",
      requestId,
    });
  }

  if (pollResult.status === "pending") {
    return buildJsonResponse(200, {
      status: "pending",
      intervalSec: pollResult.intervalSec,
      requestId,
    });
  }

  return buildJsonResponse(200, {
    status: "approved",
    intervalSec: pollResult.intervalSec,
    accessToken: pollResult.accessToken,
    refreshToken: pollResult.refreshToken,
    accessTokenExpiresAtMs: pollResult.accessTokenExpiresAtMs,
    refreshTokenExpiresAtMs: pollResult.refreshTokenExpiresAtMs,
    orgId: pollResult.orgId,
    orgSlug: pollResult.orgSlug,
    clerkUserId: pollResult.clerkUserId,
    requestId,
  });
});
