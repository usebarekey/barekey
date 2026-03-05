export type CliCredentials = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAtMs: number;
  refreshTokenExpiresAtMs: number;
  clerkUserId: string;
  orgId: string;
  orgSlug: string;
};

export type CliConfig = {
  baseUrl: string;
  activeAccountId: string;
};
