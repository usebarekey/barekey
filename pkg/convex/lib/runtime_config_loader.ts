export type ConvexGeneratedPrivateConfig = {
  autumnSecretKey: string;
  barekeyUiOrigin: string;
  clerkIssuerDomain: string;
  clerkSecretKey: string;
};

export type ConvexRuntimeConfig = {
  autumnSecretKey: string;
  barekeyMasterKeyBase64: string;
  barekeyUiOrigin: string;
  clerkWebhookSigningSecret: string | null;
  clerkIssuerDomain: string;
  clerkSecretKey: string;
};

function readNonEmptyString(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requireProcessEnv(
  processEnv: Record<string, string | undefined>,
  name: string,
): string {
  const value = readNonEmptyString(processEnv[name]);
  if (value === null) {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

function readOptionalProcessEnv(
  processEnv: Record<string, string | undefined>,
  name: string,
): string | null {
  return readNonEmptyString(processEnv[name]);
}

function requireGeneratedValue(name: string, value: string): string {
  const normalized = readNonEmptyString(value);
  if (normalized === null) {
    throw new Error(`Missing generated Barekey Convex runtime config value: ${name}`);
  }

  return normalized;
}

function requireGeneratedOrProcessEnv(input: {
  generatedName: string;
  processEnvName: string;
  generatedValue: string;
  processEnv: Record<string, string | undefined>;
}): string {
  const processValue = readOptionalProcessEnv(input.processEnv, input.processEnvName);
  if (processValue !== null) {
    return processValue;
  }

  return requireGeneratedValue(input.generatedName, input.generatedValue);
}

export function buildRuntimeConfig(input: {
  generated: ConvexGeneratedPrivateConfig;
  processEnv: Record<string, string | undefined>;
}): ConvexRuntimeConfig {
  return {
    autumnSecretKey: requireGeneratedOrProcessEnv({
      generatedName: "autumnSecretKey",
      processEnvName: "AUTUMN_SECRET_KEY",
      generatedValue: input.generated.autumnSecretKey,
      processEnv: input.processEnv,
    }),
    barekeyMasterKeyBase64: requireProcessEnv(input.processEnv, "BAREKEY_MASTER_KEY_B64"),
    barekeyUiOrigin: requireGeneratedValue("barekeyUiOrigin", input.generated.barekeyUiOrigin),
    clerkWebhookSigningSecret: readOptionalProcessEnv(
      input.processEnv,
      "CLERK_WEBHOOK_SIGNING_SECRET",
    ),
    clerkIssuerDomain: requireGeneratedValue(
      "clerkIssuerDomain",
      input.generated.clerkIssuerDomain,
    ),
    clerkSecretKey: requireGeneratedValue("clerkSecretKey", input.generated.clerkSecretKey),
  };
}
