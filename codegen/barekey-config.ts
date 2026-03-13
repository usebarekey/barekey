import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  BarekeyClient,
  FsNotAvailableError,
  InvalidCredentialsProvidedError,
  NoCredentialsProvidedError,
  UnauthorizedError,
  VariableNotFoundError,
} from "@barekey/sdk/server";
import { PublicBarekeyClient } from "@barekey/sdk/public";

import barekeyJson from "../barekey.json";
import {
  renderGeneratedConstModule,
  resolveConfigFields,
  type ConfigField,
} from "./barekey-config-lib";

const rootDir = path.resolve(import.meta.dir, "..");
const cliBinaryPath = path.join(rootDir, "node_modules", ".bin", "barekey");

const publicFieldSpecs: Array<ConfigField> = [
  { key: "barekeyApiUrl", names: ["BAREKEY_API_URL", "VITE_BAREKEY_API_URL"] },
  { key: "clerkPublishableKey", names: ["CLERK_PUBLISHABLE_KEY", "VITE_CLERK_PUBLISHABLE_KEY"] },
  {
    key: "clerkSignInFallbackRedirectUrl",
    names: [
      "CLERK_SIGN_IN_FALLBACK_REDIRECT_URL",
      "VITE_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL",
    ],
  },
  { key: "clerkSignInUrl", names: ["CLERK_SIGN_IN_URL", "VITE_CLERK_SIGN_IN_URL"] },
  {
    key: "clerkSignUpFallbackRedirectUrl",
    names: [
      "CLERK_SIGN_UP_FALLBACK_REDIRECT_URL",
      "VITE_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL",
    ],
  },
];

const uiOnlyPublicFieldSpecs: Array<ConfigField> = [
  { key: "convexUrl", names: ["CONVEX_URL", "VITE_CONVEX_URL"] },
  { key: "posthogHost", names: ["POSTHOG_HOST", "VITE_POSTHOG_HOST"] },
  { key: "posthogKey", names: ["POSTHOG_KEY", "VITE_POSTHOG_KEY"] },
  { key: "posthogUiHost", names: ["POSTHOG_UI_HOST", "VITE_POSTHOG_UI_HOST"] },
];

const convexPrivateFieldSpecs: Array<ConfigField> = [
  { key: "autumnSecretKey", names: ["AUTUMN_SECRET_KEY"] },
  { key: "barekeyUiOrigin", names: ["BAREKEY_UI_ORIGIN"] },
  { key: "clerkIssuerDomain", names: ["CLERK_JWT_ISSUER_DOMAIN"] },
  { key: "clerkSecretKey", names: ["CLERK_SECRET_KEY"] },
];

const apiProxyPrivateFieldSpecs: Array<ConfigField> = [
  { key: "convexHttpOrigin", names: ["CONVEX_HTTP_ORIGIN"] },
];

const publicClient = new PublicBarekeyClient({
  json: barekeyJson,
});

const privateClient = new BarekeyClient({
  json: barekeyJson,
  typegen: false,
});

function isMissingError(error: unknown): boolean {
  return error instanceof VariableNotFoundError;
}

function isUnavailablePrivateConfigError(error: unknown): boolean {
  if (
    error instanceof NoCredentialsProvidedError ||
    error instanceof InvalidCredentialsProvidedError ||
    error instanceof UnauthorizedError ||
    error instanceof FsNotAvailableError
  ) {
    return true;
  }

  if (error instanceof Error && error.cause !== undefined) {
    return isUnavailablePrivateConfigError(error.cause);
  }

  return false;
}

async function writeGeneratedModule(
  relativePath: string,
  exportName: string,
  values: Record<string, string>,
): Promise<void> {
  const outputPath = path.join(rootDir, relativePath);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    renderGeneratedConstModule(exportName, values, "@barekey/sdk config sync"),
    "utf8",
  );
}

async function canReuseExistingFile(relativePath: string): Promise<boolean> {
  try {
    const contents = await readFile(path.join(rootDir, relativePath), "utf8");
    return contents.trim().length > 0;
  } catch {
    return false;
  }
}

async function syncPublicConfig(): Promise<void> {
  const [sharedValues, uiValues] = await Promise.all([
    resolveConfigFields(publicFieldSpecs, {
      load: async (name) => String(await publicClient.get(name)),
      isMissingError,
    }),
    resolveConfigFields(uiOnlyPublicFieldSpecs, {
      load: async (name) => String(await publicClient.get(name)),
      isMissingError,
    }),
  ]);

  await Promise.all([
    writeGeneratedModule("pkg/ui/src/generated/runtime-config.generated.ts", "uiRuntimeConfig", {
      ...sharedValues,
      ...uiValues,
    }),
    writeGeneratedModule("pkg/auth/src/generated/runtime-config.generated.ts", "authRuntimeConfig", sharedValues),
  ]);
}

async function syncPrivateConfig(): Promise<void> {
  const targets = [
    {
      relativePath: "pkg/convex/generated/private_config.generated.ts",
      exportName: "convexPrivateConfig",
      fields: convexPrivateFieldSpecs,
    },
    {
      relativePath: "pkg/api-proxy/src/generated/private-config.generated.ts",
      exportName: "apiProxyRuntimeConfig",
      fields: apiProxyPrivateFieldSpecs,
    },
  ] as const;

  for (const target of targets) {
    try {
      const values = await resolveConfigFields([...target.fields], {
        load: async (name) => String(await privateClient.get(name)),
        isMissingError,
      });
      await writeGeneratedModule(target.relativePath, target.exportName, values);
    } catch (error: unknown) {
      if (isUnavailablePrivateConfigError(error) && (await canReuseExistingFile(target.relativePath))) {
        console.warn(
          `[barekey] Skipping private config refresh for ${target.relativePath}; existing file retained because authenticated Barekey access is unavailable.`,
        );
        continue;
      }

      throw error;
    }
  }
}

async function runCliTypegen(): Promise<void> {
  const process = Bun.spawn([cliBinaryPath, "typegen"], {
    cwd: rootDir,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const exitCode = await process.exited;
  const stdout = await new Response(process.stdout).text();
  const stderr = await new Response(process.stderr).text();
  if (exitCode === 0) {
    if (stdout.trim().length > 0) {
      console.log(stdout.trim());
    }
    if (stderr.trim().length > 0) {
      console.warn(stderr.trim());
    }
    return;
  }

  if (await canReuseExistingFile("node_modules/@barekey/sdk/generated.server.d.ts")) {
    console.warn(
      "[barekey] Skipping CLI typegen refresh; existing @barekey/sdk generated typings were kept because authenticated Barekey access is unavailable.",
    );
    return;
  }

  if (stdout.trim().length > 0) {
    console.error(stdout.trim());
  }
  if (stderr.trim().length > 0) {
    console.error(stderr.trim());
  }
  throw new Error(`barekey typegen failed with exit code ${exitCode}.`);
}

const mode = process.argv[2] ?? "all";

if (mode !== "all" && mode !== "public" && mode !== "private") {
  throw new Error(`Unknown barekey config sync mode: ${mode}`);
}

if (mode === "all" || mode === "public") {
  await syncPublicConfig();
}

if (mode === "all" || mode === "private") {
  await syncPrivateConfig();
  await runCliTypegen();
}
