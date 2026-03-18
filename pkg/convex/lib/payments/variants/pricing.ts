import { api } from "../../../_generated/api";
import type { ActionCtx } from "../../../_generated/server";
import { throwValidationError } from "../../errors/effect";
import {
  DEFAULT_VARIANTS,
  type BillingIntervalValue,
  type BillingTierValue,
  type BillingVariant,
  type DefaultVariant,
  type OverageModeValue,
} from "../catalog";
import {
  normalizeFiniteNumber,
  normalizeRecurringPriceToMonthly,
  normalizeString,
  type CurrentVariantSelection,
} from "./shared";

const GB_BYTES = 1_000_000_000;

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

/**
 * Reads the normalized product catalog from raw Autumn product payloads.
 *
 * @param products The raw Autumn product list.
 * @returns The normalized catalog entries.
 * @remarks This decodes recurring product price items and usage items into one UI-facing record per product.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
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

/**
 * Resolves the pricing variants shown in billing UI from Autumn product data.
 *
 * @param ctx The Convex action context.
 * @returns The billing variants with any live Autumn pricing overlaid on defaults.
 * @remarks This falls back to the baked-in variant defaults when Autumn does not return matching products.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function resolvePricingVariants(ctx: ActionCtx): Promise<Array<BillingVariant>> {
  const runAction = ctx.runAction as (
    functionReference: unknown,
    args: Record<string, unknown>,
  ) => Promise<unknown>;
  // @ts-ignore TypeScript exhausts itself expanding this generated Convex reference.
  const autumnApi = api as any;
  const listProductsReference = autumnApi.autumn.listProducts as unknown;
  const autumnProductsResult = (await runAction(listProductsReference, {})) as {
    error: unknown;
    data: unknown;
  };
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

/**
 * Resolves the configured product id for a tier/interval/overage selection.
 *
 * @param input The desired billing variant dimensions.
 * @returns The matching Autumn product id.
 * @remarks This throws when the requested combination is not present in the default variant matrix.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
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
    return throwValidationError("Unable to resolve the requested billing plan.");
  }
  return match.productId;
}

/**
 * Resolves the matching billing variant from a variant list.
 *
 * @param input The variant list and desired selection dimensions.
 * @returns The matching billing variant.
 * @remarks This throws when no variant matches the requested selection.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
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
    return throwValidationError("Unable to resolve the requested billing plan.");
  }
  return match;
}

/**
 * Reads the billing-variant dimensions implied by a product id.
 *
 * @param input The Autumn product id.
 * @returns The fallback variant dimensions, or `null`.
 * @remarks This uses the baked-in default variant matrix because Autumn product metadata is not yet normalized for this.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function readCurrentVariantFromProductId(
  input: string | null,
): CurrentVariantSelection | null {
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

/**
 * Reads the baked-in default variant for a product id.
 *
 * @param input The Autumn product id.
 * @returns The default variant, or `null`.
 * @remarks This is used as a stable fallback when Autumn data is unavailable or incomplete.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function readDefaultVariantByProductId(input: string | null): DefaultVariant | null {
  if (input === null) {
    return null;
  }
  return DEFAULT_VARIANTS.find((variant) => variant.productId === input) ?? null;
}
