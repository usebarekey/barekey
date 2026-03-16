import { Autumn } from "autumn-js";

import { api, internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import {
  BILLING_UNAVAILABLE_ERROR_MESSAGE,
  BillingTier,
  DEFAULT_VARIANTS,
  PLANLESS_WORKSPACE_ERROR_MESSAGE,
  type BillingIntervalValue,
  type BillingTierValue,
  type BillingVariant,
  type DefaultVariant,
  type OverageModeValue,
} from "./payments_catalog";
import { runtimeConfig } from "./runtime_config";

const GB_BYTES = 1_000_000_000;

type CustomerProduct = {
  id: string;
  status: string;
};

type ProductCatalogEntry = {
  id: string;
  monthlyPriceUsd: number | null;
  includedStaticRequests: number | null;
  includedDynamicRequests: number | null;
  includedStorageBytes: number | null;
  staticOveragePer1kUsd: number | null;
  dynamicOveragePer1kUsd: number | null;
  storageOveragePerGbUsd: number | null;
};

export type WorkspacePlanState = {
  currentProductId: string;
  currentTier: BillingTierValue | null;
};

export function createAutumnClient(): Autumn {
  return new Autumn({
    secretKey: runtimeConfig.autumnSecretKey,
  });
}

export function normalizeFiniteNumber(input: unknown): number | null {
  return typeof input === "number" && Number.isFinite(input) ? input : null;
}

export function normalizeString(input: unknown): string | null {
  return typeof input === "string" && input.length > 0 ? input : null;
}

export function hasForceCheckoutUpgradeDowngradeError(error: unknown): boolean {
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

export function isBillingManagerRole(role: string | null): boolean {
  return role === "org:admin" || role === "org:owner";
}

function readProductCatalog(products: Array<Record<string, unknown>>): Array<ProductCatalogEntry> {
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

      if (featureId === "static_requests") {
        if (includedUsage !== null) {
          includedStaticRequests = includedUsage;
        }
        if (price !== null && billingUnits > 0) {
          staticOveragePer1kUsd = (price / billingUnits) * 1000;
        }
      }
      if (featureId === "dynamic_requests") {
        if (includedUsage !== null) {
          includedDynamicRequests = includedUsage;
        }
        if (price !== null && billingUnits > 0) {
          dynamicOveragePer1kUsd = (price / billingUnits) * 1000;
        }
      }
      if (featureId === "storage_bytes") {
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

export async function resolvePricingVariants(ctx: ActionCtx): Promise<Array<BillingVariant>> {
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
      dynamicOveragePer1kUsd:
        configured?.dynamicOveragePer1kUsd ?? fallback.dynamicOveragePer1kUsd,
      storageOveragePerGbUsd:
        configured?.storageOveragePerGbUsd ?? fallback.storageOveragePerGbUsd,
      isConfiguredInAutumn: configured !== undefined,
    };
  });
}

export function resolveProductId(input: {
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

export function resolveVariant(input: {
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

export function readCurrentProductId(customerData: unknown): string | null {
  const normalized = readCustomerProducts(customerData);
  const active =
    normalized.find((entry) => entry.status === "active") ??
    normalized.find((entry) => entry.status === "trialing") ??
    normalized.find((entry) => entry.status === "past_due") ??
    normalized.find((entry) => entry.status === "scheduled");
  return active?.id ?? null;
}

export function readCustomerProducts(customerData: unknown): Array<CustomerProduct> {
  if (typeof customerData !== "object" || customerData === null) {
    return [];
  }
  const products = (customerData as { products?: unknown }).products;
  if (!Array.isArray(products)) {
    return [];
  }

  return products
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
    .filter((value): value is CustomerProduct => value !== null);
}

export function readCurrentVariantFromProductId(input: string | null): {
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

export async function readWorkspacePlanStateForOrg(
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

export function readDefaultVariantByProductId(input: string | null): DefaultVariant | null {
  if (input === null) {
    return null;
  }
  return DEFAULT_VARIANTS.find((variant) => variant.productId === input) ?? null;
}
