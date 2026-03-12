export type BarekeyScope = {
  organization: string;
  project: string;
  environment: string;
};

export type SeedEntry = {
  name: string;
  value: string;
  visibility: "private" | "public";
  declaredType: "string";
};

export type PublicRuntimeValues = {
  convexUrl: string;
  clerkPublishableKey: string;
  clerkSignInUrl: string;
  clerkSignInFallbackRedirectUrl: string;
  clerkSignUpFallbackRedirectUrl: string;
  posthogKey: string;
  posthogHost: string;
  posthogUiHost: string;
  barekeyApiUrl: string;
};

export type ConvexPrivateRuntimeValues = {
  autumnSecretKey: string;
  barekeyUiOrigin: string;
  clerkIssuerDomain: string;
  clerkSecretKey: string;
};

export type ApiProxyRuntimeValues = {
  convexHttpOrigin: string;
};

const emptyTableOutput = "There are no documents in this table.";

export const publicSeedVariableNames = [
  "VITE_BAREKEY_API_URL",
  "VITE_CLERK_PUBLISHABLE_KEY",
  "VITE_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL",
  "VITE_CLERK_SIGN_IN_URL",
  "VITE_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL",
  "VITE_CONVEX_URL",
  "VITE_POSTHOG_HOST",
  "VITE_POSTHOG_KEY",
  "VITE_POSTHOG_UI_HOST",
] as const;

export const privateSeedVariableNames = [
  "AUTUMN_SECRET_KEY",
  "BAREKEY_UI_ORIGIN",
  "CLERK_JWT_ISSUER_DOMAIN",
  "CLERK_SECRET_KEY",
  "CONVEX_HTTP_ORIGIN",
] as const;

export function parseBarekeyScope(json: string): BarekeyScope {
  const parsed = JSON.parse(json) as Record<string, unknown>;
  const organization =
    (typeof parsed.organization === "string" ? parsed.organization : undefined) ??
    (typeof parsed.org === "string" ? parsed.org : undefined);
  const project = typeof parsed.project === "string" ? parsed.project : undefined;
  const environment =
    (typeof parsed.environment === "string" ? parsed.environment : undefined) ??
    (typeof parsed.stage === "string" ? parsed.stage : undefined);

  if (!organization || !project || !environment) {
    throw new Error("barekey.json must define organization, project, and environment.");
  }

  return {
    organization: organization.trim(),
    project: project.trim(),
    environment: environment.trim(),
  };
}

export function parseKeyValueLines(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

export function parseConvexJson<T>(text: string): T {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed === emptyTableOutput) {
    return [] as T;
  }
  return JSON.parse(trimmed) as T;
}

function requireSourceValue(
  source: Record<string, string>,
  name: string,
  fallback?: string,
): string {
  const value = source[name] ?? fallback;
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing bootstrap source value for ${name}.`);
  }
  return value.trim();
}

export function buildSeedEntries(source: Record<string, string>): Array<SeedEntry> {
  return [
    {
      name: "VITE_BAREKEY_API_URL",
      value: requireSourceValue(source, "VITE_BAREKEY_API_URL", "https://api.barekey.dev"),
      visibility: "public",
      declaredType: "string",
    },
    {
      name: "VITE_CLERK_PUBLISHABLE_KEY",
      value: requireSourceValue(source, "VITE_CLERK_PUBLISHABLE_KEY"),
      visibility: "public",
      declaredType: "string",
    },
    {
      name: "VITE_CLERK_SIGN_IN_URL",
      value: requireSourceValue(source, "VITE_CLERK_SIGN_IN_URL", "/auth/sso"),
      visibility: "public",
      declaredType: "string",
    },
    {
      name: "VITE_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL",
      value: requireSourceValue(source, "VITE_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL", "/"),
      visibility: "public",
      declaredType: "string",
    },
    {
      name: "VITE_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL",
      value: requireSourceValue(source, "VITE_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL", "/"),
      visibility: "public",
      declaredType: "string",
    },
    {
      name: "VITE_CONVEX_URL",
      value: requireSourceValue(source, "VITE_CONVEX_URL"),
      visibility: "public",
      declaredType: "string",
    },
    {
      name: "VITE_POSTHOG_KEY",
      value: requireSourceValue(source, "VITE_POSTHOG_KEY"),
      visibility: "public",
      declaredType: "string",
    },
    {
      name: "VITE_POSTHOG_HOST",
      value: requireSourceValue(source, "VITE_POSTHOG_HOST", "https://a.barekey.dev"),
      visibility: "public",
      declaredType: "string",
    },
    {
      name: "VITE_POSTHOG_UI_HOST",
      value: requireSourceValue(source, "VITE_POSTHOG_UI_HOST", "https://us.posthog.com"),
      visibility: "public",
      declaredType: "string",
    },
    {
      name: "AUTUMN_SECRET_KEY",
      value: requireSourceValue(source, "AUTUMN_SECRET_KEY"),
      visibility: "private",
      declaredType: "string",
    },
    {
      name: "BAREKEY_UI_ORIGIN",
      value: requireSourceValue(source, "BAREKEY_UI_ORIGIN"),
      visibility: "private",
      declaredType: "string",
    },
    {
      name: "CLERK_JWT_ISSUER_DOMAIN",
      value: requireSourceValue(source, "CLERK_JWT_ISSUER_DOMAIN"),
      visibility: "private",
      declaredType: "string",
    },
    {
      name: "CLERK_SECRET_KEY",
      value: requireSourceValue(source, "CLERK_SECRET_KEY"),
      visibility: "private",
      declaredType: "string",
    },
    {
      name: "CONVEX_HTTP_ORIGIN",
      value: requireSourceValue(source, "CONVEX_HTTP_ORIGIN", source.VITE_CONVEX_SITE_URL),
      visibility: "private",
      declaredType: "string",
    },
  ];
}

function renderModule(name: string, value: unknown): string {
  return [
    "/* eslint-disable */",
    "/* This file is generated by Barekey bootstrap sync. */",
    "",
    `export const ${name} = ${JSON.stringify(value, null, 2)} as const;`,
    "",
  ].join("\n");
}

export function toPublicRuntimeValues(values: Record<string, string>): PublicRuntimeValues {
  return {
    barekeyApiUrl: requireSourceValue(values, "VITE_BAREKEY_API_URL", "https://api.barekey.dev"),
    clerkPublishableKey: requireSourceValue(values, "VITE_CLERK_PUBLISHABLE_KEY"),
    clerkSignInFallbackRedirectUrl: requireSourceValue(
      values,
      "VITE_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL",
      "/",
    ),
    clerkSignInUrl: requireSourceValue(values, "VITE_CLERK_SIGN_IN_URL", "/auth/sso"),
    clerkSignUpFallbackRedirectUrl: requireSourceValue(
      values,
      "VITE_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL",
      "/",
    ),
    convexUrl: requireSourceValue(values, "VITE_CONVEX_URL"),
    posthogHost: requireSourceValue(values, "VITE_POSTHOG_HOST", "https://a.barekey.dev"),
    posthogKey: requireSourceValue(values, "VITE_POSTHOG_KEY"),
    posthogUiHost: requireSourceValue(values, "VITE_POSTHOG_UI_HOST", "https://us.posthog.com"),
  };
}

export function toConvexPrivateRuntimeValues(
  values: Record<string, string>,
): ConvexPrivateRuntimeValues {
  return {
    autumnSecretKey: requireSourceValue(values, "AUTUMN_SECRET_KEY"),
    barekeyUiOrigin: requireSourceValue(values, "BAREKEY_UI_ORIGIN"),
    clerkIssuerDomain: requireSourceValue(values, "CLERK_JWT_ISSUER_DOMAIN"),
    clerkSecretKey: requireSourceValue(values, "CLERK_SECRET_KEY"),
  };
}

export function toApiProxyRuntimeValues(values: Record<string, string>): ApiProxyRuntimeValues {
  return {
    convexHttpOrigin: requireSourceValue(values, "CONVEX_HTTP_ORIGIN", values.VITE_CONVEX_SITE_URL),
  };
}

export function renderUiRuntimeConfigModule(values: PublicRuntimeValues): string {
  return renderModule("uiRuntimeConfig", values);
}

export function renderAuthRuntimeConfigModule(values: PublicRuntimeValues): string {
  return renderModule("authRuntimeConfig", values);
}

export function renderConvexPrivateConfigModule(values: ConvexPrivateRuntimeValues): string {
  return renderModule("convexPrivateConfig", values);
}

export function renderApiProxyConfigModule(values: ApiProxyRuntimeValues): string {
  return renderModule("apiProxyRuntimeConfig", values);
}
