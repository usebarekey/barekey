import { v } from "convex/values";

import { internalMutation, mutation } from "./_generated/server";
import { requireActiveOrgClaims, requireIdentity } from "./lib/auth";

const DEVICE_CODE_BYTES = 32;
const TOKEN_BYTES = 32;
const USER_CODE_LENGTH = 8;
const DEFAULT_DEVICE_INTERVAL_SEC = 5;
const DEFAULT_DEVICE_EXPIRES_IN_SEC = 600;
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function bytesToBase64Url(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomToken(prefix: string, byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return `${prefix}${bytesToBase64Url(bytes)}`;
}

function randomUserCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(USER_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let result = "";
  for (let index = 0; index < USER_CODE_LENGTH; index += 1) {
    const value = bytes[index] ?? 0;
    result += alphabet[value % alphabet.length] ?? "A";
  }
  return result;
}

async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return bytesToBase64Url(new Uint8Array(digest));
}

export const createDeviceCodeInternal = internalMutation({
  args: {
    clientName: v.union(v.string(), v.null()),
  },
  returns: v.object({
    deviceCode: v.string(),
    userCode: v.string(),
    intervalSec: v.number(),
    expiresInSec: v.number(),
  }),
  handler: async (ctx, args) => {
    let deviceCode = "";
    let deviceCodeHash = "";
    while (true) {
      const candidate = randomToken("bk_dc_", DEVICE_CODE_BYTES);
      const candidateHash = await sha256Base64Url(candidate);
      const existing = await ctx.db
        .query("cliDeviceCodes")
        .withIndex("by_device_code_hash", (q) => q.eq("deviceCodeHash", candidateHash))
        .unique();
      if (existing === null) {
        deviceCode = candidate;
        deviceCodeHash = candidateHash;
        break;
      }
    }

    let userCode = "";
    while (true) {
      const candidate = randomUserCode();
      const existing = await ctx.db
        .query("cliDeviceCodes")
        .withIndex("by_user_code_and_status", (q) =>
          q.eq("userCode", candidate).eq("status", "pending"),
        )
        .unique();
      if (existing === null) {
        userCode = candidate;
        break;
      }
    }

    const now = Date.now();
    const expiresInSec = DEFAULT_DEVICE_EXPIRES_IN_SEC;
    const intervalSec = DEFAULT_DEVICE_INTERVAL_SEC;

    await ctx.db.insert("cliDeviceCodes", {
      deviceCodeHash,
      userCode,
      status: "pending",
      clientName: args.clientName,
      approvedAtMs: null,
      approvedByClerkUserId: null,
      approvedOrgId: null,
      approvedOrgSlug: null,
      exchangedAtMs: null,
      createdAtMs: now,
      updatedAtMs: now,
      expiresAtMs: now + expiresInSec * 1000,
      intervalSec,
    });

    return {
      deviceCode,
      userCode,
      intervalSec,
      expiresInSec,
    };
  },
});

export const completeDeviceCodeForCurrentUser = mutation({
  args: {
    userCode: v.string(),
  },
  returns: v.object({
    status: v.literal("completed"),
    orgSlug: v.string(),
  }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgClaims(identity);

    const normalizedUserCode = args.userCode.trim().toUpperCase();
    if (normalizedUserCode.length === 0) {
      throw new Error("Device code is required.");
    }

    const deviceCodeRow = await ctx.db
      .query("cliDeviceCodes")
      .withIndex("by_user_code_and_status", (q) =>
        q.eq("userCode", normalizedUserCode).eq("status", "pending"),
      )
      .unique();

    if (deviceCodeRow === null) {
      throw new Error("Device code not found or already used.");
    }

    const now = Date.now();
    if (deviceCodeRow.expiresAtMs <= now) {
      await ctx.db.patch(deviceCodeRow._id, {
        status: "expired",
        updatedAtMs: now,
      });
      throw new Error("Device code has expired.");
    }

    await ctx.db.patch(deviceCodeRow._id, {
      status: "approved",
      approvedAtMs: now,
      approvedByClerkUserId: activeOrg.clerkUserId,
      approvedOrgId: activeOrg.orgId,
      approvedOrgSlug: activeOrg.orgSlug,
      updatedAtMs: now,
    });

    return {
      status: "completed" as const,
      orgSlug: activeOrg.orgSlug,
    };
  },
});

export const completeDeviceCodeForCurrentUserInternal = internalMutation({
  args: {
    userCode: v.string(),
    clerkUserId: v.string(),
    orgId: v.string(),
    orgSlug: v.string(),
  },
  returns: v.object({
    status: v.literal("completed"),
    orgSlug: v.string(),
  }),
  handler: async (ctx, args) => {
    const normalizedUserCode = args.userCode.trim().toUpperCase();
    if (normalizedUserCode.length === 0) {
      throw new Error("Device code is required.");
    }

    const deviceCodeRow = await ctx.db
      .query("cliDeviceCodes")
      .withIndex("by_user_code_and_status", (q) =>
        q.eq("userCode", normalizedUserCode).eq("status", "pending"),
      )
      .unique();

    if (deviceCodeRow === null) {
      throw new Error("Device code not found or already used.");
    }

    const now = Date.now();
    if (deviceCodeRow.expiresAtMs <= now) {
      await ctx.db.patch(deviceCodeRow._id, {
        status: "expired",
        updatedAtMs: now,
      });
      throw new Error("Device code has expired.");
    }

    await ctx.db.patch(deviceCodeRow._id, {
      status: "approved",
      approvedAtMs: now,
      approvedByClerkUserId: args.clerkUserId,
      approvedOrgId: args.orgId,
      approvedOrgSlug: args.orgSlug,
      updatedAtMs: now,
    });

    return {
      status: "completed" as const,
      orgSlug: args.orgSlug,
    };
  },
});

export const pollDeviceCodeInternal = internalMutation({
  args: {
    deviceCode: v.string(),
  },
  returns: v.object({
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("invalid"),
      v.literal("expired"),
      v.literal("already_exchanged"),
    ),
    intervalSec: v.number(),
    accessToken: v.union(v.string(), v.null()),
    refreshToken: v.union(v.string(), v.null()),
    accessTokenExpiresAtMs: v.union(v.number(), v.null()),
    refreshTokenExpiresAtMs: v.union(v.number(), v.null()),
    orgId: v.union(v.string(), v.null()),
    orgSlug: v.union(v.string(), v.null()),
    clerkUserId: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const deviceCodeHash = await sha256Base64Url(args.deviceCode);
    const deviceCodeRow = await ctx.db
      .query("cliDeviceCodes")
      .withIndex("by_device_code_hash", (q) => q.eq("deviceCodeHash", deviceCodeHash))
      .unique();

    if (deviceCodeRow === null) {
      return {
        status: "invalid" as const,
        intervalSec: DEFAULT_DEVICE_INTERVAL_SEC,
        accessToken: null,
        refreshToken: null,
        accessTokenExpiresAtMs: null,
        refreshTokenExpiresAtMs: null,
        orgId: null,
        orgSlug: null,
        clerkUserId: null,
      };
    }

    const now = Date.now();
    if (deviceCodeRow.expiresAtMs <= now && deviceCodeRow.status !== "exchanged") {
      if (deviceCodeRow.status !== "expired") {
        await ctx.db.patch(deviceCodeRow._id, {
          status: "expired",
          updatedAtMs: now,
        });
      }
      return {
        status: "expired" as const,
        intervalSec: deviceCodeRow.intervalSec,
        accessToken: null,
        refreshToken: null,
        accessTokenExpiresAtMs: null,
        refreshTokenExpiresAtMs: null,
        orgId: null,
        orgSlug: null,
        clerkUserId: null,
      };
    }

    if (deviceCodeRow.status === "pending") {
      return {
        status: "pending" as const,
        intervalSec: deviceCodeRow.intervalSec,
        accessToken: null,
        refreshToken: null,
        accessTokenExpiresAtMs: null,
        refreshTokenExpiresAtMs: null,
        orgId: null,
        orgSlug: null,
        clerkUserId: null,
      };
    }

    if (deviceCodeRow.status === "exchanged") {
      return {
        status: "already_exchanged" as const,
        intervalSec: deviceCodeRow.intervalSec,
        accessToken: null,
        refreshToken: null,
        accessTokenExpiresAtMs: null,
        refreshTokenExpiresAtMs: null,
        orgId: null,
        orgSlug: null,
        clerkUserId: null,
      };
    }

    if (
      deviceCodeRow.approvedByClerkUserId === null ||
      deviceCodeRow.approvedOrgId === null ||
      deviceCodeRow.approvedOrgSlug === null
    ) {
      return {
        status: "invalid" as const,
        intervalSec: deviceCodeRow.intervalSec,
        accessToken: null,
        refreshToken: null,
        accessTokenExpiresAtMs: null,
        refreshTokenExpiresAtMs: null,
        orgId: null,
        orgSlug: null,
        clerkUserId: null,
      };
    }

    const accessToken = randomToken("bk_at_", TOKEN_BYTES);
    const refreshToken = randomToken("bk_rt_", TOKEN_BYTES);
    const accessTokenHash = await sha256Base64Url(accessToken);
    const refreshTokenHash = await sha256Base64Url(refreshToken);
    const accessTokenExpiresAtMs = now + ACCESS_TOKEN_TTL_MS;
    const refreshTokenExpiresAtMs = now + REFRESH_TOKEN_TTL_MS;

    await ctx.db.insert("cliSessions", {
      sessionId: randomToken("bk_s_", 16),
      clerkUserId: deviceCodeRow.approvedByClerkUserId,
      orgId: deviceCodeRow.approvedOrgId,
      orgSlug: deviceCodeRow.approvedOrgSlug,
      accessTokenHash,
      refreshTokenHash,
      accessTokenExpiresAtMs,
      refreshTokenExpiresAtMs,
      revokedAtMs: null,
      createdAtMs: now,
      updatedAtMs: now,
      lastUsedAtMs: now,
    });

    await ctx.db.patch(deviceCodeRow._id, {
      status: "exchanged",
      exchangedAtMs: now,
      updatedAtMs: now,
    });

    return {
      status: "approved" as const,
      intervalSec: deviceCodeRow.intervalSec,
      accessToken,
      refreshToken,
      accessTokenExpiresAtMs,
      refreshTokenExpiresAtMs,
      orgId: deviceCodeRow.approvedOrgId,
      orgSlug: deviceCodeRow.approvedOrgSlug,
      clerkUserId: deviceCodeRow.approvedByClerkUserId,
    };
  },
});

export const authenticateAccessTokenInternal = internalMutation({
  args: {
    accessToken: v.string(),
  },
  returns: v.union(
    v.object({
      sessionId: v.string(),
      clerkUserId: v.string(),
      orgId: v.string(),
      orgSlug: v.string(),
      accessTokenExpiresAtMs: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const now = Date.now();
    const accessTokenHash = await sha256Base64Url(args.accessToken);
    const session = await ctx.db
      .query("cliSessions")
      .withIndex("by_access_token_hash", (q) => q.eq("accessTokenHash", accessTokenHash))
      .unique();

    if (session === null || session.revokedAtMs !== null || session.accessTokenExpiresAtMs <= now) {
      return null;
    }

    await ctx.db.patch(session._id, {
      lastUsedAtMs: now,
      updatedAtMs: now,
    });

    return {
      sessionId: session.sessionId,
      clerkUserId: session.clerkUserId,
      orgId: session.orgId,
      orgSlug: session.orgSlug,
      accessTokenExpiresAtMs: session.accessTokenExpiresAtMs,
    };
  },
});

export const refreshSessionInternal = internalMutation({
  args: {
    refreshToken: v.string(),
  },
  returns: v.union(
    v.object({
      accessToken: v.string(),
      refreshToken: v.string(),
      accessTokenExpiresAtMs: v.number(),
      refreshTokenExpiresAtMs: v.number(),
      clerkUserId: v.string(),
      orgId: v.string(),
      orgSlug: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const now = Date.now();
    const refreshTokenHash = await sha256Base64Url(args.refreshToken);
    const session = await ctx.db
      .query("cliSessions")
      .withIndex("by_refresh_token_hash", (q) => q.eq("refreshTokenHash", refreshTokenHash))
      .unique();

    if (
      session === null ||
      session.revokedAtMs !== null ||
      session.refreshTokenExpiresAtMs <= now
    ) {
      return null;
    }

    const accessToken = randomToken("bk_at_", TOKEN_BYTES);
    const refreshToken = randomToken("bk_rt_", TOKEN_BYTES);
    const accessTokenHash = await sha256Base64Url(accessToken);
    const nextRefreshTokenHash = await sha256Base64Url(refreshToken);
    const accessTokenExpiresAtMs = now + ACCESS_TOKEN_TTL_MS;
    const refreshTokenExpiresAtMs = now + REFRESH_TOKEN_TTL_MS;

    await ctx.db.patch(session._id, {
      accessTokenHash,
      refreshTokenHash: nextRefreshTokenHash,
      accessTokenExpiresAtMs,
      refreshTokenExpiresAtMs,
      lastUsedAtMs: now,
      updatedAtMs: now,
    });

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAtMs,
      refreshTokenExpiresAtMs,
      clerkUserId: session.clerkUserId,
      orgId: session.orgId,
      orgSlug: session.orgSlug,
    };
  },
});

export const revokeSessionInternal = internalMutation({
  args: {
    refreshToken: v.string(),
  },
  returns: v.object({
    revoked: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const refreshTokenHash = await sha256Base64Url(args.refreshToken);
    const session = await ctx.db
      .query("cliSessions")
      .withIndex("by_refresh_token_hash", (q) => q.eq("refreshTokenHash", refreshTokenHash))
      .unique();

    if (session === null) {
      return { revoked: false };
    }

    if (session.revokedAtMs !== null) {
      return { revoked: true };
    }

    await ctx.db.patch(session._id, {
      revokedAtMs: Date.now(),
      updatedAtMs: Date.now(),
    });

    return { revoked: true };
  },
});
