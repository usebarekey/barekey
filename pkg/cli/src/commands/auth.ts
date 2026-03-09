import { setTimeout as wait } from "node:timers/promises";

import { intro, outro, spinner } from "@clack/prompts";
import { Command } from "commander";
import pc from "picocolors";
import open from "open";

import { createCliAuthProvider } from "../auth-provider.js";
import {
  clearConfig,
  deleteCredentials,
  saveConfig,
  saveCredentials,
} from "../credentials-store.js";
import { getJson, postJson } from "../http.js";
import { requireLocalSession, resolveBaseUrl, toJsonOutput } from "../command-utils.js";

async function runLogin(options: { baseUrl?: string }): Promise<void> {
  const baseUrl = await resolveBaseUrl(options.baseUrl);
  intro("Barekey CLI login");
  const loading = spinner();
  loading.start("Starting device authorization");
  let loadingActive = true;
  let pollSpinner: ReturnType<typeof spinner> | null = null;
  let pollActive = false;

  try {
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

    loading.stop("Authorization initialized");
    loadingActive = false;
    console.log(`${pc.bold("Open")}: ${started.verificationUri}`);
    console.log(`${pc.bold("Code")}: ${started.userCode}`);

    try {
      await open(started.verificationUri);
    } catch {
      // Browser-open can fail in headless environments.
    }

    const startedAtMs = Date.now();
    const expiresAtMs = startedAtMs + started.expiresInSec * 1000;
    pollSpinner = spinner();
    pollSpinner.start("Waiting for approval in browser");
    pollActive = true;

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

      pollSpinner.stop("Login approved");
      pollActive = false;
      outro(`Logged in as ${pc.bold(poll.clerkUserId)} in ${pc.bold(poll.orgSlug)}.`);
      return;
    }

    pollSpinner.stop("Timed out");
    pollActive = false;
    throw new Error("Login timed out before device approval completed.");
  } catch (error: unknown) {
    if (loadingActive) {
      loading.stop("Authorization failed");
    }
    if (pollSpinner && pollActive) {
      pollSpinner.stop("Login failed");
    }
    throw error;
  }
}

async function runLogout(): Promise<void> {
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
}

async function runWhoami(options: { json?: boolean }): Promise<void> {
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

  if (options.json) {
    toJsonOutput(true, session);
    return;
  }

  console.log(`${pc.bold("User")}: ${session.clerkUserId}`);
  console.log(`${pc.bold("Org")}: ${session.orgSlug}`);
  console.log(`${pc.bold("Source")}: ${session.source}`);
}

export function registerAuthCommands(program: Command): void {
  const auth = program.command("auth").description("Authentication commands");

  auth
    .command("login")
    .description("Authenticate this machine using browser device flow")
    .option("--base-url <url>", "Barekey API base URL")
    .action(async (options: { baseUrl?: string }) => {
      await runLogin(options);
    });

  auth
    .command("logout")
    .description("Revoke local CLI session")
    .action(async () => {
      await runLogout();
    });

  auth
    .command("whoami")
    .description("Show active CLI auth context")
    .option("--json", "Machine-readable output", false)
    .action(async (options: { json?: boolean }) => {
      await runWhoami(options);
    });

  // Backward-compatible top-level auth aliases.
  program
    .command("login")
    .description("Alias for barekey auth login")
    .option("--base-url <url>", "Barekey API base URL")
    .action(async (options: { baseUrl?: string }) => {
      await runLogin(options);
    });

  program
    .command("logout")
    .description("Alias for barekey auth logout")
    .action(async () => {
      await runLogout();
    });

  program
    .command("whoami")
    .description("Alias for barekey auth whoami")
    .option("--json", "Machine-readable output", false)
    .action(async (options: { json?: boolean }) => {
      await runWhoami(options);
    });
}
