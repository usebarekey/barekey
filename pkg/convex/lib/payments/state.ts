import { Effect } from "effect";
import { v } from "convex/values";

import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { dbCollectEffect } from "../convex/db";

export type CanonicalRow = {
  _id: string;
  createdAtMs: number;
};

export function pickCanonicalRow<T extends CanonicalRow>(rows: Array<T>): T | null {
  if (rows.length === 0) {
    return null;
  }

  return (
    [...rows].sort((left, right) => {
      if (left.createdAtMs !== right.createdAtMs) {
        return left.createdAtMs - right.createdAtMs;
      }
      return String(left._id).localeCompare(String(right._id));
    })[0] ?? null
  );
}

export const featureUsageValidator = v.object({
  featureId: v.string(),
  allowed: v.boolean(),
  usage: v.union(v.number(), v.null()),
  includedUsage: v.union(v.number(), v.null()),
  usageLimit: v.union(v.number(), v.null()),
  overageAllowed: v.union(v.boolean(), v.null()),
  nextResetAtMs: v.union(v.number(), v.null()),
});

export type FeatureUsage = {
  featureId: string;
  allowed: boolean;
  usage: number | null;
  includedUsage: number | null;
  usageLimit: number | null;
  overageAllowed: boolean | null;
  nextResetAtMs: number | null;
};

export function toDisabledFeatureUsage(input: { featureId: string }): FeatureUsage {
  return {
    featureId: input.featureId,
    allowed: false,
    usage: 0,
    includedUsage: 0,
    usageLimit: 0,
    overageAllowed: false,
    nextResetAtMs: null,
  };
}

export const freePlanCreditStateValidator = v.object({
  clerkUserId: v.string(),
  totalCredits: v.number(),
  remainingCredits: v.number(),
  assignedOrgId: v.union(v.string(), v.null()),
  assignedOrgSlug: v.union(v.string(), v.null()),
  consumedAtMs: v.union(v.number(), v.null()),
  revokedAtMs: v.union(v.number(), v.null()),
  revokedReason: v.union(v.string(), v.null()),
});

export type FreePlanCreditState = {
  clerkUserId: string;
  totalCredits: number;
  remainingCredits: number;
  assignedOrgId: string | null;
  assignedOrgSlug: string | null;
  consumedAtMs: number | null;
  revokedAtMs: number | null;
  revokedReason: string | null;
};

export type ConsumeFreePlanCreditResult = {
  granted: boolean;
  reason:
    | "granted"
    | "already_assigned"
    | "org_already_assigned"
    | "assigned_elsewhere"
    | "no_remaining_credits";
  credit: FreePlanCreditState;
};

export function toFreePlanCreditState(input: {
  clerkUserId: string;
  totalCredits: number;
  remainingCredits: number;
  assignedOrgId: string | null;
  assignedOrgSlug: string | null;
  consumedAtMs: number | null;
  revokedAtMs: number | null;
  revokedReason: string | null;
}): FreePlanCreditState {
  return {
    clerkUserId: input.clerkUserId,
    totalCredits: input.totalCredits,
    remainingCredits: input.remainingCredits,
    assignedOrgId: input.assignedOrgId,
    assignedOrgSlug: input.assignedOrgSlug,
    consumedAtMs: input.consumedAtMs,
    revokedAtMs: input.revokedAtMs,
    revokedReason: input.revokedReason,
  };
}

export async function computeEncryptedBytesForOrg(
  ctx: MutationCtx,
  orgId: string,
): Promise<number> {
  const projects = await Effect.runPromise(
    dbCollectEffect<Doc<"projects">, Error>(
      ctx,
      "projects",
      (query) => query.withIndex("by_org_id", (indexQuery) => indexQuery.eq("orgId", orgId)),
      (error) =>
        error instanceof Error
          ? error
          : new Error("Failed to load projects while computing encrypted bytes."),
    ),
  );

  let total = 0;
  for (const project of projects) {
    const rows = await Effect.runPromise(
      dbCollectEffect<Doc<"projectVariables">, Error>(
        ctx,
        "projectVariables",
        (query) =>
          query.withIndex("by_org_id_and_project_id", (indexQuery) =>
            indexQuery.eq("orgId", orgId).eq("projectId", project._id),
          ),
        (error) =>
          error instanceof Error
            ? error
            : new Error("Failed to load project variables while computing encrypted bytes."),
      ),
    );
    for (const row of rows) {
      if (row.encryptedValue !== null) {
        total += new TextEncoder().encode(row.encryptedValue).length;
      }
      if (row.encryptedValueA !== null) {
        total += new TextEncoder().encode(row.encryptedValueA).length;
      }
      if (row.encryptedValueB !== null) {
        total += new TextEncoder().encode(row.encryptedValueB).length;
      }
    }
  }
  return total;
}

export async function getCanonicalOrgStorageUsageRow(
  ctx: QueryCtx | MutationCtx,
  orgId: string,
): Promise<{
  _id: Id<"orgStorageUsage">;
  orgId: string;
  encryptedBytes: number;
  createdAtMs: number;
  updatedAtMs: number;
} | null> {
  const rows = await Effect.runPromise(
    dbCollectEffect<
      {
        _id: Id<"orgStorageUsage">;
        orgId: string;
        encryptedBytes: number;
        createdAtMs: number;
        updatedAtMs: number;
      },
      Error
    >(
      ctx,
      "orgStorageUsage",
      (query) => query.withIndex("by_org_id", (indexQuery) => indexQuery.eq("orgId", orgId)),
      (error) =>
        error instanceof Error
          ? error
          : new Error("Failed to load organization storage usage."),
    ),
  );
  return pickCanonicalRow(rows);
}

export async function getCanonicalFreePlanCreditForClerkUserId(
  ctx: Pick<MutationCtx, "db">,
  clerkUserId: string,
): Promise<{
  _id: Id<"userFreePlanCredits">;
  clerkUserId: string;
  totalCredits: number;
  remainingCredits: number;
  assignedOrgId: string | null;
  assignedOrgSlug: string | null;
  consumedAtMs: number | null;
  revokedAtMs: number | null;
  revokedReason: string | null;
  createdAtMs: number;
  updatedAtMs: number;
} | null> {
  const rows = await Effect.runPromise(
    dbCollectEffect<
      {
        _id: Id<"userFreePlanCredits">;
        clerkUserId: string;
        totalCredits: number;
        remainingCredits: number;
        assignedOrgId: string | null;
        assignedOrgSlug: string | null;
        consumedAtMs: number | null;
        revokedAtMs: number | null;
        revokedReason: string | null;
        createdAtMs: number;
        updatedAtMs: number;
      },
      Error
    >(
      ctx,
      "userFreePlanCredits",
      (query) =>
        query.withIndex("by_clerk_user_id", (indexQuery) =>
          indexQuery.eq("clerkUserId", clerkUserId),
        ),
      (error) =>
        error instanceof Error
          ? error
          : new Error("Failed to load free-plan credit rows."),
    ),
  );
  return pickCanonicalRow(rows);
}
