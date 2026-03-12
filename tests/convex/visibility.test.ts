import { describe, expect, test } from "bun:test";

import { getVariableVisibility } from "../../pkg/convex/lib/visibility";

describe("getVariableVisibility", () => {
  test("defaults missing visibility to private", () => {
    expect(getVariableVisibility({})).toBe("private");
  });

  test("defaults null visibility to private", () => {
    expect(getVariableVisibility({ visibility: null })).toBe("private");
  });

  test("preserves explicit public visibility", () => {
    expect(getVariableVisibility({ visibility: "public" })).toBe("public");
  });
});
