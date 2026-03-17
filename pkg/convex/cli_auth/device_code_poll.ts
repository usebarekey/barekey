import { v } from "convex/values";

import { internalMutation } from "../confect";
import {
  ACCESS_TOKEN_TTL_MS,
  DEFAULT_DEVICE_INTERVAL_SEC,
  REFRESH_TOKEN_TTL_MS,
  TOKEN_BYTES,
  randomToken,
  sha256Base64Url,
} from "./token_helpers";

/**
 * Polls a device-code flow and exchanges an approved code into CLI session tokens.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The raw device code to poll.
 * @returns The current device-code state plus tokens when approval has completed.
 * @remarks This may insert `cliSessions` and mark the device code as exchanged exactly once.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
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
