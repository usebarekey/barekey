import { v } from "convex/values";

import { api, internal } from "./_generated/api";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
  type MutationCtx,
} from "./_generated/server";
import {
  assertExpectedOrgSlug,
  requireActiveOrgIdClaims,
  requireIdentity,
} from "./lib/auth";

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

const MB_BYTES = 1_000_000;
const GB_BYTES = 1_000_000_000;

type BillingTierValue = (typeof BillingTier)[keyof typeof BillingTier];
type BillingIntervalValue = (typeof BillingInterval)[keyof typeof BillingInterval];
type OverageModeValue = (typeof OverageMode)[keyof typeof OverageMode];

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
  usage: {
    staticRequests: FeatureUsage;
    dynamicRequests: FeatureUsage;
    storageBytes: FeatureUsage;
  };
  storageMirrorBytes: number;
  variants: Array<BillingVariant>;
};

function normalizeFiniteNumber(input: unknown): number | null {
  return typeof input === "number" && Number.isFinite(input) ? input : null;
}

function normalizeString(input: unknown): string | null {
  return typeof input === "string" && input.length > 0 ? input : null;
}

function isBillingManagerRole(role: string | null): boolean {
  return role === "org:admin" || role === "org:owner";
}

function readProductCatalog(
  products: Array<Record<string, unknown>>,
): Array<{
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
      const includedUsageRaw = item.included_usage;
      const includedUsage =
        typeof includedUsageRaw === "number" && Number.isFinite(includedUsageRaw)
          ? includedUsageRaw
          : null;

      if (monthlyPriceUsd === null && price !== null && featureId === null) {
        monthlyPriceUsd = price;
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

async function resolvePricingVariants(
  ctx: ActionCtx,
): Promise<Array<BillingVariant>> {
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
      includedStaticRequests:
        configured?.includedStaticRequests ?? fallback.includedStaticRequests,
      includedDynamicRequests:
        configured?.includedDynamicRequests ?? fallback.includedDynamicRequests,
      includedStorageBytes: configured?.includedStorageBytes ?? fallback.includedStorageBytes,
      staticOveragePer1kUsd:
        configured?.staticOveragePer1kUsd ?? fallback.staticOveragePer1kUsd,
      dynamicOveragePer1kUsd:
        configured?.dynamicOveragePer1kUsd ?? fallback.dynamicOveragePer1kUsd,
      storageOveragePerGbUsd:
        configured?.storageOveragePerGbUsd ?? fallback.storageOveragePerGbUsd,
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

function readCurrentProductId(customerData: unknown): string | null {
  if (typeof customerData !== "object" || customerData === null) {
    return null;
  }
  const products = (customerData as { products?: unknown }).products;
  if (!Array.isArray(products)) {
    return null;
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

  const active =
    normalized.find((entry) => entry.status === "active") ??
    normalized.find((entry) => entry.status === "trialing") ??
    normalized.find((entry) => entry.status === "past_due") ??
    normalized.find((entry) => entry.status === "scheduled");
  return active?.id ?? null;
}

async function readFeatureUsage(
  ctx: ActionCtx,
  featureId: string,
): Promise<FeatureUsage> {
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
      typeof result.data.overage_allowed === "boolean"
        ? result.data.overage_allowed
        : null,
    nextResetAtMs: normalizeFiniteNumber(result.data.next_reset_at),
  };
}

async function computeEncryptedBytesForOrg(
  ctx: MutationCtx,
  orgId: string,
): Promise<number> {
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
      total += new TextEncoder().encode(row.encryptedValue).length;
    }
  }
  return total;
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
    const row = await ctx.db
      .query("orgStorageUsage")
      .withIndex("by_org_id", (q) => q.eq("orgId", args.orgId))
      .unique();
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
    const existing = await ctx.db
      .query("orgStorageUsage")
      .withIndex("by_org_id", (q) => q.eq("orgId", args.orgId))
      .unique();
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
    let existing = await ctx.db
      .query("orgStorageUsage")
      .withIndex("by_org_id", (q) => q.eq("orgId", args.orgId))
      .unique();
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
        _creationTime: now,
        orgId: args.orgId,
        encryptedBytes,
        createdAtMs: now,
        updatedAtMs: now,
      };
    }
    if (existing === null) {
      throw new Error("Storage usage row missing after initialization.");
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

    await ctx.db.insert("billingRequestLog", {
      orgId: args.orgId,
      requestKey: args.requestKey,
      featureId: args.featureId,
      units: args.units,
      createdAtMs: Date.now(),
    });
    return { inserted: true };
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
  }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    if (!Number.isFinite(args.units) || args.units <= 0) {
      return {
        reservedUnits: 0,
      };
    }

    const result = await ctx.runAction(api.autumn.check, {
      featureId: args.featureId,
      requiredBalance: args.units,
      sendEvent: true,
    });

    if (result.error !== null || result.data === null) {
      throw new Error("Billing service is temporarily unavailable.");
    }
    if (!result.data.allowed) {
      throw new Error("Usage limit exceeded for this workspace plan.");
    }

    return {
      reservedUnits: args.units,
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
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }

    if (!Number.isFinite(args.units) || args.units <= 0) {
      return {
        compensatedUnits: 0,
      };
    }

    const result = await ctx.runAction(api.autumn.track, {
      featureId: args.featureId,
      value: -Math.abs(args.units),
    });

    if (result.error !== null) {
      throw new Error("Failed to roll back metered usage.");
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

    const currentProductId = readCurrentProductId(customerResult.data);
    const currentVariant: BillingVariant | null =
      variants.find((variant) => variant.productId === currentProductId) ?? null;

    return {
      orgId: activeOrg.orgId,
      orgRole: activeOrg.orgRole,
      canManageBilling: isBillingManagerRole(activeOrg.orgRole),
      currentProductId,
      currentTier: currentVariant?.tier ?? null,
      currentInterval: currentVariant?.interval ?? null,
      currentOverageMode: currentVariant?.overageMode ?? null,
      usage: {
        staticRequests: staticUsage,
        dynamicRequests: dynamicUsage,
        storageBytes: storageUsage,
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
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    attachedProductId: string;
    checkoutRequired: boolean;
    checkoutUrl: string | null;
  }> => {
    const identity = await requireIdentity(ctx);
    const activeOrg = requireActiveOrgIdClaims(identity);
    if (activeOrg.orgSlug !== null) {
      assertExpectedOrgSlug(activeOrg, args.expectedOrgSlug);
    }
    if (!isBillingManagerRole(activeOrg.orgRole)) {
      throw new Error("Only organization admins can change billing plans.");
    }

    const productId = resolveProductId({
      tier: args.tier,
      interval: args.interval,
      overageMode: args.overageMode,
    });

    await ctx.runAction(api.autumn.createCustomer, {
      errorOnNotFound: false,
    });

    const attachResult = await ctx.runAction(api.autumn.attach, {
      productId,
      forceCheckout: args.tier !== BillingTier.Free,
      successUrl: args.successUrl ?? undefined,
    });
    if (attachResult.error !== null || attachResult.data === null) {
      throw new Error("Unable to start checkout for this billing change.");
    }

    return {
      attachedProductId: productId,
      checkoutRequired: Boolean(attachResult.data.checkout_url),
      checkoutUrl: attachResult.data.checkout_url ?? null,
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
