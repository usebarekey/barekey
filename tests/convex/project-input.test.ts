import { describe, expect, test } from "bun:test";
import { Effect, Either } from "effect";

import {
  decodeConfigProjectSlugEffect,
  decodeProjectNameEffect,
} from "../../pkg/convex/projects/input";

describe("project input decoders", () => {
  test("trims and validates project names with Effect Schema", () => {
    const decoded = Effect.runSync(Effect.either(decodeProjectNameEffect("  API Project  ")));

    expect(Either.isRight(decoded)).toBe(true);
    if (Either.isRight(decoded)) {
      expect(decoded.right).toBe("API Project");
    }
  });

  test("normalizes config project slugs with Effect Schema validation", () => {
    const decoded = Effect.runSync(
      Effect.either(decodeConfigProjectSlugEffect("  Config Project !!  ")),
    );

    expect(Either.isRight(decoded)).toBe(true);
    if (Either.isRight(decoded)) {
      expect(decoded.right).toBe("config-project");
    }
  });

  test("rejects empty normalized config project slugs", () => {
    const decoded = Effect.runSync(Effect.either(decodeConfigProjectSlugEffect(" !!! ")));

    expect(Either.isLeft(decoded)).toBe(true);
  });
});
