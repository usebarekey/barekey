import { uiRuntimeConfig } from "../generated/runtime-config.generated";

function requireValue(name: string, value: string): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing generated Barekey UI runtime config value: ${name}`);
  }

  return value;
}

export const runtimeConfig = {
  barekeyApiUrl: requireValue("barekeyApiUrl", uiRuntimeConfig.barekeyApiUrl),
  clerkPublishableKey: requireValue("clerkPublishableKey", uiRuntimeConfig.clerkPublishableKey),
  clerkSignInFallbackRedirectUrl: requireValue(
    "clerkSignInFallbackRedirectUrl",
    uiRuntimeConfig.clerkSignInFallbackRedirectUrl,
  ),
  clerkSignInUrl: requireValue("clerkSignInUrl", uiRuntimeConfig.clerkSignInUrl),
  clerkSignUpFallbackRedirectUrl: requireValue(
    "clerkSignUpFallbackRedirectUrl",
    uiRuntimeConfig.clerkSignUpFallbackRedirectUrl,
  ),
  convexUrl: requireValue("convexUrl", uiRuntimeConfig.convexUrl),
  posthogHost: requireValue("posthogHost", uiRuntimeConfig.posthogHost),
  posthogKey: requireValue("posthogKey", uiRuntimeConfig.posthogKey),
  posthogUiHost: requireValue("posthogUiHost", uiRuntimeConfig.posthogUiHost),
} as const;
