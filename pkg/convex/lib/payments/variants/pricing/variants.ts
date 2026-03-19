import { api } from "../../../../_generated/api";
import type { ActionCtx } from "../../../../_generated/server";
import {
  DEFAULT_VARIANTS,
  type BillingVariant,
} from "../../catalog";
import { decodeAutumnProductList } from "../schema";
import { readProductCatalog } from "./catalog";

/**
 * Resolves the pricing variants shown in billing UI from Autumn product data.
 *
 * @param convexCtx The Convex action context.
 * @returns The billing variants with any live Autumn pricing overlaid on defaults.
 * @remarks This falls back to the baked-in variant defaults when Autumn does not return matching products.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export async function resolvePricingVariants(convexCtx: ActionCtx): Promise<Array<BillingVariant>> {
  const runAction = convexCtx.runAction as (
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
    autumnProductsResult.error === null ? decodeAutumnProductList(autumnProductsResult.data) : [];

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
