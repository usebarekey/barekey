import { describe, expect, test } from "bun:test";

import {
  fallbackDeclaredType,
  inferTypeScriptTypeFromNormalizedJson,
  normalizeDeclaredType,
  toExactTypeScriptTypeForNormalizedValue,
  toTypeScriptTypeForDeclaredType,
  validateAndNormalizeDeclaredAbRoll,
  validateAndNormalizeDeclaredValue,
} from "../../pkg/convex/lib/declared_types";

describe("fallbackDeclaredType", () => {
  test("preserves supported declared types", () => {
    expect(fallbackDeclaredType("json")).toBe("json");
  });

  test("falls back to string for nullish values", () => {
    expect(fallbackDeclaredType(null)).toBe("string");
    expect(fallbackDeclaredType(undefined)).toBe("string");
  });

  test("falls back to string for unsupported values", () => {
    expect(fallbackDeclaredType("yaml")).toBe("string");
  });
});

describe("normalizeDeclaredType", () => {
  test("trims and lowercases supported values", () => {
    expect(normalizeDeclaredType("  BOOLEAN  ")).toBe("boolean");
  });

  test("throws for unsupported types", () => {
    expect(() => normalizeDeclaredType("yaml")).toThrow("Unsupported variable type: yaml");
  });
});

describe("validateAndNormalizeDeclaredValue", () => {
  test("preserves raw string values", () => {
    expect(validateAndNormalizeDeclaredValue("string", "  keep spacing  ")).toBe(
      "  keep spacing  ",
    );
  });

  test("normalizes truthy boolean variants", () => {
    expect(validateAndNormalizeDeclaredValue("boolean", "true")).toBe("true");
    expect(validateAndNormalizeDeclaredValue("boolean", " YES ")).toBe("true");
    expect(validateAndNormalizeDeclaredValue("boolean", "1")).toBe("true");
  });

  test("normalizes falsey boolean variants", () => {
    expect(validateAndNormalizeDeclaredValue("boolean", "false")).toBe("false");
    expect(validateAndNormalizeDeclaredValue("boolean", " no ")).toBe("false");
    expect(validateAndNormalizeDeclaredValue("boolean", "0")).toBe("false");
  });

  test("rejects invalid boolean values", () => {
    expect(() => validateAndNormalizeDeclaredValue("boolean", "maybe")).toThrow(
      "Boolean variables must be true or false.",
    );
  });

  test("normalizes signed int64 values", () => {
    expect(validateAndNormalizeDeclaredValue("int64", " 42 ")).toBe("42");
    expect(validateAndNormalizeDeclaredValue("int64", "-7")).toBe("-7");
  });

  test("accepts int64 boundary values", () => {
    expect(validateAndNormalizeDeclaredValue("int64", "-9223372036854775808")).toBe(
      "-9223372036854775808",
    );
    expect(validateAndNormalizeDeclaredValue("int64", "9223372036854775807")).toBe(
      "9223372036854775807",
    );
  });

  test("rejects malformed or out-of-range int64 values", () => {
    expect(() => validateAndNormalizeDeclaredValue("int64", "01")).toThrow(
      "Integer variables must be valid signed 64-bit integers.",
    );
    expect(() => validateAndNormalizeDeclaredValue("int64", "9223372036854775808")).toThrow(
      "Integer variables must be valid signed 64-bit integers.",
    );
  });

  test("preserves finite float strings", () => {
    expect(validateAndNormalizeDeclaredValue("float", "3.14")).toBe("3.14");
    expect(validateAndNormalizeDeclaredValue("float", "1e3")).toBe("1e3");
  });

  test("rejects empty or non-finite float values", () => {
    expect(() => validateAndNormalizeDeclaredValue("float", "   ")).toThrow(
      "Float variables must be finite numbers.",
    );
    expect(() => validateAndNormalizeDeclaredValue("float", "Infinity")).toThrow(
      "Float variables must be finite numbers.",
    );
  });

  test("normalizes valid dates to ISO strings", () => {
    expect(validateAndNormalizeDeclaredValue("date", "2025-03-01T12:30:00+02:00")).toBe(
      "2025-03-01T10:30:00.000Z",
    );
  });

  test("accepts leap-day instants", () => {
    expect(validateAndNormalizeDeclaredValue("date", "2024-02-29T00:00:00Z")).toBe(
      "2024-02-29T00:00:00.000Z",
    );
  });

  test("rejects dates without timezones or impossible calendar dates", () => {
    expect(() => validateAndNormalizeDeclaredValue("date", "2025-03-01T12:30:00")).toThrow(
      "Date variables must be ISO 8601 instants with timezone.",
    );
    expect(() => validateAndNormalizeDeclaredValue("date", "2023-02-29T00:00:00Z")).toThrow(
      "Date variables must be ISO 8601 instants with timezone.",
    );
    expect(() => validateAndNormalizeDeclaredValue("date", "2025-04-31T00:00:00Z")).toThrow(
      "Date variables must be ISO 8601 instants with timezone.",
    );
  });

  test("rejects timestamps that match the format but do not parse", () => {
    expect(() => validateAndNormalizeDeclaredValue("date", "2025-01-01T25:00:00Z")).toThrow(
      "Date variables must be ISO 8601 instants with timezone.",
    );
  });

  test("normalizes json by sorting keys recursively", () => {
    expect(
      validateAndNormalizeDeclaredValue(
        "json",
        '{"z":1,"nested":{"b":2,"a":1},"arr":[{"d":4,"c":3}]}',
      ),
    ).toBe('{"arr":[{"c":3,"d":4}],"nested":{"a":1,"b":2},"z":1}');
  });

  test("rejects invalid json values", () => {
    expect(() => validateAndNormalizeDeclaredValue("json", "{")).toThrow(
      "JSON variables must contain valid JSON.",
    );
  });
});

describe("validateAndNormalizeDeclaredAbRoll", () => {
  test("normalizes both A/B values using the declared type", () => {
    expect(validateAndNormalizeDeclaredAbRoll("boolean", "yes", "0")).toEqual({
      valueA: "true",
      valueB: "false",
    });
  });
});

describe("inferTypeScriptTypeFromNormalizedJson", () => {
  test("infers sorted object properties and quotes unsafe keys", () => {
    expect(inferTypeScriptTypeFromNormalizedJson('{"z":1,"bad-key":"x","safe_name":true}')).toBe(
      '{ "bad-key": string; safe_name: boolean; z: number; }',
    );
  });

  test("infers unions for heterogeneous arrays", () => {
    expect(inferTypeScriptTypeFromNormalizedJson('[1,"two",false]')).toBe(
      "Array<boolean | number | string>",
    );
  });

  test("collapses duplicate array member types", () => {
    expect(inferTypeScriptTypeFromNormalizedJson("[1,2,3]")).toBe("Array<number>");
  });

  test("handles empty arrays and empty objects", () => {
    expect(inferTypeScriptTypeFromNormalizedJson("[]")).toBe("Array<never>");
    expect(inferTypeScriptTypeFromNormalizedJson("{}")).toBe("Record<string, never>");
  });

  test("infers null values directly", () => {
    expect(inferTypeScriptTypeFromNormalizedJson("null")).toBe("null");
  });

  test("returns unknown for invalid json input", () => {
    expect(inferTypeScriptTypeFromNormalizedJson("{")).toBe("unknown");
  });
});

describe("toTypeScriptTypeForDeclaredType", () => {
  test("maps primitive declared types to their runtime TypeScript shapes", () => {
    expect(toTypeScriptTypeForDeclaredType({ declaredType: "string" })).toBe("string");
    expect(toTypeScriptTypeForDeclaredType({ declaredType: "boolean" })).toBe("boolean");
    expect(toTypeScriptTypeForDeclaredType({ declaredType: "int64" })).toBe("bigint");
    expect(toTypeScriptTypeForDeclaredType({ declaredType: "float" })).toBe("number");
    expect(toTypeScriptTypeForDeclaredType({ declaredType: "date" })).toBe(
      "BarekeyTemporalInstant",
    );
  });

  test("returns unknown for json without a normalized sample", () => {
    expect(toTypeScriptTypeForDeclaredType({ declaredType: "json" })).toBe("unknown");
  });

  test("infers json types from a normalized sample", () => {
    expect(
      toTypeScriptTypeForDeclaredType({
        declaredType: "json",
        normalizedJsonValue: '{"count":1,"enabled":true}',
      }),
    ).toBe("{ count: number; enabled: boolean; }");
  });
});

describe("toExactTypeScriptTypeForNormalizedValue", () => {
  test("returns string literals for declared strings", () => {
    expect(
      toExactTypeScriptTypeForNormalizedValue({
        declaredType: "string",
        normalizedValue: "hello",
      }),
    ).toBe('"hello"');
  });

  test("returns boolean literals for declared booleans", () => {
    expect(
      toExactTypeScriptTypeForNormalizedValue({
        declaredType: "boolean",
        normalizedValue: "true",
      }),
    ).toBe("true");
  });

  test("returns bigint literals for int64 values", () => {
    expect(
      toExactTypeScriptTypeForNormalizedValue({
        declaredType: "int64",
        normalizedValue: "42",
      }),
    ).toBe("42n");
  });

  test("returns raw numeric strings for float values", () => {
    expect(
      toExactTypeScriptTypeForNormalizedValue({
        declaredType: "float",
        normalizedValue: "3.14",
      }),
    ).toBe("3.14");
  });

  test("returns BarekeyTemporalInstant for dates", () => {
    expect(
      toExactTypeScriptTypeForNormalizedValue({
        declaredType: "date",
        normalizedValue: "2025-03-01T10:30:00.000Z",
      }),
    ).toBe("BarekeyTemporalInstant");
  });

  test("reuses json type inference for normalized json values", () => {
    expect(
      toExactTypeScriptTypeForNormalizedValue({
        declaredType: "json",
        normalizedValue: '{"flags":["a",1]}',
      }),
    ).toBe("{ flags: Array<number | string>; }");
  });
});
