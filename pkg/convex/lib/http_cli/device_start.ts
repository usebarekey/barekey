import { internal } from "../../_generated/api";
import { httpAction } from "../../confect";
import { readOptionalString } from "../http_env";
import { buildJsonResponse, readRequestId } from "../http_responses";
import { getCliUiOrigin, readJsonBody } from "./shared";

/**
 * Starts a CLI device authorization flow.
 *
 * @param ctx The HTTP action context.
 * @param request The incoming HTTP request.
 * @returns The device code payload and verification URL.
 * @remarks Invalid or missing JSON bodies fall back to an empty object so device start stays tolerant.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const cliDeviceStart = httpAction(async (ctx, request) => {
  const requestId = readRequestId(request);
  let payload: unknown = {};
  try {
    payload = await readJsonBody(request);
  } catch {
    payload = {};
  }
  const input =
    typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  const clientName = readOptionalString(input, "clientName");

  const deviceStart = await ctx.runMutation(internal.cli_auth.createDeviceCodeInternal, {
    clientName,
  });

  const uiOrigin = getCliUiOrigin(request);
  const verificationUrl = new URL(`${uiOrigin}/cli/device`);
  verificationUrl.searchParams.set("user_code", deviceStart.userCode);
  if (clientName !== null) {
    verificationUrl.searchParams.set("client_name", clientName);
  }

  return buildJsonResponse(200, {
    deviceCode: deviceStart.deviceCode,
    userCode: deviceStart.userCode,
    verificationUri: verificationUrl.toString(),
    intervalSec: deviceStart.intervalSec,
    expiresInSec: deviceStart.expiresInSec,
    requestId,
  });
});
