import { describe, expect, test } from "bun:test";

import { buildRuntimeConfig } from "../../pkg/convex/lib/runtime/config/loader";

const generated = {
  autumnSecretKey: "generated-autumn",
  barekeyUiOrigin: "https://auth.example.test",
  clerkIssuerDomain: "https://clerk.example.test",
  clerkSecretKey: "generated-clerk-secret",
} as const;

describe("buildRuntimeConfig", () => {
  test("prefers AUTUMN_SECRET_KEY from process env", () => {
    expect(
      buildRuntimeConfig({
        generated,
        processEnv: {
          AUTUMN_SECRET_KEY: "env-autumn",
          BAREKEY_MASTER_KEY_B64: "master-key",
        },
      }),
    ).toEqual({
      autumnSecretKey: "env-autumn",
      barekeyMasterKeyBase64: "master-key",
      barekeyUiOrigin: generated.barekeyUiOrigin,
      clerkWebhookSigningSecret: null,
      clerkIssuerDomain: generated.clerkIssuerDomain,
      clerkSecretKey: generated.clerkSecretKey,
    });
  });

  test("falls back to generated values for non-env config", () => {
    expect(
      buildRuntimeConfig({
        generated,
        processEnv: {
          BAREKEY_MASTER_KEY_B64: "master-key",
          CLERK_WEBHOOK_SIGNING_SECRET: "whsec_123",
        },
      }),
    ).toEqual({
      autumnSecretKey: generated.autumnSecretKey,
      barekeyMasterKeyBase64: "master-key",
      barekeyUiOrigin: generated.barekeyUiOrigin,
      clerkWebhookSigningSecret: "whsec_123",
      clerkIssuerDomain: generated.clerkIssuerDomain,
      clerkSecretKey: generated.clerkSecretKey,
    });
  });

  test("rejects missing required process env values", () => {
    expect(() =>
      buildRuntimeConfig({
        generated,
        processEnv: {},
      }),
    ).toThrow("Missing BAREKEY_MASTER_KEY_B64.");
  });

  test("rejects blank generated values that the runtime depends on", () => {
    expect(() =>
      buildRuntimeConfig({
        generated: {
          ...generated,
          barekeyUiOrigin: "   ",
        },
        processEnv: {
          BAREKEY_MASTER_KEY_B64: "master-key",
        },
      }),
    ).toThrow("Missing generated Barekey Convex runtime config value: barekeyUiOrigin");
  });
});
