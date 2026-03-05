import { Command } from "commander";

import { loadConfig, loadCredentials } from "./credentials-store";
import { DEFAULT_BAREKEY_API_URL } from "./constants";
import { loadRuntimeConfig } from "./runtime-config";
import type { CliCredentials } from "./types";

export type LocalSession = {
  baseUrl: string;
  accountId: string;
  credentials: CliCredentials;
};

export type EnvTargetOptions = {
  project?: string;
  stage?: string;
  org?: string;
};

export function toJsonOutput(enabled: boolean, value: unknown): void {
  if (!enabled) {
    return;
  }
  console.log(JSON.stringify(value, null, 2));
}

export async function resolveBaseUrl(explicit: string | undefined): Promise<string> {
  const explicitUrl = explicit?.trim();
  if (explicitUrl && explicitUrl.length > 0) {
    return explicitUrl.replace(/\/$/, "");
  }

  const envUrl = process.env.BAREKEY_API_URL?.trim();
  if (envUrl && envUrl.length > 0) {
    return envUrl.replace(/\/$/, "");
  }

  const config = await loadConfig();
  if (config && config.baseUrl.length > 0) {
    return config.baseUrl.replace(/\/$/, "");
  }

  return DEFAULT_BAREKEY_API_URL;
}

export async function requireLocalSession(): Promise<LocalSession> {
  const config = await loadConfig();
  if (config === null) {
    throw new Error("Not logged in. Run barekey auth login first.");
  }

  const credentials = await loadCredentials(config.activeAccountId);
  if (credentials === null) {
    throw new Error("Saved credentials not found. Run barekey auth login again.");
  }

  return {
    baseUrl: config.baseUrl,
    accountId: config.activeAccountId,
    credentials,
  };
}

export async function resolveTarget(
  options: EnvTargetOptions,
  local: LocalSession,
): Promise<{
  projectSlug: string;
  stageSlug: string;
  orgSlug?: string;
}> {
  const runtime = await loadRuntimeConfig();

  const projectSlug = options.project?.trim() || runtime?.config.project || "";
  const stageSlug = options.stage?.trim() || runtime?.config.environment || "";
  const orgSlug = options.org?.trim() || runtime?.config.org || local.credentials.orgSlug;

  if (projectSlug.length === 0 || stageSlug.length === 0) {
    const hint = runtime
      ? `Found ${runtime.path} but project/environment is incomplete.`
      : "No barekey.json found in current directory tree.";
    throw new Error(
      `${hint} Pass --project/--stage, or create barekey.json with {\"project\":\"...\",\"environment\":\"...\"}.`,
    );
  }

  return {
    projectSlug,
    stageSlug,
    orgSlug: orgSlug.length > 0 ? orgSlug : undefined,
  };
}

export function parseChance(value: string | undefined): number {
  if (value === undefined) {
    throw new Error("--chance is required when using --ab.");
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error("--chance must be a number between 0 and 1.");
  }
  return parsed;
}

export function dotenvEscape(value: string): string {
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) {
    return value;
  }
  return JSON.stringify(value);
}

export function addTargetOptions(command: Command): Command {
  return command
    .option("--project <slug>", "Project slug")
    .option("--stage <slug>", "Stage slug")
    .option("--org <slug>", "Organization slug");
}
