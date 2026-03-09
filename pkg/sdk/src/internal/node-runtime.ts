import {
  InvalidConfigurationProvidedError,
  InvalidCredentialsProvidedError,
  NoCredentialsProvidedError,
} from "../errors.js";
import { postJson } from "./http.js";

type NodeRuntimeModules = {
  childProcess: typeof import("node:child_process");
  fs: typeof import("node:fs/promises");
  os: typeof import("node:os");
  path: typeof import("node:path");
};

type CliConfig = {
  baseUrl: string;
  activeAccountId: string;
};

type CliCredentials = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAtMs: number;
  refreshTokenExpiresAtMs: number;
  clerkUserId: string;
  orgId: string;
  orgSlug: string;
};

type StoredCliSession = {
  baseUrl: string;
  activeAccountId: string;
  credentials: CliCredentials;
};

type StoredCliSessionSource = "keychain" | "file";

type StoredCliSessionWithSource = StoredCliSession & {
  source: StoredCliSessionSource;
};

const CLI_SERVICE_NAME = "barekey-cli";

function isNodeRuntime(): boolean {
  return (
    typeof process !== "undefined" &&
    typeof process.versions === "object" &&
    process.versions !== null &&
    typeof process.versions.node === "string"
  );
}

async function loadNodeRuntime(): Promise<NodeRuntimeModules | null> {
  if (!isNodeRuntime()) {
    return null;
  }

  try {
    const [childProcess, fs, os, path] = await Promise.all([
      import("node:child_process"),
      import("node:fs/promises"),
      import("node:os"),
      import("node:path"),
    ]);

    return {
      childProcess,
      fs,
      os,
      path,
    };
  } catch {
    return null;
  }
}

type CommandResult = {
  stdout: string;
  stderr: string;
  code: number;
};

async function runCommand(
  runtime: NodeRuntimeModules,
  command: string,
  args: Array<string>,
  input?: string,
): Promise<CommandResult> {
  return await new Promise((resolve) => {
    const child = runtime.childProcess.spawn(command, args, {
      stdio: "pipe",
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", () => {
      resolve({
        stdout: "",
        stderr: "",
        code: 127,
      });
    });

    child.on("close", (code) => {
      resolve({
        stdout,
        stderr,
        code: code ?? 1,
      });
    });

    if (input !== undefined) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

async function readJsonFile<T>(runtime: NodeRuntimeModules, filePath: string): Promise<T | null> {
  try {
    const value = await runtime.fs.readFile(filePath, "utf8");
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function isCliConfig(value: unknown): value is CliConfig {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { baseUrl?: unknown }).baseUrl === "string" &&
    typeof (value as { activeAccountId?: unknown }).activeAccountId === "string"
  );
}

function isCliCredentials(value: unknown): value is CliCredentials {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.accessToken === "string" &&
    typeof candidate.refreshToken === "string" &&
    typeof candidate.accessTokenExpiresAtMs === "number" &&
    typeof candidate.refreshTokenExpiresAtMs === "number" &&
    typeof candidate.clerkUserId === "string" &&
    typeof candidate.orgId === "string" &&
    typeof candidate.orgSlug === "string"
  );
}

async function getFromKeychain(
  runtime: NodeRuntimeModules,
  account: string,
): Promise<string | null> {
  if (process.platform === "darwin") {
    const result = await runCommand(runtime, "security", [
      "find-generic-password",
      "-s",
      CLI_SERVICE_NAME,
      "-a",
      account,
      "-w",
    ]);
    if (result.code !== 0) {
      return null;
    }
    const value = result.stdout.trim();
    return value.length > 0 ? value : null;
  }

  if (process.platform === "linux") {
    const result = await runCommand(runtime, "secret-tool", [
      "lookup",
      "service",
      CLI_SERVICE_NAME,
      "account",
      account,
    ]);
    if (result.code !== 0) {
      return null;
    }
    const value = result.stdout.trim();
    return value.length > 0 ? value : null;
  }

  return null;
}

async function setInKeychain(
  runtime: NodeRuntimeModules,
  account: string,
  value: string,
): Promise<boolean> {
  if (process.platform === "darwin") {
    const result = await runCommand(runtime, "security", [
      "add-generic-password",
      "-U",
      "-s",
      CLI_SERVICE_NAME,
      "-a",
      account,
      "-w",
      value,
    ]);
    return result.code === 0;
  }

  if (process.platform === "linux") {
    const result = await runCommand(
      runtime,
      "secret-tool",
      ["store", `--label=${CLI_SERVICE_NAME}`, "service", CLI_SERVICE_NAME, "account", account],
      value,
    );
    return result.code === 0;
  }

  return false;
}

function getConfigPaths(runtime: NodeRuntimeModules): {
  configPath: string;
  credentialsDir: string;
} {
  const configDir = runtime.path.join(runtime.os.homedir(), ".config", "barekey");
  return {
    configPath: runtime.path.join(configDir, "config.json"),
    credentialsDir: runtime.path.join(configDir, "credentials"),
  };
}

function credentialsPathForAccount(
  runtime: NodeRuntimeModules,
  credentialsDir: string,
  accountId: string,
): string {
  return runtime.path.join(credentialsDir, `${encodeURIComponent(accountId)}.json`);
}

async function saveCliCredentials(
  runtime: NodeRuntimeModules,
  accountId: string,
  credentials: CliCredentials,
): Promise<void> {
  const serialized = JSON.stringify(credentials);
  if (await setInKeychain(runtime, accountId, serialized)) {
    return;
  }

  const { credentialsDir } = getConfigPaths(runtime);
  await runtime.fs.mkdir(credentialsDir, {
    recursive: true,
    mode: 0o700,
  });
  await runtime.fs.writeFile(
    credentialsPathForAccount(runtime, credentialsDir, accountId),
    serialized,
    {
      encoding: "utf8",
      mode: 0o600,
    },
  );
}

async function readCliSessionWithSource(
  runtime: NodeRuntimeModules,
): Promise<StoredCliSessionWithSource | null> {
  const { configPath, credentialsDir } = getConfigPaths(runtime);
  const rawConfig = await readJsonFile<unknown>(runtime, configPath);
  if (rawConfig === null) {
    return null;
  }
  if (!isCliConfig(rawConfig)) {
    throw new InvalidCredentialsProvidedError({
      message: "Stored Barekey CLI config is malformed.",
    });
  }

  const fromKeychain = await getFromKeychain(runtime, rawConfig.activeAccountId);
  if (fromKeychain !== null) {
    try {
      const parsed = JSON.parse(fromKeychain) as unknown;
      if (!isCliCredentials(parsed)) {
        throw new InvalidCredentialsProvidedError({
          message: "Stored Barekey CLI credentials are malformed.",
        });
      }
      return {
        baseUrl: rawConfig.baseUrl,
        activeAccountId: rawConfig.activeAccountId,
        credentials: parsed,
        source: "keychain",
      };
    } catch (error: unknown) {
      if (error instanceof InvalidCredentialsProvidedError) {
        throw error;
      }
      throw new InvalidCredentialsProvidedError({
        message: "Stored Barekey CLI credentials are malformed.",
        cause: error,
      });
    }
  }

  const fromFile = await readJsonFile<unknown>(
    runtime,
    credentialsPathForAccount(runtime, credentialsDir, rawConfig.activeAccountId),
  );
  if (fromFile === null) {
    return null;
  }
  if (!isCliCredentials(fromFile)) {
    throw new InvalidCredentialsProvidedError({
      message: "Stored Barekey CLI credentials are malformed.",
    });
  }

  return {
    baseUrl: rawConfig.baseUrl,
    activeAccountId: rawConfig.activeAccountId,
    credentials: fromFile,
    source: "file",
  };
}

export async function isFilesystemAvailable(): Promise<boolean> {
  return (await loadNodeRuntime()) !== null;
}

export async function loadBarekeyJsonConfig(): Promise<{
  path: string;
  json: Record<string, unknown>;
} | null> {
  const runtime = await loadNodeRuntime();
  if (runtime === null) {
    return null;
  }

  let current = runtime.path.resolve(process.cwd());
  while (true) {
    const candidate = runtime.path.join(current, "barekey.json");
    try {
      const raw = await runtime.fs.readFile(candidate, "utf8");
      try {
        return {
          path: candidate,
          json: JSON.parse(raw) as Record<string, unknown>,
        };
      } catch (error: unknown) {
        throw new InvalidConfigurationProvidedError({
          message: `The barekey.json file at ${candidate} is not valid JSON.`,
          cause: error,
        });
      }
    } catch (error: unknown) {
      if (error instanceof InvalidConfigurationProvidedError) {
        throw error;
      }
      const nodeError = error as NodeJS.ErrnoException | null;
      if (nodeError?.code && nodeError.code !== "ENOENT") {
        throw new InvalidConfigurationProvidedError({
          message: `The barekey.json file at ${candidate} could not be read.`,
          cause: error,
        });
      }
      const parent = runtime.path.dirname(current);
      if (parent === current) {
        return null;
      }
      current = parent;
    }
  }
}

export async function loadCliSessionAuthResolver(fetchFn: typeof globalThis.fetch): Promise<{
  baseUrl: string;
  getAccessToken(): Promise<string>;
  onUnauthorized(): Promise<void>;
} | null> {
  const runtime = await loadNodeRuntime();
  if (runtime === null) {
    return null;
  }

  let cachedSession = await readCliSessionWithSource(runtime);
  if (cachedSession === null) {
    return null;
  }

  let forceRefresh = false;

  const refreshCredentials = async (): Promise<string> => {
    const currentSession = cachedSession;
    if (currentSession === null) {
      throw new NoCredentialsProvidedError();
    }

    if (!forceRefresh && currentSession.credentials.accessTokenExpiresAtMs > Date.now() + 10_000) {
      return currentSession.credentials.accessToken;
    }

    const refreshed = await postJson<{
      accessToken: string;
      refreshToken: string;
      accessTokenExpiresAtMs: number;
      refreshTokenExpiresAtMs: number;
      clerkUserId: string;
      orgId: string;
      orgSlug: string;
    }>({
      fetchFn,
      baseUrl: currentSession.baseUrl,
      path: "/v1/cli/token/refresh",
      payload: {
        refreshToken: currentSession.credentials.refreshToken,
      },
    });

    const nextCredentials: CliCredentials = {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      accessTokenExpiresAtMs: refreshed.accessTokenExpiresAtMs,
      refreshTokenExpiresAtMs: refreshed.refreshTokenExpiresAtMs,
      clerkUserId: refreshed.clerkUserId,
      orgId: refreshed.orgId,
      orgSlug: refreshed.orgSlug,
    };

    await saveCliCredentials(runtime, currentSession.activeAccountId, nextCredentials);
    cachedSession = {
      ...currentSession,
      credentials: nextCredentials,
    };
    forceRefresh = false;
    return nextCredentials.accessToken;
  };

  return {
    baseUrl: cachedSession.baseUrl,
    async getAccessToken(): Promise<string> {
      return await refreshCredentials();
    },
    async onUnauthorized(): Promise<void> {
      forceRefresh = true;
    },
  };
}
