import { Autumn } from "autumn-js";
import { v } from "convex/values";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { assertExpectedOrgSlug, requireActiveOrgIdClaims, requireIdentity } from "./lib/auth";
import { runtimeConfig } from "./lib/runtime_config";

const BillingTier = {
  Free: "free",
  Pro: "pro",
  Max: "max",
} as const;

const BillingInterval = {
  Monthly: "monthly",
  Annually: "annually",
} as const;

const OverageMode = {
  WithoutOverages: "without_overages",
  WithOverages: "with_overages",
} as const;

const FeatureId = {
  StaticRequests: "static_requests",
  DynamicRequests: "dynamic_requests",
  StorageBytes: "storage_bytes",
} as const;

const PLANLESS_WORKSPACE_ERROR_MESSAGE =
  "This workspace is without a plan. Choose a billing plan to enable projects.";
const BILLING_UNAVAILABLE_ERROR_MESSAGE = "Billing service is temporarily unavailable.";
const METERED_USAGE_ROLLBACK_ERROR_MESSAGE = "Failed to roll back metered usage.";

const MB_BYTES = 1_000_000;
const GB_BYTES = 1_000_000_000;

type BillingTierValue = (typeof BillingTier)[keyof typeof BillingTier];
type BillingIntervalValue = (typeof BillingInterval)[keyof typeof BillingInterval];
type OverageModeValue = (typeof OverageMode)[keyof typeof OverageMode];

type CanonicalRow = {
  _id: string;
  createdAtMs: number;
};

type WorkspacePlanState = {
  currentProductId: string;
  currentTier: BillingTierValue | null;
};

function createAutumnClient(): Autumn {
  return new Autumn({
    secretKey: runtimeConfig.autumnSecretKey,
  });
}

function pickCanonicalRow<T extends CanonicalRow>(rows: Array<T>): T | null {
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

type DefaultVariant = {
  productId: string;
  tier: BillingTierValue;
  interval: BillingIntervalValue;
  overageMode: OverageModeValue;
  monthlyPriceUsd: number;
  includedStaticRequests: number;
  includedDynamicRequests: number;
  includedStorageBytes: number;
  staticOveragePer1kUsd: number | null;
  dynamicOveragePer1kUsd: number | null;
  storageOveragePerGbUsd: number | null;
};

const DEFAULT_VARIANTS: Array<DefaultVariant> = [
  {
    productId: "free_monthly_capped",
    tier: BillingTier.Free,
    interval: BillingInterval.Monthly,
    overageMode: OverageMode.WithoutOverages,
    monthlyPriceUsd: 0,
    includedStaticRequests: 10_000,
    includedDynamicRequests: 500,
    includedStorageBytes: 25 * MB_BYTES,
    staticOveragePer1kUsd: null,
    dynamicOveragePer1kUsd: null,
    storageOveragePerGbUsd: null,
  },
  {
    productId: "pro_monthly_capped",
    tier: BillingTier.Pro,
    interval: BillingInterval.Monthly,
    overageMode: OverageMode.WithoutOverages,
    monthlyPriceUsd: 9.99,
    includedStaticRequests: 1_000_000,
    includedDynamicRequests: 100_000,
    includedStorageBytes: 500 * MB_BYTES,
    staticOveragePer1kUsd: null,
    dynamicOveragePer1kUsd: null,
    storageOveragePerGbUsd: null,
  },
  {
    productId: "pro_annual_capped",
    tier: BillingTier.Pro,
    interval: BillingInterval.Annually,
    overageMode: OverageMode.WithoutOverages,
    monthlyPriceUsd: 7.99,
    includedStaticRequests: 1_000_000,
    includedDynamicRequests: 100_000,
    includedStorageBytes: 500 * MB_BYTES,
    staticOveragePer1kUsd: null,
    dynamicOveragePer1kUsd: null,
    storageOveragePerGbUsd: null,
  },
  {
    productId: "pro_monthly_overage",
    tier: BillingTier.Pro,
    interval: BillingInterval.Monthly,
    overageMode: OverageMode.WithOverages,
    monthlyPriceUsd: 9.99,
    includedStaticRequests: 1_000_000,
    includedDynamicRequests: 100_000,
    includedStorageBytes: 500 * MB_BYTES,
    staticOveragePer1kUsd: 0.0053,
    dynamicOveragePer1kUsd: 0.0265,
    storageOveragePerGbUsd: null,
  },
  {
    productId: "pro_annual_overage",
    tier: BillingTier.Pro,
    interval: BillingInterval.Annually,
    overageMode: OverageMode.WithOverages,
    monthlyPriceUsd: 7.99,
    includedStaticRequests: 1_000_000,
    includedDynamicRequests: 100_000,
    includedStorageBytes: 500 * MB_BYTES,
    staticOveragePer1kUsd: 0.0053,
    dynamicOveragePer1kUsd: 0.0265,
    storageOveragePerGbUsd: null,
  },
  {
    productId: "max_monthly_capped",
    tier: BillingTier.Max,
    interval: BillingInterval.Monthly,
    overageMode: OverageMode.WithoutOverages,
    monthlyPriceUsd: 39.99,
    includedStaticRequests: 10_000_000,
    includedDynamicRequests: 1_000_000,
    includedStorageBytes: 5 * GB_BYTES,
    staticOveragePer1kUsd: null,
    dynamicOveragePer1kUsd: null,
    storageOveragePerGbUsd: null,
  },
  {
    productId: "max_annual_capped",
    tier: BillingTier.Max,
    interval: BillingInterval.Annually,
    overageMode: OverageMode.WithoutOverages,
    monthlyPriceUsd: 31.99,
    includedStaticRequests: 10_000_000,
    includedDynamicRequests: 1_000_000,
    includedStorageBytes: 5 * GB_BYTES,
    staticOveragePer1kUsd: null,
    dynamicOveragePer1kUsd: null,
    storageOveragePerGbUsd: null,
  },
  {
    productId: "max_monthly_overage",
    tier: BillingTier.Max,
    interval: BillingInterval.Monthly,
    overageMode: OverageMode.WithOverages,
    monthlyPriceUsd: 39.99,
    includedStaticRequests: 10_000_000,
    includedDynamicRequests: 1_000_000,
    includedStorageBytes: 5 * GB_BYTES,
    staticOveragePer1kUsd: 0.0026,
    dynamicOveragePer1kUsd: 0.013,
    storageOveragePerGbUsd: null,
  },
  {
    productId: "max_annual_overage",
    tier: BillingTier.Max,
    interval: BillingInterval.Annually,
    overageMode: OverageMode.WithOverages,
    monthlyPriceUsd: 31.99,
    includedStaticRequests: 10_000_000,
    includedDynamicRequests: 1_000_000,
    includedStorageBytes: 5 * GB_BYTES,
    staticOveragePer1kUsd: 0.0026,
    dynamicOveragePer1kUsd: 0.013,
    storageOveragePerGbUsd: null,
  },
];

const billingVariantValidator = v.object({
  productId: v.string(),
  tier: v.union(v.literal("free"), v.literal("pro"), v.literal("max")),
  interval: v.union(v.literal("monthly"), v.literal("annually")),
  overageMode: v.union(v.literal("without_overages"), v.literal("with_overages")),
  monthlyPriceUsd: v.number(),
  includedStaticRequests: v.number(),
  includedDynamicRequests: v.number(),
  includedStorageBytes: v.number(),
  staticOveragePer1kUsd: v.union(v.number(), v.null()),
  dynamicOveragePer1kUsd: v.union(v.number(), v.null()),
  storageOveragePerGbUsd: v.union(v.number(), v.null()),
  isConfiguredInAutumn: v.boolean(),
});

const scheduledPlanChangeValidator = v.object({
  productId: v.string(),
  tier: v.union(v.literal("free"), v.literal("pro"), v.literal("max")),
  interval: v.union(v.literal("monthly"), v.literal("annually")),
  overageMode: v.union(v.literal("without_overages"), v.literal("with_overages")),
  monthlyPriceUsd: v.number(),
});

type BillingVariant = {
  productId: string;
  tier: BillingTierValue;
  interval: BillingIntervalValue;
  overageMode: OverageModeValue;
  monthlyPriceUsd: number;
  includedStaticRequests: number;
  includedDynamicRequests: number;
  includedStorageBytes: number;
  staticOveragePer1kUsd: number | null;
  dynamicOveragePer1kUsd: number | null;
  storageOveragePerGbUsd: number | null;
  isConfiguredInAutumn: boolean;
};

type ScheduledPlanChange = {
  productId: string;
  tier: BillingTierValue;
  interval: BillingIntervalValue;
  overageMode: OverageModeValue;
  monthlyPriceUsd: number;
};

const featureUsageValidator = v.object({
  featureId: v.string(),
  allowed: v.boolean(),
  usage: v.union(v.number(), v.null()),
  includedUsage: v.union(v.number(), v.null()),
  usageLimit: v.union(v.number(), v.null()),
  overageAllowed: v.union(v.boolean(), v.null()),
  nextResetAtMs: v.union(v.number(), v.null()),
});

type FeatureUsage = {
  featureId: string;
  allowed: boolean;
  usage: number | null;
  includedUsage: number | null;
  usageLimit: number | null;
  overageAllowed: boolean | null;
  nextResetAtMs: number | null;
};

type BillingStateResponse = {
  orgId: string;
  orgRole: string | null;
  canManageBilling: boolean;
  currentProductId: string | null;
  currentTier: BillingTierValue | null;
  currentInterval: BillingIntervalValue | null;
  currentOverageMode: OverageModeValue | null;
  hasScheduledPlanChange: boolean;
  scheduledPlanChange: ScheduledPlanChange | null;
  usage: {
    staticRequests: FeatureUsage;
    dynamicRequests: FeatureUsage;
    storageBytes: FeatureUsage;
  };
  storageMirrorBytes: number;
  variants: Array<BillingVariant>;
};

function toDisabledFeatureUsage(input: { featureId: string }): FeatureUsage {
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

type WorkspacePlanStatusResponse = {
  orgId: string;
  orgRole: string | null;
  canManageBilling: boolean;
  currentProductId: string | null;
  currentTier: BillingTierValue | null;
  currentInterval: BillingIntervalValue | null;
  currentOverageMode: OverageModeValue | null;
  isPlanless: boolean;
  billingUnavailable: boolean;
};

type ReserveFeatureUnitsResult = {
  reservedUnits: number;
  errorCode: "USAGE_LIMIT_EXCEEDED" | "BILLING_UNAVAILABLE" | null;
};

const freePlanCreditStateValidator = v.object({
  clerkUserId: v.string(),
  totalCredits: v.number(),
  remainingCredits: v.number(),
  assignedOrgId: v.union(v.string(), v.null()),
  assignedOrgSlug: v.union(v.string(), v.null()),
  consumedAtMs: v.union(v.number(), v.null()),
  revokedAtMs: v.union(v.number(), v.null()),
  revokedReason: v.union(v.string(), v.null()),
});

type FreePlanCreditState = {
  clerkUserId: string;
  totalCredits: number;
  remainingCredits: number;
  assignedOrgId: string | null;
  assignedOrgSlug: string | null;
  consumedAtMs: number | null;
  revokedAtMs: number | null;
  revokedReason: string | null;
};

type ConsumeFreePlanCreditResult = {
  granted: boolean;
  reason:
    | "granted"
    | "already_assigned"
    | "org_already_assigned"
    | "assigned_elsewhere"
    | "no_remaining_credits";
  credit: FreePlanCreditState;
};

function toFreePlanCreditState(input: {
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

function normalizeFiniteNumber(input: unknown): number | null {
  return typeof input === "number" && Number.isFinite(input) ? input : null;
}

function normalizeString(input: unknown): string | null {
  return typeof input === "string" && input.length > 0 ? input : null;
}

function hasForceCheckoutUpgradeDowngradeError(error: unknown): boolean {
  const text =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : JSON.stringify(error);
  const normalized = text.toLowerCase();
  return (
    normalized.includes("force_checkout") &&
    normalized.includes("upgrade") &&
    normalized.includes("downgrade")
  );
}

function normalizeRecurringPriceToMonthly(input: {
  price: number;
  interval: string | null;
  intervalCount: number | null;
}): number {
  const count = input.intervalCount !== null && input.intervalCount > 0 ? input.intervalCount : 1;
  if (input.interval === "year") {
    return input.price / (count * 12);
  }
  if (input.interval === "month") {
    return input.price / count;
  }
  return input.price;
}

function isBillingManagerRole(role: string | null): boolean {
  return role === "org:admin" || role === "org:owner";
}

function readProductCatalog(products: Array<Record<string, unknown>>): Array<{
  id: string;
  monthlyPriceUsd: number | null;
  includedStaticRequests: number | null;
  includedDynamicRequests: number | null;
  includedStorageBytes: number | null;
  staticOveragePer1kUsd: number | null;
  dynamicOveragePer1kUsd: number | null;
  storageOveragePerGbUsd: number | null;
}> {
  return products.map((product) => {
    const id = normalizeString(product.id) ?? "";
    const items = Array.isArray(product.items)
      ? (product.items as Array<Record<string, unknown>>)
      : [];

    let monthlyPriceUsd: number | null = null;
    let includedStaticRequests: number | null = null;
    let includedDynamicRequests: number | null = null;
    let includedStorageBytes: number | null = null;
    let staticOveragePer1kUsd: number | null = null;
    let dynamicOveragePer1kUsd: number | null = null;
    let storageOveragePerGbUsd: number | null = null;

    for (const item of items) {
      const price = normalizeFiniteNumber(item.price);
      const billingUnits = normalizeFiniteNumber(item.billing_units) ?? 1;
      const featureId = normalizeString(item.feature_id);
      const interval = normalizeString(item.interval);
      const intervalCount = normalizeFiniteNumber(item.interval_count);
      const includedUsageRaw = item.included_usage;
      const includedUsage =
        typeof includedUsageRaw === "number" && Number.isFinite(includedUsageRaw)
          ? includedUsageRaw
          : null;

      if (monthlyPriceUsd === null && price !== null && featureId === null) {
        monthlyPriceUsd = normalizeRecurringPriceToMonthly({
          price,
          interval,
          intervalCount,
        });
      }

      if (featureId === FeatureId.StaticRequests) {
        if (includedUsage !== null) {
          includedStaticRequests = includedUsage;
        }
        if (price !== null && billingUnits > 0) {
          staticOveragePer1kUsd = (price / billingUnits) * 1000;
        }
      }
      if (featureId === FeatureId.DynamicRequests) {
        if (includedUsage !== null) {
          includedDynamicRequests = includedUsage;
        }
        if (price !== null && billingUnits > 0) {
          dynamicOveragePer1kUsd = (price / billingUnits) * 1000;
        }
      }
      if (featureId === FeatureId.StorageBytes) {
        if (includedUsage !== null) {
          includedStorageBytes = includedUsage;
        }
        if (price !== null && billingUnits > 0) {
          storageOveragePerGbUsd = (price / billingUnits) * GB_BYTES;
        }
      }
    }

    return {
      id,
      monthlyPriceUsd,
      includedStaticRequests,
      includedDynamicRequests,
      includedStorageBytes,
      staticOveragePer1kUsd,
      dynamicOveragePer1kUsd,
      storageOveragePerGbUsd,
    };
  });
}

async function resolvePricingVariants(ctx: ActionCtx): Promise<Array<BillingVariant>> {
  const autumnProductsResult = await ctx.runAction(api.autumn.listProducts, {});
  const rawProducts =
    autumnProductsResult.error === null &&
    autumnProductsResult.data &&
    typeof autumnProductsResult.data === "object" &&
    Array.isArray((autumnProductsResult.data as { list?: unknown }).list)
      ? ((autumnProductsResult.data as { list: unknown }).list as Array<Record<string, unknown>>)
      : [];

  const productCatalog = readProductCatalog(rawProducts);
  const byProductId = new Map(productCatalog.map((entry) => [entry.id, entry]));

  return DEFAULT_VARIANTS.map((fallback) => {
    const configured = byProductId.get(fallback.productId);
    return {
      productId: fallback.productId,
      tier: fallback.tier,
      interval: fallback.interval,
      overageMode: fallback.overageMode,
      monthlyPriceUsd: configured?.monthlyPriceUsd ?? fallback.monthlyPriceUsd,
      includedStaticRequests: configured?.includedStaticRequests ?? fallback.includedStaticRequests,
      includedDynamicRequests:
        configured?.includedDynamicRequests ?? fallback.includedDynamicRequests,
      includedStorageBytes: configured?.includedStorageBytes ?? fallback.includedStorageBytes,
      staticOveragePer1kUsd: configured?.staticOveragePer1kUsd ?? fallback.staticOveragePer1kUsd,
      dynamicOveragePer1kUsd: configured?.dynamicOveragePer1kUsd ?? fallback.dynamicOveragePer1kUsd,
      storageOveragePerGbUsd: configured?.storageOveragePerGbUsd ?? fallback.storageOveragePerGbUsd,
      isConfiguredInAutumn: configured !== undefined,
    };
  });
}

function resolveProductId(input: {
  tier: BillingTierValue;
  interval: BillingIntervalValue;
  overageMode: OverageModeValue;
}): string {
  const match = DEFAULT_VARIANTS.find(
    (entry) =>
      entry.tier === input.tier &&
      entry.interval === input.interval &&
      entry.overageMode === input.overageMode,
  );
  if (!match) {
    throw new Error("Unable to resolve the requested billing plan.");
  }
  return match.productId;
}

function resolveVariant(input: {
  variants: Array<BillingVariant>;
  tier: BillingTierValue;
  interval: BillingIntervalValue;
  overageMode: OverageModeValue;
}): BillingVariant {
  const match = input.variants.find(
    (entry) =>
      entry.tier === input.tier &&
      entry.interval === input.interval &&
      entry.overageMode === input.overageMode,
  );
  if (!match) {
    throw new Error("Unable to resolve the requested billing plan.");
  }
  return match;
}

async function hasFreePlanCreditAssignedToOrg(
  ctx: ActionCtx,
  input: {
    orgId: string;
  },
): Promise<boolean> {
  const credit = await ctx.runQuery(internal.payments.getFreePlanCreditForOrgIdInternal, {
    orgId: input.orgId,
  });
  return credit !== null;
}

function readCurrentProductId(customerData: unknown): string | null {
  const normalized = readCustomerProducts(customerData);
  const active =
    normalized.find((entry) => entry.status === "active") ??
    normalized.find((entry) => entry.status === "trialing") ??
    normalized.find((entry) => entry.status === "past_due") ??
    normalized.find((entry) => entry.status === "scheduled");
  return active?.id ?? null;
}

function readCustomerProducts(customerData: unknown): Array<{
  id: string;
  status: string;
}> {
  if (typeof customerData !== "object" || customerData === null) {
    return [];
  }
  const products = (customerData as { products?: unknown }).products;
  if (!Array.isArray(products)) {
    return [];
  }

  const normalized = products
    .map((product) => {
      if (typeof product !== "object" || product === null) {
        return null;
      }
      const record = product as Record<string, unknown>;
      const status = normalizeString(record.status);
      const id = normalizeString(record.id) ?? normalizeString(record.product_id);
      if (id === null || status === null) {
        return null;
      }
      return { id, status };
    })
    .filter((value): value is { id: string; status: string } => value !== null);
  return normalized;
}

function readCurrentVariantFromProductId(input: string | null): {
  tier: BillingTierValue;
  interval: BillingIntervalValue;
  overageMode: OverageModeValue;
} | null {
  if (input === null) {
    return null;
  }

  const matched = DEFAULT_VARIANTS.find((variant) => variant.productId === input);
  if (!matched) {
    return null;
  }

  return {
    tier: matched.tier,
    interval: matched.interval,
    overageMode: matched.overageMode,
  };
}

async function ensureAutumnCustomerForOrg(input: {
  orgId: string;
  orgSlug: string | null;
}): Promise<{
  data: unknown;
  error: unknown;
}> {
  const autumn = createAutumnClient();
  const result = await autumn.customers.create({
    id: input.orgId,
    name: input.orgSlug ?? input.orgId,
  });
  return {
    data: result.data,
    error: result.error,
  };
}

async function readWorkspacePlanStateForOrg(
  ctx: ActionCtx,
  input: {
    orgId: string;
    orgSlug: string | null;
  },
): Promise<WorkspacePlanState> {
  const customerResult = await ensureAutumnCustomerForOrg(input);
  if (customerResult.error !== null) {
    throw new Error(BILLING_UNAVAILABLE_ERROR_MESSAGE);
  }

  const currentProductId = readCurrentProductId(customerResult.data);
  if (currentProductId === null) {
    throw new Error(PLANLESS_WORKSPACE_ERROR_MESSAGE);
  }

  const currentVariant = readCurrentVariantFromProductId(currentProductId);
  if (currentVariant?.tier === BillingTier.Free) {
    const hasAssignedFreePlanCredit = await hasFreePlanCreditAssignedToOrg(ctx, {
      orgId: input.orgId,
    });
    if (!hasAssignedFreePlanCredit) {
      throw new Error(PLANLESS_WORKSPACE_ERROR_MESSAGE);
    }
  }

  return {
    currentProductId,
    currentTier: currentVariant?.tier ?? null,
  };
}

function readDefaultVariantByProductId(input: string | null): DefaultVariant | null {
  if (input === null) {
    return null;
  }
  return DEFAULT_VARIANTS.find((variant) => variant.productId === input) ?? null;
}

async function readFeatureUsage(ctx: ActionCtx, featureId: string): Promise<FeatureUsage> {
  const result = await ctx.runAction(api.autumn.check, {
    featureId,
  });

  if (result.error !== null || result.data === null) {
    return {
      featureId,
      allowed: false,
      usage: null,
      includedUsage: null,
      usageLimit: null,
      overageAllowed: null,
      nextResetAtMs: null,
    };
  }

  return {
    featureId,
    allowed: result.data.allowed,
    usage: normalizeFiniteNumber(result.data.usage),
    includedUsage: normalizeFiniteNumber(result.data.included_usage),
    usageLimit: normalizeFiniteNumber(result.data.usage_limit),
    overageAllowed:
      typeof result.data.overage_allowed === "boolean" ? result.data.overage_allowed : null,
    nextResetAtMs: normalizeFiniteNumber(result.data.next_reset_at),
  };
}

async function computeEncryptedBytesForOrg(ctx: MutationCtx, orgId: string): Promise<number> {
  const projects = await ctx.db
    .query("projects")
    .withIndex("by_org_id", (q) => q.eq("orgId", orgId))
    .collect();

  let total = 0;
  for (const project of projects) {
    const rows = await ctx.db
      .query("projectVariables")
      .withIndex("by_org_id_and_project_id", (q) =>
        q.eq("orgId", orgId).eq("projectId", project._id),
      )
      .collect();
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

async function getCanonicalOrgStorageUsageRow(
  ctx: QueryCtx | MutationCtx,
  orgId: string,
): Promise<{
  _id: Id<"orgStorageUsage">;
  orgId: string;
  encryptedBytes: number;
  createdAtMs: number;
  updatedAtMs: number;
} | null> {
  const rows = await ctx.db
    .query("orgStorageUsage")
    .withIndex("by_org_id", (q) => q.eq("orgId", orgId))
    .collect();
  return pickCanonicalRow(rows);
}

async function getCanonicalFreePlanCreditForClerkUserId(
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
  const rows = await ctx.db
    .query("userFreePlanCredits")
    .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
    .collect();
  return pickCanonicalRow(rows);
}

export const getPricingCatalogPublic = action({
  args: {},
  returns: v.object({
    variants: v.array(billingVariantValidator),
    featureIds: v.object({
      staticRequests: v.string(),
      dynamicRequests: v.string(),
      storageBytes: v.string(),
    }),
  }),
  handler: async (ctx) => {
    const variants = await resolvePricingVariants(ctx);
    return {
      variants,
      featureIds: {
        staticRequests: FeatureId.StaticRequests,
        dynamicRequests: FeatureId.DynamicRequests,
        storageBytes: FeatureId.StorageBytes,
      },
    };
  },
});

export const getOrgStorageUsageInternal = internalQuery({
  args: {
    orgId: v.string(),
  },
  returns: v.union(
    v.object({
      encryptedBytes: v.number(),
      updatedAtMs: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("orgStorageUsage")
      .withIndex("by_org_id", (q) => q.eq("orgId", args.orgId))
      .collect();
    const row = pickCanonicalRow(rows);
    if (row === null) {
      return null;
    }
    return {
      encryptedBytes: row.encryptedBytes,
      updatedAtMs: row.updatedAtMs,
    };
  },
});

export const ensureOrgStorageUsageForOrgInternal = internalMutation({
  args: {
    orgId: v.string(),
  },
  returns: v.object({
    encryptedBytes: v.number(),
    initialized: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const existing = await getCanonicalOrgStorageUsageRow(ctx, args.orgId);
    if (existing !== null) {
      return {
        encryptedBytes: existing.encryptedBytes,
        initialized: false,
      };
    }
    const encryptedBytes = await computeEncryptedBytesForOrg(ctx, args.orgId);
    const now = Date.now();
    await ctx.db.insert("orgStorageUsage", {
      orgId: args.orgId,
      encryptedBytes,
      createdAtMs: now,
      updatedAtMs: now,
    });

    return {
      encryptedBytes,
      initialized: true,
    };
  },
});

export const applyStorageDeltaForOrgInternal = internalMutation({
  args: {
    orgId: v.string(),
    deltaBytes: v.number(),
  },
  returns: v.object({
    encryptedBytes: v.number(),
    updatedAtMs: v.number(),
  }),
  handler: async (ctx, args): Promise<{ encryptedBytes: number; updatedAtMs: number }> => {
    let existing = await getCanonicalOrgStorageUsageRow(ctx, args.orgId);
    if (existing === null) {
      const encryptedBytes = await computeEncryptedBytesForOrg(ctx, args.orgId);
      const now = Date.now();
      const rowId = await ctx.db.insert("orgStorageUsage", {
        orgId: args.orgId,
        encryptedBytes,
        createdAtMs: now,
        updatedAtMs: now,
      });
      existing = {
        _id: rowId,
        orgId: args.orgId,
        encryptedBytes,
        createdAtMs: now,
        updatedAtMs: now,
      };
    }

    const nextEncryptedBytes = Math.max(0, existing.encryptedBytes + args.deltaBytes);
    const now = Date.now();
    await ctx.db.patch(existing._id, {
      encryptedBytes: nextEncryptedBytes,
      updatedAtMs: now,
    });

    return {
      encryptedBytes: nextEncryptedBytes,
      updatedAtMs: now,
    };
  },
});

export const logBillingRequestInternal = internalMutation({
  args: {
    orgId: v.string(),
    requestKey: v.string(),
    featureId: v.string(),
    units: v.number(),
  },
  returns: v.object({
    inserted: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("billingRequestLog")
      .withIndex("by_org_id_and_request_key", (q) =>
        q.eq("orgId", args.orgId).eq("requestKey", args.requestKey),
      )
      .collect();
    if (existing.length > 0) {
      return { inserted: false };
    }

    const rowId = await ctx.db.insert("billingRequestLog", {
      orgId: args.orgId,
      requestKey: args.requestKey,
      featureId: args.featureId,
      units: args.units,
      createdAtMs: Date.now(),
    });
    const rows = await ctx.db
      .query("billingRequestLog")
      .withIndex("by_org_id_and_request_key", (q) =>
        q.eq("orgId", args.orgId).eq("requestKey", args.requestKey),
      )
      .collect();
    const canonical = pickCanonicalRow(rows);
    if (canonical === null) {
      return { inserted: false };
    }
    if (canonical._id !== rowId) {
      await ctx.db.delete(rowId);
      return { inserted: false };
    }

    for (const row of rows) {
      if (row._id !== canonical._id) {
        await ctx.db.delete(row._id);
      }
    }
    return { inserted: true };
  },
});

export const getFreePlanCreditForClerkUserIdInternal = internalQuery({
  args: {
    clerkUserId: v.string(),
  },
  returns: v.union(freePlanCreditStateValidator, v.null()),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("userFreePlanCredits")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .collect();
    const row = pickCanonicalRow(rows);
    if (row === null) {
      return null;
    }
    return toFreePlanCreditState(row);
  },
});

export const getFreePlanCreditForOrgIdInternal = internalQuery({
  args: {
    orgId: v.string(),
  },
  returns: v.union(freePlanCreditStateValidator, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("userFreePlanCredits")
      .withIndex("by_assigned_org_id", (q) => q.eq("assignedOrgId", args.orgId))
      .first();
    if (row === null) {
      return null;
    }
    return toFreePlanCreditState(row);
  },
});

export const ensureFreePlanCreditForClerkUserInternal = internalMutation({
  args: {
    clerkUserId: v.string(),
    orgId: v.union(v.string(), v.null()),
    orgSlug: v.union(v.string(), v.null()),
    consumeForOrgIfAvailable: v.boolean(),
  },
  returns: freePlanCreditStateValidator,
  handler: async (ctx, args): Promise<FreePlanCreditState> => {
    const now = Date.now();
    let row = await getCanonicalFreePlanCreditForClerkUserId(ctx, args.clerkUserId);
    let createdCredit = false;

    if (row === null) {
      const rowId = await ctx.db.insert("userFreePlanCredits", {
        clerkUserId: args.clerkUserId,
        totalCredits: 1,
        remainingCredits: 1,
        assignedOrgId: null,
        assignedOrgSlug: null,
        consumedAtMs: null,
        revokedAtMs: null,
        revokedReason: null,
        createdAtMs: now,
        updatedAtMs: now,
      });
      row = {
        _id: rowId,
        clerkUserId: args.clerkUserId,
        totalCredits: 1,
        remainingCredits: 1,
        assignedOrgId: null,
        assignedOrgSlug: null,
        consumedAtMs: null,
        revokedAtMs: null,
        revokedReason: null,
        createdAtMs: now,
        updatedAtMs: now,
      };
      createdCredit = true;
    }
    if (row === null) {
      throw new Error("Unable to create a free organization credit.");
    }
    const currentRow = row;
    const currentRowId = currentRow._id;

    if (
      args.consumeForOrgIfAvailable &&
      createdCredit &&
      args.orgId !== null &&
      currentRow.assignedOrgId === null &&
      currentRow.remainingCredits > 0
    ) {
      const existingOrgAssignments = await ctx.db
        .query("userFreePlanCredits")
        .withIndex("by_assigned_org_id", (q) => q.eq("assignedOrgId", args.orgId))
        .collect();
      const assignmentExistsForAnotherCredit = existingOrgAssignments.some(
        (entry) => entry._id !== currentRowId,
      );
      if (assignmentExistsForAnotherCredit) {
        return toFreePlanCreditState(currentRow);
      }

      const nextRemainingCredits = Math.max(0, currentRow.remainingCredits - 1);
      await ctx.db.patch(currentRow._id, {
        remainingCredits: nextRemainingCredits,
        assignedOrgId: args.orgId,
        assignedOrgSlug: args.orgSlug,
        consumedAtMs: now,
        revokedAtMs: null,
        revokedReason: null,
        updatedAtMs: now,
      });
      row = {
        ...currentRow,
        remainingCredits: nextRemainingCredits,
        assignedOrgId: args.orgId,
        assignedOrgSlug: args.orgSlug,
        consumedAtMs: now,
        revokedAtMs: null,
        revokedReason: null,
        updatedAtMs: now,
      };
    } else if (
      args.orgId !== null &&
      currentRow.assignedOrgId === args.orgId &&
      currentRow.assignedOrgSlug !== args.orgSlug
    ) {
      await ctx.db.patch(currentRow._id, {
        assignedOrgSlug: args.orgSlug,
        updatedAtMs: now,
      });
      row = {
        ...currentRow,
        assignedOrgSlug: args.orgSlug,
        updatedAtMs: now,
      };
    }

    return toFreePlanCreditState(row ?? currentRow);
  },
});

export const consumeFreePlanCreditForCurrentOrgInternal = internalMutation({
  args: {
    clerkUserId: v.string(),
    orgId: v.string(),
    orgSlug: v.union(v.string(), v.null()),
  },
  returns: v.object({
    granted: v.boolean(),
    reason: v.union(
      v.literal("granted"),
      v.literal("already_assigned"),
      v.literal("org_already_assigned"),
      v.literal("assigned_elsewhere"),
      v.literal("no_remaining_credits"),
    ),
    credit: freePlanCreditStateValidator,
  }),
  handler: async (ctx, args): Promise<ConsumeFreePlanCreditResult> => {
    const now = Date.now();
    let row = await getCanonicalFreePlanCreditForClerkUserId(ctx, args.clerkUserId);

    if (row === null) {
      const rowId = await ctx.db.insert("userFreePlanCredits", {
        clerkUserId: args.clerkUserId,
        totalCredits: 1,
        remainingCredits: 1,
        assignedOrgId: null,
        assignedOrgSlug: null,
        consumedAtMs: null,
        revokedAtMs: null,
        revokedReason: null,
        createdAtMs: now,
        updatedAtMs: now,
      });
      row = {
        _id: rowId,
        clerkUserId: args.clerkUserId,
        totalCredits: 1,
        remainingCredits: 1,
        assignedOrgId: null,
        assignedOrgSlug: null,
        consumedAtMs: null,
        revokedAtMs: null,
        revokedReason: null,
        createdAtMs: now,
        updatedAtMs: now,
      };
    }
    if (row === null) {
      throw new Error("Unable to create a free organization credit.");
    }

    if (row.assignedOrgId === args.orgId) {
      if (row.assignedOrgSlug !== args.orgSlug) {
        await ctx.db.patch(row._id, {
          assignedOrgSlug: args.orgSlug,
          updatedAtMs: now,
        });
        row = {
          ...row,
          assignedOrgSlug: args.orgSlug,
          updatedAtMs: now,
        };
      }
      return {
        granted: true,
        reason: "already_assigned",
        credit: toFreePlanCreditState(row),
      };
    }

    const existingOrgAssignments = await ctx.db
      .query("userFreePlanCredits")
      .withIndex("by_assigned_org_id", (q) => q.eq("assignedOrgId", args.orgId))
      .collect();
    const assignmentExistsForAnotherCredit = existingOrgAssignments.some(
      (entry) => entry._id !== row._id,
    );
    if (assignmentExistsForAnotherCredit) {
      return {
        granted: false,
        reason: "org_already_assigned",
        credit: toFreePlanCreditState(row),
      };
    }

    if (row.assignedOrgId !== null && row.assignedOrgId !== args.orgId) {
      return {
        granted: false,
        reason: "assigned_elsewhere",
        credit: toFreePlanCreditState(row),
      };
    }

    if (row.remainingCredits <= 0) {
      return {
        granted: false,
        reason: "no_remaining_credits",
        credit: toFreePlanCreditState(row),
      };
    }

    const nextRemainingCredits = Math.max(0, row.remainingCredits - 1);
    await ctx.db.patch(row._id, {
      remainingCredits: nextRemainingCredits,
      assignedOrgId: args.orgId,
      assignedOrgSlug: args.orgSlug,
      consumedAtMs: now,
      revokedAtMs: null,
      revokedReason: null,
      updatedAtMs: now,
    });
    const patched = {
      ...row,
      remainingCredits: nextRemainingCredits,
      assignedOrgId: args.orgId,
      assignedOrgSlug: args.orgSlug,
      consumedAtMs: now,
      revokedAtMs: null,
      revokedReason: null,
      updatedAtMs: now,
    };
    return {
      granted: true,
      reason: "granted",
      credit: toFreePlanCreditState(patched),
    };
  },
});

export const revokeFreePlanCreditForCurrentOrgInternal = internalMutation({
  args: {
    clerkUserId: v.string(),
    orgId: v.string(),
    reason: v.union(v.string(), v.null()),
  },
  returns: v.object({
    revoked: v.boolean(),
    reason: v.union(
      v.literal("revoked"),
      v.literal("already_available"),
      v.literal("not_assigned_to_org"),
    ),
    credit: freePlanCreditStateValidator,
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    let row = await getCanonicalFreePlanCreditForClerkUserId(ctx, args.clerkUserId);

    if (row === null) {
      const rowId = await ctx.db.insert("userFreePlanCredits", {
        clerkUserId: args.clerkUserId,
        totalCredits: 1,
        remainingCredits: 1,
        assignedOrgId: null,
        assignedOrgSlug: null,
        consumedAtMs: null,
        revokedAtMs: null,
        revokedReason: null,
        createdAtMs: now,
        updatedAtMs: now,
      });
      row = {
        _id: rowId,
        clerkUserId: args.clerkUserId,
        totalCredits: 1,
        remainingCredits: 1,
        assignedOrgId: null,
        assignedOrgSlug: null,
        consumedAtMs: null,
        revokedAtMs: null,
        revokedReason: null,
        createdAtMs: now,
        updatedAtMs: now,
      };
      return {
        revoked: false,
        reason: "already_available" as const,
        credit: toFreePlanCreditState(row),
      };
    }

    if (row.assignedOrgId === null) {
      return {
        revoked: false,
        reason: "already_available" as const,
        credit: toFreePlanCreditState(row),
      };
    }

    if (row.assignedOrgId !== args.orgId) {
      return {
        revoked: false,
        reason: "not_assigned_to_org" as const,
        credit: toFreePlanCreditState(row),
      };
    }

    const nextRemainingCredits = Math.min(row.totalCredits, row.remainingCredits + 1);
    await ctx.db.patch(row._id, {
      remainingCredits: nextRemainingCredits,
      assignedOrgId: null,
      assignedOrgSlug: null,
      revokedAtMs: now,
      revokedReason: args.reason ?? "manual_revoke",
      updatedAtMs: now,
    });
    const patched = {
      ...row,
      remainingCredits: nextRemainingCredits,
      assignedOrgId: null,
      assignedOrgSlug: null,
      revokedAtMs: now,
      revokedReason: args.reason ?? "manual_revoke",
      updatedAtMs: now,
    };
    return {
      revoked: true,
      reason: "revoked" as const,
      credit: toFreePlanCreditState(patched),
    };
  },
});

export const revokeFreePlanCreditByOrgIdInternal = internalMutation({
  args: {
    orgId: v.string(),
    reason: v.union(v.string(), v.null()),
  },
  returns: v.object({
    revoked: v.boolean(),
    credit: v.union(freePlanCreditStateValidator, v.null()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("userFreePlanCredits")
      .withIndex("by_assigned_org_id", (q) => q.eq("assignedOrgId", args.orgId))
      .collect();
    if (rows.length === 0) {
      return {
        revoked: false,
        credit: null,
      };
    }

    const patchedRows: Array<FreePlanCreditState> = [];
    for (const row of rows) {
      const nextRemainingCredits = Math.min(row.totalCredits, row.remainingCredits + 1);
      await ctx.db.patch(row._id, {
        remainingCredits: nextRemainingCredits,
        assignedOrgId: null,
        assignedOrgSlug: null,
        revokedAtMs: now,
        revokedReason: args.reason ?? "manual_revoke",
        updatedAtMs: now,
      });
      patchedRows.push(
        toFreePlanCreditState({
          ...row,
          remainingCredits: nextRemainingCredits,
          assignedOrgId: null,
          assignedOrgSlug: null,
          revokedAtMs: now,
          revokedReason: args.reason ?? "manual_revoke",
        }),
      );
    }

    return {
      revoked: true,
      credit: patchedRows[0] ?? null,
    };
  },
});

export const reserveFeatureUnitsForCurrentOrgInternal = internalAction({
  args: {
    expectedOrgSlug: v.string(),
    featureId: v.string(),
    units: v.number(),
    reason: v.string(),
  },
  returns: v.object({
    reservedUnits: v.number(),
    errorCode: v.union(
      v.literal("USAGE_LIMIT_EXCEEDED"),
      v.literal("BILLING_UNAVAILABLE"),
      v.null(),
    ),
  }),
  handler: async (ctx, args): Promise<ReserveFeatureUnitsResult> => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    return await ctx.runAction(internal.payments.reserveFeatureUnitsForOrgInternal, {
      orgId: activeOrg.orgId,
      orgSlug: activeOrg.orgSlug,
      featureId: args.featureId,
      units: args.units,
      reason: args.reason,
    });
  },
});

export const reserveFeatureUnitsForOrgInternal = internalAction({
  args: {
    orgId: v.string(),
    orgSlug: v.union(v.string(), v.null()),
    featureId: v.string(),
    units: v.number(),
    reason: v.string(),
  },
  returns: v.object({
    reservedUnits: v.number(),
    errorCode: v.union(
      v.literal("USAGE_LIMIT_EXCEEDED"),
      v.literal("BILLING_UNAVAILABLE"),
      v.null(),
    ),
  }),
  handler: async (_ctx, args): Promise<ReserveFeatureUnitsResult> => {
    try {
      await readWorkspacePlanStateForOrg(_ctx, {
        orgId: args.orgId,
        orgSlug: args.orgSlug,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === PLANLESS_WORKSPACE_ERROR_MESSAGE) {
        return {
          reservedUnits: 0,
          errorCode: "USAGE_LIMIT_EXCEEDED",
        };
      }
      return {
        reservedUnits: 0,
        errorCode: "BILLING_UNAVAILABLE",
      };
    }

    if (!Number.isFinite(args.units) || args.units <= 0) {
      return {
        reservedUnits: 0,
        errorCode: null,
      };
    }

    const autumn = createAutumnClient();
    const result = await autumn.check({
      customer_id: args.orgId,
      feature_id: args.featureId,
      required_balance: args.units,
      send_event: true,
    });

    if (result.error !== null || result.data === null) {
      return {
        reservedUnits: 0,
        errorCode: "BILLING_UNAVAILABLE",
      };
    }
    if (!result.data.allowed) {
      return {
        reservedUnits: 0,
        errorCode: "USAGE_LIMIT_EXCEEDED",
      };
    }

    return {
      reservedUnits: args.units,
      errorCode: null,
    };
  },
});

export const getWorkspacePlanStatusForCurrentOrg = action({
  args: {
    expectedOrgSlug: v.string(),
  },
  returns: v.object({
    orgId: v.string(),
    orgRole: v.union(v.string(), v.null()),
    canManageBilling: v.boolean(),
    currentProductId: v.union(v.string(), v.null()),
    currentTier: v.union(v.literal("free"), v.literal("pro"), v.literal("max"), v.null()),
    currentInterval: v.union(v.literal("monthly"), v.literal("annually"), v.null()),
    currentOverageMode: v.union(
      v.literal("without_overages"),
      v.literal("with_overages"),
      v.null(),
    ),
    isPlanless: v.boolean(),
    billingUnavailable: v.boolean(),
  }),
  handler: async (ctx, args): Promise<WorkspacePlanStatusResponse> => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    const customerResult = await ctx.runAction(api.autumn.createCustomer, {
      errorOnNotFound: false,
    });
    if (customerResult.error !== null) {
      return {
        orgId: activeOrg.orgId,
        orgRole: activeOrg.orgRole,
        canManageBilling: isBillingManagerRole(activeOrg.orgRole),
        currentProductId: null,
        currentTier: null,
        currentInterval: null,
        currentOverageMode: null,
        isPlanless: false,
        billingUnavailable: true,
      };
    }

    const currentProductId = readCurrentProductId(customerResult.data);
    const currentVariant = readCurrentVariantFromProductId(currentProductId);
    const hasAssignedFreePlanCredit =
      currentVariant?.tier === BillingTier.Free
        ? await hasFreePlanCreditAssignedToOrg(ctx, {
            orgId: activeOrg.orgId,
          })
        : false;
    const isWithoutPlan =
      currentProductId === null ||
      (currentVariant?.tier === BillingTier.Free && !hasAssignedFreePlanCredit);

    return {
      orgId: activeOrg.orgId,
      orgRole: activeOrg.orgRole,
      canManageBilling: isBillingManagerRole(activeOrg.orgRole),
      currentProductId: isWithoutPlan ? null : currentProductId,
      currentTier: isWithoutPlan ? null : (currentVariant?.tier ?? null),
      currentInterval: isWithoutPlan ? null : (currentVariant?.interval ?? null),
      currentOverageMode: isWithoutPlan ? null : (currentVariant?.overageMode ?? null),
      isPlanless: isWithoutPlan,
      billingUnavailable: false,
    };
  },
});

export const assertWorkspacePlanForCurrentOrgInternal = internalAction({
  args: {
    expectedOrgSlug: v.string(),
  },
  returns: v.object({
    orgId: v.string(),
    currentProductId: v.string(),
    currentTier: v.union(v.literal("free"), v.literal("pro"), v.literal("max"), v.null()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    orgId: string;
    currentProductId: string;
    currentTier: BillingTierValue | null;
  }> => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    const planState = await ctx.runAction(internal.payments.assertWorkspacePlanForOrgInternal, {
      orgId: activeOrg.orgId,
      orgSlug: activeOrg.orgSlug,
    });
    return {
      orgId: activeOrg.orgId,
      currentProductId: planState.currentProductId,
      currentTier: planState.currentTier,
    };
  },
});

export const assertWorkspacePlanForOrgInternal = internalAction({
  args: {
    orgId: v.string(),
    orgSlug: v.union(v.string(), v.null()),
  },
  returns: v.object({
    orgId: v.string(),
    currentProductId: v.string(),
    currentTier: v.union(v.literal("free"), v.literal("pro"), v.literal("max"), v.null()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    orgId: string;
    currentProductId: string;
    currentTier: BillingTierValue | null;
  }> => {
    const planState = await readWorkspacePlanStateForOrg(ctx, {
      orgId: args.orgId,
      orgSlug: args.orgSlug,
    });
    return {
      orgId: args.orgId,
      currentProductId: planState.currentProductId,
      currentTier: planState.currentTier,
    };
  },
});

export const compensateFeatureUnitsForCurrentOrgInternal = internalAction({
  args: {
    expectedOrgSlug: v.string(),
    featureId: v.string(),
    units: v.number(),
    reason: v.string(),
  },
  returns: v.object({
    compensatedUnits: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    compensatedUnits: number;
  }> => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    return await ctx.runAction(internal.payments.compensateFeatureUnitsForOrgInternal, {
      orgId: activeOrg.orgId,
      orgSlug: activeOrg.orgSlug,
      featureId: args.featureId,
      units: args.units,
      reason: args.reason,
    });
  },
});

export const compensateFeatureUnitsForOrgInternal = internalAction({
  args: {
    orgId: v.string(),
    orgSlug: v.union(v.string(), v.null()),
    featureId: v.string(),
    units: v.number(),
    reason: v.string(),
  },
  returns: v.object({
    compensatedUnits: v.number(),
  }),
  handler: async (_ctx, args) => {
    if (!Number.isFinite(args.units) || args.units <= 0) {
      return {
        compensatedUnits: 0,
      };
    }

    const autumn = createAutumnClient();
    const result = await autumn.track({
      customer_id: args.orgId,
      feature_id: args.featureId,
      value: -Math.abs(args.units),
      properties: {
        reason: args.reason,
      },
    });

    if (result.error !== null) {
      throw new Error(METERED_USAGE_ROLLBACK_ERROR_MESSAGE);
    }

    return {
      compensatedUnits: Math.abs(args.units),
    };
  },
});

export const getBillingStateForCurrentOrg = action({
  args: {
    expectedOrgSlug: v.string(),
  },
  returns: v.object({
    orgId: v.string(),
    orgRole: v.union(v.string(), v.null()),
    canManageBilling: v.boolean(),
    currentProductId: v.union(v.string(), v.null()),
    currentTier: v.union(v.literal("free"), v.literal("pro"), v.literal("max"), v.null()),
    currentInterval: v.union(v.literal("monthly"), v.literal("annually"), v.null()),
    currentOverageMode: v.union(
      v.literal("without_overages"),
      v.literal("with_overages"),
      v.null(),
    ),
    hasScheduledPlanChange: v.boolean(),
    scheduledPlanChange: v.union(scheduledPlanChangeValidator, v.null()),
    usage: v.object({
      staticRequests: featureUsageValidator,
      dynamicRequests: featureUsageValidator,
      storageBytes: featureUsageValidator,
    }),
    storageMirrorBytes: v.number(),
    variants: v.array(billingVariantValidator),
  }),
  handler: async (ctx, args): Promise<BillingStateResponse> => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    const ensuredStorage = await ctx.runMutation(
      internal.payments.ensureOrgStorageUsageForOrgInternal,
      {
        orgId: activeOrg.orgId,
      },
    );
    if (ensuredStorage.initialized) {
      const syncStorageUsageResult = await ctx.runAction(api.autumn.usage, {
        featureId: FeatureId.StorageBytes,
        value: ensuredStorage.encryptedBytes,
      });
      if (syncStorageUsageResult.error !== null) {
        console.error("Failed to sync initial storage usage to Autumn.", {
          orgId: activeOrg.orgId,
          error: syncStorageUsageResult.error,
        });
      }
    }

    const resultBundle = await Promise.all([
      resolvePricingVariants(ctx),
      ctx.runAction(api.autumn.createCustomer, {
        errorOnNotFound: false,
      }),
      readFeatureUsage(ctx, FeatureId.StaticRequests),
      readFeatureUsage(ctx, FeatureId.DynamicRequests),
      readFeatureUsage(ctx, FeatureId.StorageBytes),
    ]);
    const variants: Array<BillingVariant> = resultBundle[0];
    const customerResult = resultBundle[1];
    const staticUsage: FeatureUsage = resultBundle[2];
    const dynamicUsage: FeatureUsage = resultBundle[3];
    const storageUsage: FeatureUsage = resultBundle[4];

    const allProducts = readCustomerProducts(customerResult.data);
    const currentProductId = readCurrentProductId(customerResult.data);
    const hasScheduledPlanChange = allProducts.some(
      (entry) => entry.status === "scheduled" && entry.id !== currentProductId,
    );
    const scheduledProduct = allProducts.find(
      (entry) => entry.status === "scheduled" && entry.id !== currentProductId,
    );
    const scheduledVariantFromCatalog =
      variants.find((variant) => variant.productId === (scheduledProduct?.id ?? "")) ?? null;
    const scheduledVariantFromFallback = readCurrentVariantFromProductId(
      scheduledProduct?.id ?? null,
    );
    const scheduledDefaultVariant = readDefaultVariantByProductId(scheduledProduct?.id ?? null);
    const scheduledPlanChange: ScheduledPlanChange | null =
      scheduledProduct !== undefined && scheduledVariantFromFallback !== null
        ? {
            productId: scheduledProduct.id,
            tier: scheduledVariantFromCatalog?.tier ?? scheduledVariantFromFallback.tier,
            interval:
              scheduledVariantFromCatalog?.interval ?? scheduledVariantFromFallback.interval,
            overageMode:
              scheduledVariantFromCatalog?.overageMode ?? scheduledVariantFromFallback.overageMode,
            monthlyPriceUsd:
              scheduledVariantFromCatalog?.monthlyPriceUsd ??
              scheduledDefaultVariant?.monthlyPriceUsd ??
              0,
          }
        : null;
    const currentVariantFromCatalog: BillingVariant | null =
      variants.find((variant) => variant.productId === currentProductId) ?? null;
    const currentVariantFromFallback = readCurrentVariantFromProductId(currentProductId);
    const currentTier = currentVariantFromCatalog?.tier ?? currentVariantFromFallback?.tier ?? null;
    const hasAssignedFreePlanCredit =
      currentTier === BillingTier.Free
        ? await hasFreePlanCreditAssignedToOrg(ctx, {
            orgId: activeOrg.orgId,
          })
        : false;
    const isWithoutPlan =
      currentProductId === null || (currentTier === BillingTier.Free && !hasAssignedFreePlanCredit);
    const effectiveStaticUsage = isWithoutPlan
      ? toDisabledFeatureUsage({
          featureId: FeatureId.StaticRequests,
        })
      : staticUsage;
    const effectiveDynamicUsage = isWithoutPlan
      ? toDisabledFeatureUsage({
          featureId: FeatureId.DynamicRequests,
        })
      : dynamicUsage;
    const effectiveStorageUsage = isWithoutPlan
      ? toDisabledFeatureUsage({
          featureId: FeatureId.StorageBytes,
        })
      : storageUsage;

    return {
      orgId: activeOrg.orgId,
      orgRole: activeOrg.orgRole,
      canManageBilling: isBillingManagerRole(activeOrg.orgRole),
      currentProductId: isWithoutPlan ? null : currentProductId,
      currentTier: isWithoutPlan ? null : currentTier,
      currentInterval: isWithoutPlan
        ? null
        : (currentVariantFromCatalog?.interval ?? currentVariantFromFallback?.interval ?? null),
      currentOverageMode: isWithoutPlan
        ? null
        : (currentVariantFromCatalog?.overageMode ??
          currentVariantFromFallback?.overageMode ??
          null),
      hasScheduledPlanChange,
      scheduledPlanChange,
      usage: {
        staticRequests: effectiveStaticUsage,
        dynamicRequests: effectiveDynamicUsage,
        storageBytes: effectiveStorageUsage,
      },
      storageMirrorBytes: ensuredStorage.encryptedBytes,
      variants,
    };
  },
});

export const changePlanForCurrentOrg = action({
  args: {
    expectedOrgSlug: v.string(),
    tier: v.union(v.literal("free"), v.literal("pro"), v.literal("max")),
    interval: v.union(v.literal("monthly"), v.literal("annually")),
    overageMode: v.union(v.literal("without_overages"), v.literal("with_overages")),
    successUrl: v.union(v.string(), v.null()),
  },
  returns: v.object({
    attachedProductId: v.string(),
    checkoutRequired: v.boolean(),
    checkoutUrl: v.union(v.string(), v.null()),
    changeOutcome: v.union(v.literal("applied"), v.literal("scheduled"), v.literal("submitted")),
    effectiveProductId: v.union(v.string(), v.null()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    attachedProductId: string;
    checkoutRequired: boolean;
    checkoutUrl: string | null;
    changeOutcome: "applied" | "scheduled" | "submitted";
    effectiveProductId: string | null;
  }> => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }
    if (!isBillingManagerRole(activeOrg.orgRole)) {
      throw new Error("Only organization admins can change billing plans.");
    }

    const variants = await resolvePricingVariants(ctx);
    const targetVariant = resolveVariant({
      variants,
      tier: args.tier,
      interval: args.interval,
      overageMode: args.overageMode,
    });
    const fallbackProductId = resolveProductId({
      tier: args.tier,
      interval: args.interval,
      overageMode: args.overageMode,
    });
    if (!targetVariant.isConfiguredInAutumn) {
      throw new Error(
        `This billing plan is not configured in Autumn yet (${fallbackProductId}). Configure pricing products first.`,
      );
    }
    const productId = targetVariant.productId;

    const customerResult = await ctx.runAction(api.autumn.createCustomer, {
      errorOnNotFound: false,
    });
    if (customerResult.error !== null) {
      throw new Error("Billing service is temporarily unavailable.");
    }
    const currentProductId = readCurrentProductId(customerResult.data);
    const currentVariant =
      variants.find((variant) => variant.productId === currentProductId) ??
      readCurrentVariantFromProductId(currentProductId);

    const existingOrgFreeCredit = await ctx.runQuery(
      internal.payments.getFreePlanCreditForOrgIdInternal,
      {
        orgId: activeOrg.orgId,
      },
    );

    let consumedFreeCreditReason: ConsumeFreePlanCreditResult["reason"] | null = null;
    if (args.tier === BillingTier.Free && existingOrgFreeCredit === null) {
      const consumeResult = await ctx.runMutation(
        internal.payments.consumeFreePlanCreditForCurrentOrgInternal,
        {
          clerkUserId: identity.subject,
          orgId: activeOrg.orgId,
          orgSlug: activeOrg.orgSlug,
        },
      );
      consumedFreeCreditReason = consumeResult.reason;
      if (!consumeResult.granted) {
        if (consumeResult.reason === "org_already_assigned") {
          throw new Error(
            "This organization is already using another member's free organization credit.",
          );
        }
        if (consumeResult.reason === "assigned_elsewhere") {
          throw new Error(
            "Your free workspace credit is already assigned to another workspace. Revoke it there before activating free here.",
          );
        }
        throw new Error(
          "Your free workspace credit is unavailable. Revoke an existing free assignment or choose a paid plan.",
        );
      }
    }

    // If the workspace is already on the Autumn free product, re-activating free
    // only needs to restore the credit assignment and should not start another attach flow.
    if (
      args.tier === BillingTier.Free &&
      currentProductId === productId &&
      currentVariant?.tier === BillingTier.Free
    ) {
      return {
        attachedProductId: productId,
        checkoutRequired: false,
        checkoutUrl: null,
        changeOutcome: "applied",
        effectiveProductId: currentProductId,
      };
    }

    const shouldForceCheckout =
      args.tier !== BillingTier.Free &&
      (currentVariant === null || currentVariant.tier === BillingTier.Free);

    let attachResult = await ctx.runAction(api.autumn.attach, {
      productId,
      forceCheckout: shouldForceCheckout,
      successUrl: args.successUrl ?? undefined,
    });
    if (
      (attachResult.error !== null || attachResult.data === null) &&
      shouldForceCheckout &&
      hasForceCheckoutUpgradeDowngradeError(attachResult.error)
    ) {
      attachResult = await ctx.runAction(api.autumn.attach, {
        productId,
        forceCheckout: false,
        successUrl: args.successUrl ?? undefined,
      });
    }
    if (attachResult.error !== null || attachResult.data === null) {
      if (args.tier === BillingTier.Free && consumedFreeCreditReason === "granted") {
        await ctx.runMutation(internal.payments.revokeFreePlanCreditByOrgIdInternal, {
          orgId: activeOrg.orgId,
          reason: "attach_failed",
        });
      }
      const attachFailureMessage =
        attachResult.error?.message ?? "Unable to start checkout for this billing change.";
      throw new Error(attachFailureMessage);
    }

    if (
      args.tier !== BillingTier.Free &&
      currentVariant !== null &&
      currentVariant.tier === BillingTier.Free
    ) {
      await ctx.runMutation(internal.payments.revokeFreePlanCreditByOrgIdInternal, {
        orgId: activeOrg.orgId,
        reason: "upgraded_to_paid",
      });
    }

    const checkoutUrl = attachResult.data.checkout_url ?? null;
    if (checkoutUrl !== null) {
      return {
        attachedProductId: productId,
        checkoutRequired: true,
        checkoutUrl,
        changeOutcome: "submitted",
        effectiveProductId: currentProductId,
      };
    }

    let effectiveProductId: string | null = currentProductId;
    let changeOutcome: "applied" | "scheduled" | "submitted" = "submitted";
    const customerAfterAttachResult = await ctx.runAction(api.autumn.createCustomer, {
      errorOnNotFound: false,
    });
    if (customerAfterAttachResult.error === null) {
      effectiveProductId = readCurrentProductId(customerAfterAttachResult.data);
      const allProducts = readCustomerProducts(customerAfterAttachResult.data);
      const targetStatus = allProducts.find((entry) => entry.id === productId)?.status ?? null;
      if (effectiveProductId === productId) {
        changeOutcome = "applied";
      } else if (targetStatus === "scheduled") {
        changeOutcome = "scheduled";
      }
    }

    return {
      attachedProductId: productId,
      checkoutRequired: false,
      checkoutUrl: null,
      changeOutcome,
      effectiveProductId,
    };
  },
});

export const revokeFreePlanCreditForCurrentOrg = action({
  args: {
    expectedOrgSlug: v.string(),
  },
  returns: v.object({
    revoked: v.boolean(),
  }),
  handler: async (ctx, args): Promise<{ revoked: boolean }> => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }
    if (!isBillingManagerRole(activeOrg.orgRole)) {
      throw new Error("Only organization admins can revoke free workspace credits.");
    }

    const revokeResult: { revoked: boolean; credit: FreePlanCreditState | null } =
      await ctx.runMutation(internal.payments.revokeFreePlanCreditByOrgIdInternal, {
        orgId: activeOrg.orgId,
        reason: "manual_revoke",
      });

    return {
      revoked: revokeResult.revoked,
    };
  },
});

export const revokeCurrentUserFreePlanCredit = action({
  args: {
    expectedAssignedOrgId: v.union(v.string(), v.null()),
    reason: v.union(v.string(), v.null()),
  },
  returns: v.object({
    revoked: v.boolean(),
    reason: v.union(v.literal("revoked"), v.literal("already_available"), v.literal("mismatch")),
    previousAssignedOrgId: v.union(v.string(), v.null()),
    previousAssignedOrgSlug: v.union(v.string(), v.null()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    revoked: boolean;
    reason: "revoked" | "already_available" | "mismatch";
    previousAssignedOrgId: string | null;
    previousAssignedOrgSlug: string | null;
  }> => {
    const identity = await requireIdentity(ctx);
    const currentCredit: FreePlanCreditState | null = await ctx.runQuery(
      internal.payments.getFreePlanCreditForClerkUserIdInternal,
      {
        clerkUserId: identity.subject,
      },
    );
    const previousAssignedOrgId = currentCredit?.assignedOrgId ?? null;
    const previousAssignedOrgSlug = currentCredit?.assignedOrgSlug ?? null;

    if (previousAssignedOrgId === null) {
      return {
        revoked: false,
        reason: "already_available" as const,
        previousAssignedOrgId,
        previousAssignedOrgSlug,
      };
    }

    if (
      args.expectedAssignedOrgId !== null &&
      previousAssignedOrgId !== args.expectedAssignedOrgId
    ) {
      return {
        revoked: false,
        reason: "mismatch" as const,
        previousAssignedOrgId,
        previousAssignedOrgSlug,
      };
    }

    const revokeResult: {
      revoked: boolean;
      reason: "revoked" | "already_available" | "not_assigned_to_org";
      credit: FreePlanCreditState;
    } = await ctx.runMutation(internal.payments.revokeFreePlanCreditForCurrentOrgInternal, {
      clerkUserId: identity.subject,
      orgId: previousAssignedOrgId,
      reason: args.reason ?? "manual_revoke",
    });

    return {
      revoked: revokeResult.revoked,
      reason:
        revokeResult.reason === "revoked"
          ? ("revoked" as const)
          : revokeResult.reason === "not_assigned_to_org"
            ? ("mismatch" as const)
            : ("already_available" as const),
      previousAssignedOrgId,
      previousAssignedOrgSlug,
    };
  },
});

export const openBillingPortalForCurrentOrg = action({
  args: {
    expectedOrgSlug: v.string(),
    returnUrl: v.union(v.string(), v.null()),
  },
  returns: v.object({
    portalUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }
    if (!isBillingManagerRole(activeOrg.orgRole)) {
      throw new Error("Only organization admins can manage billing settings.");
    }

    await ctx.runAction(api.autumn.createCustomer, {
      errorOnNotFound: false,
    });

    const portalResult = await ctx.runAction(api.autumn.billingPortal, {
      returnUrl: args.returnUrl ?? undefined,
    });
    if (portalResult.error !== null || portalResult.data === null) {
      throw new Error("Unable to open billing portal right now.");
    }

    const portalUrl = normalizeString(
      (portalResult.data as { url?: unknown; portal_url?: unknown }).url ??
        (portalResult.data as { url?: unknown; portal_url?: unknown }).portal_url,
    );
    if (portalUrl === null) {
      throw new Error("Billing portal response did not include a URL.");
    }

    return {
      portalUrl,
    };
  },
});
