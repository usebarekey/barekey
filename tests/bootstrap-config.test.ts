import { describe, expect, test } from "bun:test";

import {
  buildSeedEntries,
  parseBarekeyScope,
  parseKeyValueLines,
  renderConvexPrivateConfigModule,
  renderUiRuntimeConfigModule,
  toConvexPrivateRuntimeValues,
  toPublicRuntimeValues,
} from "../scripts/bootstrap-lib";

describe("bootstrap config helpers", () => {
  test("parses barekey.json scope", () => {
    expect(
      parseBarekeyScope(
        JSON.stringify({
          organization: "barekey-6227",
          project: "barekey",
          environment: "production",
        }),
      ),
    ).toEqual({
      organization: "barekey-6227",
      project: "barekey",
      environment: "production",
    });
  });

  test("parses dotenv-style key value lines", () => {
    expect(parseKeyValueLines('FOO="bar"\nBAR=baz\n# comment\nEMPTY=\n')).toEqual({
      BAR: "baz",
      EMPTY: "",
      FOO: "bar",
    });
  });

  test("builds public and private seed entries", () => {
    const entries = buildSeedEntries({
      AUTUMN_SECRET_KEY: "autumn",
      BAREKEY_UI_ORIGIN: "https://barekey.dev",
      CLERK_JWT_ISSUER_DOMAIN: "https://issuer.example",
      CLERK_SECRET_KEY: "clerk-secret",
      VITE_CLERK_PUBLISHABLE_KEY: "pk_test_123",
      VITE_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: "/",
      VITE_CLERK_SIGN_IN_URL: "/auth/sso",
      VITE_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: "/",
      VITE_CONVEX_SITE_URL: "https://example.convex.site",
      VITE_CONVEX_URL: "https://example.convex.cloud",
      VITE_POSTHOG_HOST: "https://a.barekey.dev",
      VITE_POSTHOG_KEY: "phc_123",
      VITE_POSTHOG_UI_HOST: "https://us.posthog.com",
    });

    expect(
      entries.some((entry) => entry.name === "VITE_POSTHOG_KEY" && entry.visibility === "public"),
    ).toBe(true);
    expect(
      entries.some((entry) => entry.name === "CLERK_SECRET_KEY" && entry.visibility === "private"),
    ).toBe(true);
    expect(entries.find((entry) => entry.name === "CONVEX_HTTP_ORIGIN")?.value).toBe(
      "https://example.convex.site",
    );
  });

  test("renders generated modules from Barekey values", () => {
    const publicModule = renderUiRuntimeConfigModule(
      toPublicRuntimeValues({
        VITE_BAREKEY_API_URL: "https://api.barekey.dev",
        VITE_CLERK_PUBLISHABLE_KEY: "pk_test_123",
        VITE_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: "/",
        VITE_CLERK_SIGN_IN_URL: "/auth/sso",
        VITE_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: "/",
        VITE_CONVEX_URL: "https://example.convex.cloud",
        VITE_POSTHOG_HOST: "https://a.barekey.dev",
        VITE_POSTHOG_KEY: "phc_123",
        VITE_POSTHOG_UI_HOST: "https://us.posthog.com",
      }),
    );
    const privateModule = renderConvexPrivateConfigModule(
      toConvexPrivateRuntimeValues({
        AUTUMN_SECRET_KEY: "autumn",
        BAREKEY_UI_ORIGIN: "https://barekey.dev",
        CLERK_JWT_ISSUER_DOMAIN: "https://issuer.example",
        CLERK_SECRET_KEY: "clerk-secret",
      }),
    );

    expect(publicModule).toContain("export const uiRuntimeConfig =");
    expect(publicModule).toContain('"convexUrl": "https://example.convex.cloud"');
    expect(privateModule).toContain('"clerkSecretKey": "clerk-secret"');
  });
});
