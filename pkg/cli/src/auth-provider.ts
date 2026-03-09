import { postJson } from "./http.js";
import type { CliCredentials } from "./types.js";
import { loadConfig, loadCredentials, saveCredentials } from "./credentials-store.js";

type CliAuthProvider = {
  getAccessToken(): Promise<string>;
  onAuthError?(): Promise<void>;
};

export function createCliAuthProvider(): CliAuthProvider {
  let cachedCredentials: CliCredentials | null = null;
  let forceRefresh = false;

  async function readCurrentCredentials(): Promise<{
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
      throw new Error("CLI credentials are missing. Run barekey login again.");
    }

    cachedCredentials = credentials;

    return {
      baseUrl: config.baseUrl,
      accountId: config.activeAccountId,
      credentials,
    };
  }

  async function refreshIfNeeded(): Promise<CliCredentials> {
    const { baseUrl, accountId, credentials } = await readCurrentCredentials();
    const now = Date.now();
    if (!forceRefresh && credentials.accessTokenExpiresAtMs > now + 10_000) {
      return credentials;
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
      baseUrl,
      path: "/v1/cli/token/refresh",
      payload: {
        refreshToken: credentials.refreshToken,
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

    await saveCredentials(accountId, nextCredentials);
    cachedCredentials = nextCredentials;
    forceRefresh = false;
    return nextCredentials;
  }

  return {
    async getAccessToken(): Promise<string> {
      const credentials = await refreshIfNeeded();
      return credentials.accessToken;
    },
    async onAuthError(): Promise<void> {
      forceRefresh = true;
    },
  };
}
