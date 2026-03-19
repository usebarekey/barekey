export const GB_BYTES = 1_000_000_000;

export type ProductCatalogEntry = {
  id: string;
  monthlyPriceUsd: number | null;
  includedStaticRequests: number | null;
  includedDynamicRequests: number | null;
  includedStorageBytes: number | null;
  staticOveragePer1kUsd: number | null;
  dynamicOveragePer1kUsd: number | null;
  storageOveragePerGbUsd: number | null;
};
