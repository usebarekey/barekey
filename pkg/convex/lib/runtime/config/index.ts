import { convexPrivateConfig } from "../../../generated/private_config.generated";
import { buildRuntimeConfig } from "./loader";

export const runtimeConfig = buildRuntimeConfig({
  generated: convexPrivateConfig,
  processEnv: process.env,
});
