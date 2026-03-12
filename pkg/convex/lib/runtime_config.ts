import { convexPrivateConfig } from "../generated/private_config.generated";

function requireProcessEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

function requireGeneratedValue(name: string, value: string): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing generated Barekey Convex runtime config value: ${name}`);
  }

  return value;
}

export const runtimeConfig = {
  autumnSecretKey: requireGeneratedValue("autumnSecretKey", convexPrivateConfig.autumnSecretKey),
  barekeyMasterKeyBase64: requireProcessEnv("BAREKEY_MASTER_KEY_B64"),
  barekeyUiOrigin: requireGeneratedValue("barekeyUiOrigin", convexPrivateConfig.barekeyUiOrigin),
  clerkIssuerDomain: requireGeneratedValue(
    "clerkIssuerDomain",
    convexPrivateConfig.clerkIssuerDomain,
  ),
  clerkSecretKey: requireGeneratedValue("clerkSecretKey", convexPrivateConfig.clerkSecretKey),
} as const;
