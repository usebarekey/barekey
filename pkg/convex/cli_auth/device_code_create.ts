import { v } from "convex/values";

import { internalMutation } from "../confect";
import {
  DEFAULT_DEVICE_EXPIRES_IN_SEC,
  DEFAULT_DEVICE_INTERVAL_SEC,
  DEVICE_CODE_BYTES,
  randomToken,
  randomUserCode,
  sha256Base64Url,
} from "./token_helpers";

/**
 * Creates a new pending CLI device-code flow.
 *
 * @param ctx The Convex internal mutation context.
 * @param args The optional CLI client name.
 * @returns The raw device code, user code, polling interval, and expiry window.
 * @remarks This writes a pending `cliDeviceCodes` row and guarantees unique device and user codes.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
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
