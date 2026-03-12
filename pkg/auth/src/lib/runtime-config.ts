import { authRuntimeConfig } from "../generated/runtime-config.generated";

function requireValue(name: string, value: string): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing generated Barekey auth runtime config value: ${name}`);
  }

  return value;
}

export const runtimeConfig = {
  barekeyApiUrl: requireValue("barekeyApiUrl", authRuntimeConfig.barekeyApiUrl),
  clerkPublishableKey: requireValue("clerkPublishableKey", authRuntimeConfig.clerkPublishableKey),
  clerkSignInFallbackRedirectUrl: requireValue(
    "clerkSignInFallbackRedirectUrl",
    authRuntimeConfig.clerkSignInFallbackRedirectUrl,
  ),
  clerkSignInUrl: requireValue("clerkSignInUrl", authRuntimeConfig.clerkSignInUrl),
  clerkSignUpFallbackRedirectUrl: requireValue(
    "clerkSignUpFallbackRedirectUrl",
    authRuntimeConfig.clerkSignUpFallbackRedirectUrl,
  ),
} as const;
