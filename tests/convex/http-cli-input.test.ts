import { describe, expect, test } from "bun:test";

import {
  decodeCliDeviceCompleteBody,
  decodeCliDevicePollBody,
  decodeCliRefreshTokenBody,
  decodeCliDeviceStartBody,
} from "../../pkg/convex/lib/http/cli/input";

describe("CLI HTTP input decoders", () => {
  test("tolerates malformed device-start payloads by falling back to null clientName", () => {
    expect(decodeCliDeviceStartBody({ clientName: 42 })).toEqual({ clientName: null });
    expect(decodeCliDeviceStartBody(null)).toEqual({ clientName: null });
  });

  test("normalizes a valid device-start payload", () => {
    expect(decodeCliDeviceStartBody({ clientName: "  Barekey CLI  " })).toEqual({
      clientName: "Barekey CLI",
    });
  });

  test("requires non-empty device-complete and device-poll request bodies", () => {
    expect(decodeCliDeviceCompleteBody({ userCode: "  abcd1234  " })).toEqual({
      userCode: "abcd1234",
    });
    expect(decodeCliDevicePollBody({ deviceCode: "  bk_dc_123  " })).toEqual({
      deviceCode: "bk_dc_123",
    });
    expect(decodeCliDeviceCompleteBody({ userCode: "" })).toBeNull();
    expect(decodeCliDevicePollBody({ deviceCode: null })).toBeNull();
  });

  test("requires a non-empty refresh token for refresh/logout routes", () => {
    expect(decodeCliRefreshTokenBody({ refreshToken: "  bk_rt_123  " })).toEqual({
      refreshToken: "bk_rt_123",
    });
    expect(decodeCliRefreshTokenBody({ refreshToken: "" })).toBeNull();
    expect(decodeCliRefreshTokenBody({ refreshToken: 42 })).toBeNull();
  });
});
