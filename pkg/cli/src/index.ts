#!/usr/bin/env node
import { setTimeout as wait } from "node:timers/promises";

import { createBarekeyClient } from "@barekey/sdk";
import { Command } from "commander";
import open from "open";

import { createCliAuthProvider } from "./auth-provider";
import {
  clearConfig,
  deleteCredentials,
  loadConfig,
  loadCredentials,
  saveConfig,
  saveCredentials,
} from "./credentials-store";
import { getJson, postJson } from "./http";
import type { CliCredentials } from "./types";
import { writeTypegenFile } from "./typegen";

function resolveBaseUrl(explicit: string | undefined): string {
  const fromConfig = explicit?.trim();
  if (fromConfig && fromConfig.length > 0) {
    return fromConfig.replace(/\/$/, "");
  }
  const fromEnv = process.env.BAREKEY_API_URL?.trim();
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv.replace(/\/$/, "");
  }
  throw new Error("Missing base URL. Set --base-url or BAREKEY_API_URL.");
}

async function requireLocalSession(): Promise<{
  baseUrl: string;
  accountId: string;
  credentials: CliCredentials;
}> {
  const config = await loadConfig();
  if (config === null) {
    throw new Error("Not logged in. Run barekey login first.");
  }

  const credentials = await loadCredentials(config.activeAccountId);
  if (credentials === null) {
    throw new Error("Saved credentials not found. Run barekey login again.");
  }

  return {
    baseUrl: config.baseUrl,
    accountId: config.activeAccountId,
    credentials,
  };
}

const program = new Command();
program.name("barekey").description("Barekey internal CLI").version("0.1.0");

program
  .command("login")
  .description("Authenticate this machine using browser device flow")
  .option("--base-url <url>", "Barekey API base URL")
  .action(async (options: { baseUrl?: string }) => {
    const baseUrl = resolveBaseUrl(options.baseUrl);
    const started = await postJson<{
      deviceCode: string;
      userCode: string;
      verificationUri: string;
      intervalSec: number;
      expiresInSec: number;
    }>({
      baseUrl,
      path: "/v1/cli/device/start",
      payload: {
        clientName: "barekey-cli",
      },
    });

    console.log(`Open this URL to authorize: ${started.verificationUri}`);
    console.log(`User code: ${started.userCode}`);

    try {
      await open(started.verificationUri);
    } catch {
      // No-op if open fails in headless environments.
    }

    const startedAtMs = Date.now();
    const expiresAtMs = startedAtMs + started.expiresInSec * 1000;

    while (Date.now() < expiresAtMs) {
      const poll = await postJson<
        | {
            status: "pending";
            intervalSec: number;
          }
        | {
            status: "approved";
            accessToken: string;
            refreshToken: string;
            accessTokenExpiresAtMs: number;
            refreshTokenExpiresAtMs: number;
            orgId: string;
            orgSlug: string;
            clerkUserId: string;
          }
      >({
        baseUrl,
        path: "/v1/cli/device/poll",
        payload: {
          deviceCode: started.deviceCode,
        },
      });

      if (poll.status === "pending") {
        await wait(Math.max(1, poll.intervalSec) * 1000);
        continue;
      }

      const accountId = `${poll.orgSlug}:${poll.clerkUserId}`;
      await saveCredentials(accountId, {
        accessToken: poll.accessToken,
        refreshToken: poll.refreshToken,
        accessTokenExpiresAtMs: poll.accessTokenExpiresAtMs,
        refreshTokenExpiresAtMs: poll.refreshTokenExpiresAtMs,
        clerkUserId: poll.clerkUserId,
        orgId: poll.orgId,
        orgSlug: poll.orgSlug,
      });
      await saveConfig({
        baseUrl,
        activeAccountId: accountId,
      });

      console.log(`Logged in as ${poll.clerkUserId} for workspace ${poll.orgSlug}.`);
      return;
    }

    throw new Error("Login timed out before device approval completed.");
  });

program
  .command("logout")
  .description("Revoke local CLI session")
  .action(async () => {
    const local = await requireLocalSession();
    await postJson<{ revoked: boolean }>({
      baseUrl: local.baseUrl,
      path: "/v1/cli/logout",
      payload: {
        refreshToken: local.credentials.refreshToken,
      },
    });
    await deleteCredentials(local.accountId);
    await clearConfig();
    console.log("Logged out.");
  });

program
  .command("whoami")
  .description("Show active CLI auth context")
  .action(async () => {
    const local = await requireLocalSession();
    const authProvider = createCliAuthProvider();
    const accessToken = await authProvider.getAccessToken();
    const session = await getJson<{
      clerkUserId: string;
      orgId: string;
      orgSlug: string;
      source: "clerk" | "cli";
    }>({
      baseUrl: local.baseUrl,
      path: "/v1/cli/session",
      accessToken,
    });

    console.log(JSON.stringify(session, null, 2));
  });

const env = program.command("env").description("Evaluate environment values");

env
  .command("get")
  .description("Evaluate one variable")
  .argument("<name>", "Variable name")
  .requiredOption("--project <slug>", "Project slug")
  .requiredOption("--stage <slug>", "Stage slug")
  .option("--org <slug>", "Organization slug")
  .option("--seed <value>", "Deterministic seed")
  .option("--key <value>", "Deterministic key")
  .action(
    async (
      name: string,
      options: {
        project: string;
        stage: string;
        org?: string;
        seed?: string;
        key?: string;
      },
    ) => {
      const local = await requireLocalSession();
      const authProvider = createCliAuthProvider();
      const client = createBarekeyClient({
        baseUrl: local.baseUrl,
        auth: authProvider,
        projectSlug: options.project,
        stageSlug: options.stage,
        orgSlug: options.org,
      });

      const resolved = await client.evaluate(name, {
        seed: options.seed,
        key: options.key,
      });

      console.log(resolved.value);
    },
  );

env
  .command("get-many")
  .description("Evaluate a batch of variables")
  .requiredOption("--names <csv>", "Comma-separated variable names")
  .requiredOption("--project <slug>", "Project slug")
  .requiredOption("--stage <slug>", "Stage slug")
  .option("--org <slug>", "Organization slug")
  .option("--seed <value>", "Deterministic seed")
  .option("--key <value>", "Deterministic key")
  .action(
    async (options: {
      names: string;
      project: string;
      stage: string;
      org?: string;
      seed?: string;
      key?: string;
    }) => {
      const local = await requireLocalSession();
      const authProvider = createCliAuthProvider();
      const client = createBarekeyClient({
        baseUrl: local.baseUrl,
        auth: authProvider,
        projectSlug: options.project,
        stageSlug: options.stage,
        orgSlug: options.org,
      });

      const names = options.names
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
      const resolved = await client.evaluateMany(names, {
        seed: options.seed,
        key: options.key,
      });
      console.log(JSON.stringify(resolved, null, 2));
    },
  );

program
  .command("typegen")
  .description("Generate Barekey key/type map")
  .requiredOption("--project <slug>", "Project slug")
  .requiredOption("--stage <slug>", "Stage slug")
  .option("--out <path>", "Output path", "barekey-env.generated.ts")
  .action(async (options: { project: string; stage: string; out: string }) => {
    const local = await requireLocalSession();
    const authProvider = createCliAuthProvider();
    const accessToken = await authProvider.getAccessToken();
    const manifest = await getJson<{
      orgId: string;
      orgSlug: string;
      projectSlug: string;
      stageSlug: string;
      generatedAtMs: number;
      manifestVersion: string;
      variables: Array<{
        name: string;
        kind: "secret" | "ab_roll" | "rollout";
        declaredType: "string" | "number" | "boolean" | "json";
        required: boolean;
        updatedAtMs: number;
      }>;
    }>({
      baseUrl: local.baseUrl,
      path: `/v1/typegen/manifest?projectSlug=${encodeURIComponent(options.project)}&stageSlug=${encodeURIComponent(options.stage)}`,
      accessToken,
    });

    await writeTypegenFile({
      manifest,
      outPath: options.out,
    });

    console.log(`Wrote ${options.out}`);
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Command failed.";
  console.error(message);
  process.exitCode = 1;
});
