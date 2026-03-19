import { describe, expect, test } from "bun:test";

import {
  parseBatchRequest,
  parseDefinitionsRequest,
  parseListRequest,
  parseSingleRequest,
  parseWriteRequest,
} from "../../pkg/convex/lib/http/env/parsing";

describe("HTTP env input decoders", () => {
  test("decodes single, batch, list, and definitions payloads", () => {
    expect(
      parseSingleRequest({
        orgSlug: "  acme  ",
        projectSlug: "  app  ",
        stageSlug: "  prod  ",
        name: "  API_KEY  ",
        key: "bucket-key",
        seed: "seed",
      }),
    ).toEqual({
      orgSlug: "acme",
      projectSlug: "app",
      stageSlug: "prod",
      name: "API_KEY",
      key: "bucket-key",
      seed: "seed",
    });

    expect(
      parseBatchRequest({
        projectSlug: " app ",
        stageSlug: " prod ",
        names: [" API_KEY ", " FEATURE_FLAG "],
      }),
    ).toEqual({
      projectSlug: "app",
      stageSlug: "prod",
      names: ["API_KEY", "FEATURE_FLAG"],
    });

    expect(
      parseListRequest({
        orgSlug: " acme ",
        projectSlug: " app ",
        stageSlug: " prod ",
      }),
    ).toEqual({
      orgSlug: "acme",
      projectSlug: "app",
      stageSlug: "prod",
    });

    expect(
      parseDefinitionsRequest({
        projectSlug: " app ",
        stageSlug: " prod ",
        names: [" API_KEY ", " FEATURE_FLAG "],
      }),
    ).toEqual({
      projectSlug: "app",
      stageSlug: "prod",
      names: ["API_KEY", "FEATURE_FLAG"],
    });
  });

  test("rejects duplicate or malformed env name inputs", () => {
    expect(
      parseBatchRequest({
        projectSlug: "app",
        stageSlug: "prod",
        names: ["API_KEY", "API_KEY"],
      }),
    ).toBeNull();

    expect(
      parseDefinitionsRequest({
        projectSlug: "app",
        stageSlug: "prod",
        names: ["API_KEY", ""],
      }),
    ).toBeNull();
  });

  test("decodes mixed env write payloads and rejects invalid variants", () => {
    expect(
      parseWriteRequest({
        orgSlug: " acme ",
        projectSlug: " app ",
        stageSlug: " prod ",
        mode: " create_only ",
        entries: [
          {
            name: " API_KEY ",
            kind: "secret",
            value: "secret-value",
          },
          {
            name: " FLAG ",
            kind: "ab_roll",
            declaredType: "BOOLEAN",
            visibility: " public ",
            valueA: "true",
            valueB: "false",
            chance: 0.4,
          },
          {
            name: " ROLLOUT ",
            kind: "rollout",
            rolloutFunction: "linear",
            valueA: "0",
            valueB: "1",
            rolloutMilestones: [
              { at: "2025-01-01T00:00:00Z", percentage: 0 },
              { at: "2025-01-02T00:00:00+01:00", percentage: 100 },
            ],
          },
        ],
        deletes: [" OLD_SECRET "],
      }),
    ).toEqual({
      orgSlug: "acme",
      projectSlug: "app",
      stageSlug: "prod",
      mode: "create_only",
      entries: [
        {
          name: "API_KEY",
          visibility: "private",
          kind: "secret",
          declaredType: "string",
          value: "secret-value",
        },
        {
          name: "FLAG",
          visibility: "public",
          kind: "ab_roll",
          declaredType: "boolean",
          valueA: "true",
          valueB: "false",
          chance: 0.4,
        },
        {
          name: "ROLLOUT",
          visibility: "private",
          kind: "rollout",
          declaredType: "string",
          valueA: "0",
          valueB: "1",
          rolloutFunction: "linear",
          rolloutMilestones: [
            { at: "2025-01-01T00:00:00.000Z", percentage: 0 },
            { at: "2025-01-01T23:00:00.000Z", percentage: 100 },
          ],
        },
      ],
      deletes: ["OLD_SECRET"],
    });

    expect(
      parseWriteRequest({
        projectSlug: "app",
        stageSlug: "prod",
        entries: [
          {
            name: "FLAG",
            kind: "ab_roll",
            valueA: "true",
            valueB: "false",
            chance: 2,
          },
        ],
      }),
    ).toBeNull();

    expect(
      parseWriteRequest({
        projectSlug: "app",
        stageSlug: "prod",
        entries: [{ name: "FLAG", kind: "secret", value: "a" }],
        deletes: ["FLAG"],
      }),
    ).toBeNull();
  });
});
