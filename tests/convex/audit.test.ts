import { describe, expect, test } from "bun:test";

import {
  expiresAtMsForRetention,
  retentionTierFromCurrentTier,
  sanitizeAuditPayload,
} from "../../pkg/convex/lib/audit";

describe("retentionTierFromCurrentTier", () => {
  test("maps free and null workspaces to the free retention policy", () => {
    expect(retentionTierFromCurrentTier("free")).toBe("free_30d");
    expect(retentionTierFromCurrentTier(null)).toBe("free_30d");
  });

  test("maps paid tiers to the expected retention policies", () => {
    expect(retentionTierFromCurrentTier("pro")).toBe("pro_180d");
    expect(retentionTierFromCurrentTier("max")).toBe("max_forever");
  });
});

describe("expiresAtMsForRetention", () => {
  test("returns null for max retention", () => {
    expect(expiresAtMsForRetention("max_forever", 1_000)).toBeNull();
  });

  test("adds the expected number of days for free and pro retention", () => {
    const occurredAtMs = Date.UTC(2026, 2, 14, 12, 0, 0);
    expect(expiresAtMsForRetention("free_30d", occurredAtMs)).toBe(
      occurredAtMs + 30 * 24 * 60 * 60 * 1000,
    );
    expect(expiresAtMsForRetention("pro_180d", occurredAtMs)).toBe(
      occurredAtMs + 180 * 24 * 60 * 60 * 1000,
    );
  });
});

describe("sanitizeAuditPayload", () => {
  test("removes sensitive keys recursively while keeping safe metadata", () => {
    const sanitized = JSON.parse(
      sanitizeAuditPayload({
        variableNames: ["DATABASE_URL", "PUBLIC_APP_URL"],
        value: "super-secret",
        nested: {
          token: "abc123",
          declaredType: "string",
          rolloutMilestones: [{ at: "2026-03-14T12:00:00.000Z", percentage: 50 }],
        },
      }),
    ) as Record<string, unknown>;

    expect(sanitized).toEqual({
      variableNames: ["DATABASE_URL", "PUBLIC_APP_URL"],
      nested: {
        declaredType: "string",
      },
    });
  });

  test("normalizes unsupported leaf values into strings", () => {
    const sanitized = JSON.parse(
      sanitizeAuditPayload({
        metadata: {
          bigintLike: 123n,
        },
      }),
    ) as Record<string, { bigintLike: string }>;

    expect(sanitized.metadata.bigintLike).toBe("123");
  });
});
