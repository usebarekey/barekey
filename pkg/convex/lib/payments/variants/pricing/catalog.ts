import { normalizeRecurringPriceToMonthly } from "../shared";
import type { AutumnProduct } from "../schema";
import { GB_BYTES, type ProductCatalogEntry } from "./types";

/**
 * Reads the normalized product catalog from raw Autumn product payloads.
 *
 * @param products The raw Autumn product list.
 * @returns The normalized catalog entries.
 * @remarks This decodes recurring product price items and usage items into one UI-facing record per product.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function readProductCatalog(
  products: ReadonlyArray<AutumnProduct>,
): Array<ProductCatalogEntry> {
  return products.map((product) => {
    const id = product.id ?? "";
    const items = product.items ?? [];

    let monthlyPriceUsd: number | null = null;
    let includedStaticRequests: number | null = null;
    let includedDynamicRequests: number | null = null;
    let includedStorageBytes: number | null = null;
    let staticOveragePer1kUsd: number | null = null;
    let dynamicOveragePer1kUsd: number | null = null;
    let storageOveragePerGbUsd: number | null = null;

    for (const item of items) {
      const price = item.price ?? null;
      const billingUnits = item.billing_units ?? 1;
      const featureId = item.feature_id ?? null;
      const interval = item.interval ?? null;
      const intervalCount = item.interval_count ?? null;
      const includedUsage = item.included_usage ?? null;

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
