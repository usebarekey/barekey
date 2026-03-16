import { httpRouter } from "convex/server";

import {
  cliDeviceComplete,
  cliDevicePoll,
  cliDeviceStart,
  cliLogout,
  cliSession,
  cliTokenRefresh,
} from "./lib/http_cli";
import {
  envDefinitions,
  envList,
  envPull,
  envWrite,
  evaluateBatch,
  evaluateOne,
  publicEnvDefinitions,
} from "./lib/http_env_routes";
import { clerkWebhook, corsPreflight, typegenManifest } from "./lib/http_misc";

const http = httpRouter();

function registerCorsRoute(
  path: string,
  method: "GET" | "POST",
  handler: Parameters<typeof http.route>[0]["handler"],
): void {
  http.route({
    path,
    method,
    handler,
  });
  http.route({
    path,
    method: "OPTIONS",
    handler: corsPreflight,
  });
}

registerCorsRoute("/v1/env/evaluate", "POST", evaluateOne);
registerCorsRoute("/v1/env/evaluate-batch", "POST", evaluateBatch);
registerCorsRoute("/v1/env/list", "POST", envList);
registerCorsRoute("/v1/env/write", "POST", envWrite);
registerCorsRoute("/v1/env/pull", "POST", envPull);
registerCorsRoute("/v1/env/definitions", "POST", envDefinitions);
registerCorsRoute("/v1/public/env/definitions", "POST", publicEnvDefinitions);

registerCorsRoute("/v1/cli/device/start", "POST", cliDeviceStart);
registerCorsRoute("/v1/cli/device/complete", "POST", cliDeviceComplete);
registerCorsRoute("/v1/cli/device/poll", "POST", cliDevicePoll);
registerCorsRoute("/v1/cli/token/refresh", "POST", cliTokenRefresh);
registerCorsRoute("/v1/cli/logout", "POST", cliLogout);
registerCorsRoute("/v1/cli/session", "GET", cliSession);

registerCorsRoute("/v1/typegen/manifest", "GET", typegenManifest);
registerCorsRoute("/v1/internal/clerk/webhook", "POST", clerkWebhook);

export default http;
