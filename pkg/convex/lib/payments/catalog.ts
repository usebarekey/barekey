import { v } from "convex/values";

export const BillingTier = {
  Free: "free",
  Pro: "pro",
  Max: "max",
} as const;

export const BillingInterval = {
  Monthly: "monthly",
  Annually: "annually",
} as const;

export const OverageMode = {
  WithoutOverages: "without_overages",
  WithOverages: "with_overages",
} as const;

export const FeatureId = {
  StaticRequests: "static_requests",
  DynamicRequests: "dynamic_requests",
  StorageBytes: "storage_bytes",
} as const;

export const PLANLESS_WORKSPACE_ERROR_MESSAGE =
  "This workspace is without a plan. Choose a billing plan to enable projects.";
export const BILLING_UNAVAILABLE_ERROR_MESSAGE = "Billing service is temporarily unavailable.";
export const METERED_USAGE_ROLLBACK_ERROR_MESSAGE = "Failed to roll back metered usage.";

const MB_BYTES = 1_000_000;
const GB_BYTES = 1_000_000_000;

export type BillingTierValue = (typeof BillingTier)[keyof typeof BillingTier];
export type BillingIntervalValue = (typeof BillingInterval)[keyof typeof BillingInterval];
export type OverageModeValue = (typeof OverageMode)[keyof typeof OverageMode];

export type DefaultVariant = {
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

export const DEFAULT_VARIANTS: Array<DefaultVariant> = [
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

export const billingVariantValidator = v.object({
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

export const scheduledPlanChangeValidator = v.object({
  productId: v.string(),
  tier: v.union(v.literal("free"), v.literal("pro"), v.literal("max")),
  interval: v.union(v.literal("monthly"), v.literal("annually")),
  overageMode: v.union(v.literal("without_overages"), v.literal("with_overages")),
  monthlyPriceUsd: v.number(),
});

export type BillingVariant = {
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

export type ScheduledPlanChange = {
  productId: string;
  tier: BillingTierValue;
  interval: BillingIntervalValue;
  overageMode: OverageModeValue;
  monthlyPriceUsd: number;
};
