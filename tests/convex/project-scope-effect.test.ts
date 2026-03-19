import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import type { Doc, Id } from "../../pkg/convex/_generated/dataModel";
import type { DatabaseReader } from "../../pkg/convex/_generated/server";
import {
  findProjectStageByOrgIdAndSlugEffect,
  listProjectVariableRowsForStageEffect,
  requireProjectStageByOrgIdAndSlugEffect,
} from "../../pkg/convex/lib/projects/scope";

type TableRows = {
  readonly projectStages?: ReadonlyArray<Doc<"projectStages">>;
  readonly projectVariables?: ReadonlyArray<Doc<"projectVariables">>;
  readonly projects?: ReadonlyArray<Doc<"projects">>;
};

type QueryFilter = Record<string, unknown>;

type QueryChain = {
  eq(field: string, value: unknown): QueryChain;
};

function makeDatabaseReader(rows: TableRows): DatabaseReader {
  return {
    query(tableName: keyof TableRows) {
      return {
        withIndex(_indexName: string, buildFilter: (query: QueryChain) => QueryChain) {
          const filters: QueryFilter = {};
          const chain: QueryChain = {
            eq(field, value) {
              filters[field] = value;
              return chain;
            },
          };

          buildFilter(chain);

          const matchingRows = (rows[tableName] ?? []).filter((row) =>
            Object.entries(filters).every(([field, value]) => row[field as keyof typeof row] === value),
          );

          return {
            unique: async () => matchingRows[0] ?? null,
            collect: async () => matchingRows,
          };
        },
      };
    },
  } as unknown as DatabaseReader;
}

describe("findProjectStageByOrgIdAndSlugEffect", () => {
  test("returns the matching project and stage pair", async () => {
    const projectId = "project_123" as Id<"projects">;
    const reader = makeDatabaseReader({
      projects: [
        {
          _creationTime: 0,
          _id: projectId,
          createdAtMs: 1,
          createdByClerkUserId: "user_123",
          name: "API",
          orgId: "org_123",
          orgSlug: "acme",
          slug: "api",
          slugBase: "api",
          updatedAtMs: 2,
        },
      ],
      projectStages: [
        {
          _creationTime: 0,
          _id: "stage_123" as Id<"projectStages">,
          createdAtMs: 1,
          isDefault: true,
          name: "Production",
          orgId: "org_123",
          projectId,
          slug: "prod",
          updatedAtMs: 2,
        },
      ],
    });

    await expect(
      Effect.runPromise(
        findProjectStageByOrgIdAndSlugEffect(reader, {
          orgId: "org_123",
          projectSlug: "api",
          stageSlug: "prod",
        }),
      ),
    ).resolves.toMatchObject({
      project: {
        _id: projectId,
        slug: "api",
      },
      stage: {
        slug: "prod",
      },
    });
  });
});

describe("requireProjectStageByOrgIdAndSlugEffect", () => {
  test("fails with NotFoundError when the stage is missing", async () => {
    const projectId = "project_123" as Id<"projects">;
    const reader = makeDatabaseReader({
      projects: [
        {
          _creationTime: 0,
          _id: projectId,
          createdAtMs: 1,
          createdByClerkUserId: "user_123",
          name: "API",
          orgId: "org_123",
          orgSlug: "acme",
          slug: "api",
          slugBase: "api",
          updatedAtMs: 2,
        },
      ],
      projectStages: [],
    });

    await expect(
      Effect.runPromise(
        Effect.either(
          requireProjectStageByOrgIdAndSlugEffect(reader, {
            orgId: "org_123",
            projectSlug: "api",
            stageSlug: "prod",
          }),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: {
        _tag: "NotFoundError",
        message: "Stage not found.",
      },
    });
  });
});

describe("listProjectVariableRowsForStageEffect", () => {
  test("collects variables for the requested project stage", async () => {
    const projectId = "project_123" as Id<"projects">;
    const reader = makeDatabaseReader({
      projectVariables: [
        {
          _creationTime: 0,
          _id: "var_1" as Id<"projectVariables">,
          chance: null,
          createdAtMs: 1,
          createdByClerkUserId: "user_123",
          declaredType: "string",
          encryptedValue: "ciphertext-a",
          encryptedValueA: null,
          encryptedValueB: null,
          kind: "secret",
          name: "API_TOKEN",
          orgId: "org_123",
          projectId,
          rolloutFunction: null,
          rolloutMilestones: null,
          stageSlug: "prod",
          updatedAtMs: 2,
          visibility: "private",
        },
        {
          _creationTime: 0,
          _id: "var_2" as Id<"projectVariables">,
          chance: null,
          createdAtMs: 1,
          createdByClerkUserId: "user_123",
          declaredType: "string",
          encryptedValue: "ciphertext-b",
          encryptedValueA: null,
          encryptedValueB: null,
          kind: "secret",
          name: "DEV_TOKEN",
          orgId: "org_123",
          projectId,
          rolloutFunction: null,
          rolloutMilestones: null,
          stageSlug: "dev",
          updatedAtMs: 2,
          visibility: "private",
        },
      ],
    });

    await expect(
      Effect.runPromise(
        listProjectVariableRowsForStageEffect(reader, {
          projectId,
          stageSlug: "prod",
        }),
      ),
    ).resolves.toHaveLength(1);
  });
});
