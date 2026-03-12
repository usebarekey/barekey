import type { AuthConfig } from "convex/server";
import { runtimeConfig } from "./lib/runtime_config";

export default {
  providers: [
    {
      domain: runtimeConfig.clerkIssuerDomain,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
