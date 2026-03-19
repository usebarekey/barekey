import { makeFunctionReference } from "convex/server";
import { httpAction } from "../../../confect";
import { buildJsonResponse, readRequestId } from "../responses";
import { decodeCliDeviceStartBody } from "./input";
import { getCliUiOrigin, readJsonBody } from "./shared";

const createDeviceCodeInternalReference = makeFunctionReference<
  "mutation",
  {
    clientName: string | null;
  },
  {
    deviceCode: string;
    userCode: string;
    intervalSec: number;
    expiresInSec: number;
  }
>("cli_auth:createDeviceCodeInternal") as any;

/**
 * Starts a CLI device authorization flow.
 *
 * @param convexCtx The HTTP action context.
 * @param request The incoming HTTP request.
 * @returns The device code payload and verification URL.
 * @remarks Invalid or missing JSON bodies fall back to an empty object so device start stays tolerant.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export const cliDeviceStart = httpAction(async (convexCtx, request) => {
  const requestId = readRequestId(request);
  let payload: unknown = {};
  try {
    payload = await readJsonBody(request);
  } catch {
    payload = {};
  }
  const { clientName } = decodeCliDeviceStartBody(payload);

  const deviceStart = (await convexCtx.runMutation(createDeviceCodeInternalReference, {
    clientName,
  })) as {
    deviceCode: string;
    userCode: string;
    intervalSec: number;
    expiresInSec: number;
  };

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
