import { v } from "convex/values";

export type PollDeviceCodeArgs = {
  deviceCode: string;
};

export type PollDeviceCodeResult = {
  status: "pending" | "approved" | "invalid" | "expired" | "already_exchanged";
  intervalSec: number;
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAtMs: number | null;
  refreshTokenExpiresAtMs: number | null;
  orgId: string | null;
  orgSlug: string | null;
  clerkUserId: string | null;
};

export const pollDeviceCodeArgs = {
  deviceCode: v.string(),
} as const;

export const pollDeviceCodeResultValidator = v.object({
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
});

/**
 * Builds a non-approved device-code poll result with empty token fields.
 *
 * @param status The current device-code status.
 * @param intervalSec The polling interval to return to the caller.
 * @returns A normalized poll result with empty token/session fields.
 * @remarks This keeps the device-code program focused on flow control instead of response object duplication.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function buildPendingPollResult(
  status: "pending" | "invalid" | "expired" | "already_exchanged",
  intervalSec: number,
): PollDeviceCodeResult {
  return {
    status,
    intervalSec,
    accessToken: null,
    refreshToken: null,
    accessTokenExpiresAtMs: null,
    refreshTokenExpiresAtMs: null,
    orgId: null,
    orgSlug: null,
    clerkUserId: null,
  };
}
