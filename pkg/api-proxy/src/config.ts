import { apiProxyRuntimeConfig } from "./generated/private-config.generated";

function requireGeneratedValue(name: string, value: string): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing generated Barekey API proxy runtime config value: ${name}`);
  }

  return value;
}

export const runtimeConfig = {
  convexHttpOrigin: requireGeneratedValue(
    "convexHttpOrigin",
    apiProxyRuntimeConfig.convexHttpOrigin,
  ),
} as const;
