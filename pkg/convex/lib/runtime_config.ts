import { convexPrivateConfig } from "../generated/private_config.generated";
import { buildRuntimeConfig } from "./runtime_config_loader";

export const runtimeConfig = buildRuntimeConfig({
  generated: convexPrivateConfig,
  processEnv: process.env,
});
