import { describe, expect, test } from "bun:test";

import { LegacyHandlerError, toLegacyHandlerError } from "../../pkg/convex/lib/effect_errors";

describe("toLegacyHandlerError", () => {
  test("preserves an existing tagged legacy error", () => {
    const error = new LegacyHandlerError({
      message: "already wrapped",
      cause: "boom",
    });

    expect(toLegacyHandlerError(error)).toBe(error);
  });

  test("preserves the original message from thrown Error values", () => {
    const wrapped = toLegacyHandlerError(new Error("exploded"));

    expect(wrapped.message).toBe("exploded");
  });

  test("normalizes non-Error throwables", () => {
    const wrapped = toLegacyHandlerError({ unexpected: true });

    expect(wrapped.message).toBe("Unexpected backend error.");
  });
});
