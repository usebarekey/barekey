import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import type { CliConfig, CliCredentials } from "./types";

const SERVICE_NAME = "barekey-cli";
const CONFIG_DIR = path.join(homedir(), ".config", "barekey");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
const FALLBACK_CREDENTIALS_PATH = path.join(CONFIG_DIR, "credentials.json");

type StoredCredentialMap = Record<string, CliCredentials>;

type CommandResult = {
  stdout: string;
  stderr: string;
  code: number;
};

function runCommand(command: string, args: Array<string>, input?: string): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
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
      resolve({ stdout: "", stderr: "", code: 127 });
    });

    child.on("close", (code) => {
      resolve({ stdout, stderr, code: code ?? 1 });
    });

    if (input !== undefined) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

async function ensureConfigDir(): Promise<void> {
  await mkdir(CONFIG_DIR, {
    recursive: true,
    mode: 0o700,
  });
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const value = await readFile(filePath, "utf8");
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await ensureConfigDir();
  await writeFile(filePath, JSON.stringify(value, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
}

async function readFallbackCredentials(): Promise<StoredCredentialMap> {
  return (await readJsonFile<StoredCredentialMap>(FALLBACK_CREDENTIALS_PATH)) ?? {};
}

async function writeFallbackCredentials(value: StoredCredentialMap): Promise<void> {
  await writeJsonFile(FALLBACK_CREDENTIALS_PATH, value);
}

async function canUseLinuxSecretTool(): Promise<boolean> {
  if (process.platform !== "linux") {
    return false;
  }
  const result = await runCommand("which", ["secret-tool"]);
  return result.code === 0;
}

async function canUseMacSecurity(): Promise<boolean> {
  if (process.platform !== "darwin") {
    return false;
  }
  const result = await runCommand("which", ["security"]);
  return result.code === 0;
}

async function setInKeychain(account: string, value: string): Promise<boolean> {
  if (await canUseMacSecurity()) {
    const result = await runCommand("security", [
      "add-generic-password",
      "-U",
      "-s",
      SERVICE_NAME,
      "-a",
      account,
      "-w",
      value,
    ]);
    return result.code === 0;
  }

  if (await canUseLinuxSecretTool()) {
    const result = await runCommand(
      "secret-tool",
      ["store", `--label=${SERVICE_NAME}`, "service", SERVICE_NAME, "account", account],
      value,
    );
    return result.code === 0;
  }

  return false;
}

async function getFromKeychain(account: string): Promise<string | null> {
  if (await canUseMacSecurity()) {
    const result = await runCommand("security", [
      "find-generic-password",
      "-s",
      SERVICE_NAME,
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

  if (await canUseLinuxSecretTool()) {
    const result = await runCommand("secret-tool", [
      "lookup",
      "service",
      SERVICE_NAME,
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

async function deleteFromKeychain(account: string): Promise<boolean> {
  if (await canUseMacSecurity()) {
    const result = await runCommand("security", [
      "delete-generic-password",
      "-s",
      SERVICE_NAME,
      "-a",
      account,
    ]);
    return result.code === 0;
  }

  if (await canUseLinuxSecretTool()) {
    const result = await runCommand("secret-tool", [
      "clear",
      "service",
      SERVICE_NAME,
      "account",
      account,
    ]);
    return result.code === 0;
  }

  return false;
}

export async function saveConfig(config: CliConfig): Promise<void> {
  await writeJsonFile(CONFIG_PATH, config);
}

export async function loadConfig(): Promise<CliConfig | null> {
  return readJsonFile<CliConfig>(CONFIG_PATH);
}

export async function clearConfig(): Promise<void> {
  await rm(CONFIG_PATH, {
    force: true,
  });
}

export async function saveCredentials(
  accountId: string,
  credentials: CliCredentials,
): Promise<void> {
  const serialized = JSON.stringify(credentials);
  const storedInKeychain = await setInKeychain(accountId, serialized);
  if (storedInKeychain) {
    return;
  }

  const fallback = await readFallbackCredentials();
  fallback[accountId] = credentials;
  await writeFallbackCredentials(fallback);
}

export async function loadCredentials(accountId: string): Promise<CliCredentials | null> {
  const fromKeychain = await getFromKeychain(accountId);
  if (fromKeychain !== null) {
    try {
      return JSON.parse(fromKeychain) as CliCredentials;
    } catch {
      return null;
    }
  }

  const fallback = await readFallbackCredentials();
  return fallback[accountId] ?? null;
}

export async function deleteCredentials(accountId: string): Promise<void> {
  const deletedFromKeychain = await deleteFromKeychain(accountId);
  if (deletedFromKeychain) {
    return;
  }

  const fallback = await readFallbackCredentials();
  if (fallback[accountId]) {
    delete fallback[accountId];
    await writeFallbackCredentials(fallback);
  }
}
