import type {
  BillingIntervalValue,
  BillingTierValue,
  BillingVariant,
  OverageModeValue,
  ScheduledPlanChange,
} from "../lib/payments_catalog";
import type { FeatureUsage } from "../lib/payments_state";

export type BillingStateResponse = {
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

export type WorkspacePlanStatusResponse = {
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

export type ReserveFeatureUnitsResult = {
  reservedUnits: number;
  errorCode: "USAGE_LIMIT_EXCEEDED" | "BILLING_UNAVAILABLE" | null;
};
