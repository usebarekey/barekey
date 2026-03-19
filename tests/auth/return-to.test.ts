import { describe, expect, test } from "bun:test";

import {
  buildReturnToPath,
  buildSsoPath,
  resolveReturnToPath,
} from "../../pkg/auth/src/lib/return-to";

describe("return-to helpers", () => {
  test("preserves the full relative device path and query", () => {
    expect(buildReturnToPath("/cli/device", "?user_code=ABCD1234&client_name=desk")).toBe(
      "/cli/device?user_code=ABCD1234&client_name=desk",
    );
  });

  test("falls back to the device page for unsafe return targets", () => {
    expect(resolveReturnToPath(new URLSearchParams({ return_to: "https://evil.test" }))).toBe(
      "/cli/device",
    );
    expect(resolveReturnToPath(new URLSearchParams({ return_to: "//evil.test/path" }))).toBe(
      "/cli/device",
    );
  });

  test("builds the custom sso route with encoded return context", () => {
    expect(buildSsoPath("/cli/device?user_code=ABCD1234")).toBe(
      "/auth/sso?return_to=%2Fcli%2Fdevice%3Fuser_code%3DABCD1234",
    );
  });
});
