import { convexPrivateConfig } from "../generated/private_config.generated";

function requireProcessEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

function readOptionalProcessEnv(name: string): string | null {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    return null;
  }

  return value;
}

function requireGeneratedValue(name: string, value: string): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing generated Barekey Convex runtime config value: ${name}`);
  }

  return value;
}

function requireGeneratedOrProcessEnv(
  generatedName: string,
  processEnvName: string,
  generatedValue: string,
): string {
  const processValue = readOptionalProcessEnv(processEnvName);
  if (processValue !== null) {
    return processValue;
  }

  return requireGeneratedValue(generatedName, generatedValue);
}

export const runtimeConfig = {
  autumnSecretKey: requireGeneratedOrProcessEnv(
    "autumnSecretKey",
    "AUTUMN_SECRET_KEY",
    convexPrivateConfig.autumnSecretKey,
  ),
  barekeyMasterKeyBase64: requireProcessEnv("BAREKEY_MASTER_KEY_B64"),
  barekeyUiOrigin: requireGeneratedValue("barekeyUiOrigin", convexPrivateConfig.barekeyUiOrigin),
  clerkWebhookSigningSecret: readOptionalProcessEnv("CLERK_WEBHOOK_SIGNING_SECRET"),
  clerkIssuerDomain: requireGeneratedValue(
    "clerkIssuerDomain",
    convexPrivateConfig.clerkIssuerDomain,
  ),
  clerkSecretKey: requireGeneratedValue("clerkSecretKey", convexPrivateConfig.clerkSecretKey),
} as const;
