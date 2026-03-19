import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import type { Doc, Id } from "../../../pkg/convex/_generated/dataModel";
import type { ActionCtx, MutationCtx } from "../../../pkg/convex/_generated/server";
import { appendAuditEventEffect } from "../../../pkg/convex/lib/confect/audit";
import { reserveFeatureUnitsEffect } from "../../../pkg/convex/lib/confect/billing";
import { requireProjectStageEffect } from "../../../pkg/convex/lib/confect/project/scope";
import { makeRuntimeLayer } from "../../../pkg/convex/lib/confect/runtime/layer";

type TableRows = {
  readonly orgBillingSnapshots?: ReadonlyArray<Doc<"orgBillingSnapshots">>;
  readonly projectStages?: ReadonlyArray<Doc<"projectStages">>;
  readonly projects?: ReadonlyArray<Doc<"projects">>;
  readonly users?: ReadonlyArray<Doc<"users">>;
};

type QueryFilter = Record<string, unknown>;

type QueryChain = {
  eq(field: string, value: unknown): QueryChain;
};

function makeMutationDb(rows: TableRows) {
  const insertedAuditEvents: Array<Record<string, unknown>> = [];

  const db = {
    query(tableName: keyof TableRows | "auditEvents") {
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

          const sourceRows =
            tableName === "auditEvents"
              ? insertedAuditEvents
              : ((rows[tableName] ?? []) as ReadonlyArray<Record<string, unknown>>);
          const matchingRows = sourceRows.filter((row) =>
            Object.entries(filters).every(([field, value]) => row[field] === value),
          );

          return {
            unique: async () => matchingRows[0] ?? null,
            collect: async () => matchingRows,
          };
        },
      };
    },
    insert(tableName: string, value: Record<string, unknown>) {
      if (tableName !== "auditEvents") {
        throw new Error(`Unexpected insert into ${tableName}`);
      }

      const id = `audit_${insertedAuditEvents.length + 1}` as Id<"auditEvents">;
      insertedAuditEvents.push({
        _creationTime: 0,
        _id: id,
        ...value,
      });
      return Promise.resolve(id);
    },
  };

  return {
    db,
    insertedAuditEvents,
  };
}

describe("Confect runtime layer", () => {
  test("appends audit events through the mutation runtime service", async () => {
    const { db, insertedAuditEvents } = makeMutationDb({
      users: [
        {
          _creationTime: 0,
          _id: "user_1" as Id<"users">,
          clerkUserId: "user_123",
          createdAtMs: 1,
          displayName: "Sander",
          email: "sander@example.com",
          imageUrl: null,
          lastSeenAtMs: 1,
          slug: "sander",
          slugBase: "sander",
          updatedAtMs: 1,
        },
      ],
      orgBillingSnapshots: [
        {
          _creationTime: 0,
          _id: "billing_1" as Id<"orgBillingSnapshots">,
          currentTier: "free",
          orgId: "org_123",
          periodEndsAtMs: null,
          planSlug: null,
          polarSubscriptionId: null,
          source: "free",
          updatedAtMs: 1,
          variablesLimit: 100,
          variablesUsed: 1,
        },
      ],
    });
    const ctx = {
      auth: {
        getUserIdentity: async () => null,
      },
      db,
    } as unknown as MutationCtx;

    const insertedId = await Effect.runPromise(
      appendAuditEventEffect({
        orgId: "org_123",
        orgSlug: "acme",
        projectId: null,
        projectSlug: null,
        stageSlug: null,
        eventType: "project.created",
        category: "project",
        actorSource: "barekey_user",
        actorClerkUserId: "user_123",
        actorDisplayName: null,
        actorEmail: null,
        subjectType: "project",
        subjectId: "project_123",
        subjectName: "API",
        title: "Created project API",
        description: "Project API is ready.",
        severity: "info",
        payloadJson: "{\"hello\":\"world\"}",
        retentionTierOverride: null,
      }).pipe(Effect.provide(makeRuntimeLayer(ctx))),
    );

    expect(insertedId).toBe("audit_1");
    expect(insertedAuditEvents[0]).toMatchObject({
      orgId: "org_123",
      actorDisplayName: "Sander",
      actorEmail: "sander@example.com",
      retentionTier: "free_30d",
      title: "Created project API",
    });
  });

  test("reserves billing units through the action runtime service", async () => {
    const actionCalls: Array<{ functionReference: unknown; args: Record<string, unknown> }> = [];
    const ctx = {
      auth: {
        getUserIdentity: async () => null,
      },
      runAction: async (functionReference: unknown, args: Record<string, unknown>) => {
        actionCalls.push({ functionReference, args });
        return {
          reservedUnits: 7,
          errorCode: null,
        };
      },
      runMutation: async () => null,
      runQuery: async () => null,
    } as unknown as ActionCtx;

    const result = await Effect.runPromise(
      reserveFeatureUnitsEffect({
        scope: "org",
        orgId: "org_123",
        orgSlug: "acme",
        featureId: "storage_bytes",
        units: 7,
        reason: "test",
      }).pipe(Effect.provide(makeRuntimeLayer(ctx))),
    );

    expect(result).toEqual({
      reservedUnits: 7,
      errorCode: null,
    });
    expect(actionCalls).toHaveLength(1);
    expect(actionCalls[0]?.args).toEqual({
      orgId: "org_123",
      orgSlug: "acme",
      featureId: "storage_bytes",
      units: 7,
      reason: "test",
    });
  });

  test("resolves required project scope through the mutation runtime service", async () => {
    const projectId = "project_123" as Id<"projects">;
    const { db } = makeMutationDb({
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
    const ctx = {
      auth: {
        getUserIdentity: async () => null,
      },
      db,
    } as unknown as MutationCtx;

    const result = await Effect.runPromise(
      requireProjectStageEffect({
        scope: "orgId",
        orgId: "org_123",
        projectSlug: "api",
        stageSlug: "prod",
      }).pipe(Effect.provide(makeRuntimeLayer(ctx))),
    );

    expect(result).toMatchObject({
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
