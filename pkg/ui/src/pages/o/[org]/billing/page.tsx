import { useAction, useQuery } from "convex/react";
import {
  IconBolt,
  IconCreditCard,
  IconCheck,
  IconClock,
  IconCpu,
  IconDatabase,
  IconMail,
  IconUsers,
} from "@tabler/icons-react";
import { useOrganization } from "@clerk/react-router";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";

import { api } from "@convex/_generated/api";
import {
  OrgMetricCard,
  OrgPageHero,
  OrgRoleBadge,
  OrgSectionCard,
} from "@/components/custom/org-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonPlaceholder } from "@/components/ui/skeleton-placeholder";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  formatOverageHint,
  formatRequestCount,
  formatStorageBytes,
  formatUsageProgress,
} from "@/lib/billing-display";
import { extractRequestId, formatSupportErrorMessage } from "@/lib/support-errors";

type PlanId = "free" | "pro" | "max";
type BillingInterval = "monthly" | "annually";
type OverageMode = "without_overages" | "with_overages";

type BillingVariant = {
  productId: string;
  tier: PlanId;
  interval: BillingInterval;
  overageMode: OverageMode;
  monthlyPriceUsd: number;
  includedStaticRequests: number;
  includedDynamicRequests: number;
  includedStorageBytes: number;
  staticOveragePer1kUsd: number | null;
  dynamicOveragePer1kUsd: number | null;
  storageOveragePerGbUsd: number | null;
  isConfiguredInAutumn: boolean;
};

type BillingState = {
  orgId: string;
  orgRole: string | null;
  canManageBilling: boolean;
  currentProductId: string | null;
  currentTier: PlanId | null;
  currentInterval: BillingInterval | null;
  currentOverageMode: OverageMode | null;
  hasScheduledPlanChange: boolean;
  scheduledPlanChange: {
    productId: string;
    tier: PlanId;
    interval: BillingInterval;
    overageMode: OverageMode;
    monthlyPriceUsd: number;
  } | null;
  usage: {
    staticRequests: {
      usage: number | null;
      includedUsage: number | null;
      overageAllowed: boolean | null;
    };
    dynamicRequests: {
      usage: number | null;
      includedUsage: number | null;
      overageAllowed: boolean | null;
    };
    storageBytes: {
      usage: number | null;
      includedUsage: number | null;
      overageAllowed: boolean | null;
    };
  };
  storageMirrorBytes: number;
  variants: Array<BillingVariant>;
};

type PlanDisplayMetadata = {
  id: PlanId;
  name: string;
  description: string;
  includes: string | null;
  support: Array<string>;
  fallbackMonthlyPriceUsd: number;
  fallbackStaticRequests: number;
  fallbackDynamicRequests: number;
  fallbackStorageBytes: number;
  fallbackStaticOveragePer1kUsd: number | null;
  fallbackDynamicOveragePer1kUsd: number | null;
  fallbackStorageOveragePerGbUsd: number | null;
};

type UpgradeOverlayState = {
  title: string;
  description: string;
  isSuccess: boolean;
};

const PLAN_METADATA: Array<PlanDisplayMetadata> = [
  {
    id: "free",
    name: "Free",
    description: "Best for personal projects and early experimentation.",
    includes: null,
    support: ["Community support"],
    fallbackMonthlyPriceUsd: 0,
    fallbackStaticRequests: 10_000,
    fallbackDynamicRequests: 500,
    fallbackStorageBytes: 25_000_000,
    fallbackStaticOveragePer1kUsd: null,
    fallbackDynamicOveragePer1kUsd: null,
    fallbackStorageOveragePerGbUsd: null,
  },
  {
    id: "pro",
    name: "Pro",
    description: "For growing teams that need more scale and support.",
    includes: "Everything in Free, plus:",
    support: ["Email support"],
    fallbackMonthlyPriceUsd: 9.99,
    fallbackStaticRequests: 1_000_000,
    fallbackDynamicRequests: 100_000,
    fallbackStorageBytes: 500_000_000,
    fallbackStaticOveragePer1kUsd: 0.0053,
    fallbackDynamicOveragePer1kUsd: 0.0265,
    fallbackStorageOveragePerGbUsd: null,
  },
  {
    id: "max",
    name: "Max",
    description: "Highest limits for production-heavy workloads.",
    includes: "Everything in Free and Pro, plus:",
    support: ["Priority support", "Audit export / advanced logs"],
    fallbackMonthlyPriceUsd: 39.99,
    fallbackStaticRequests: 10_000_000,
    fallbackDynamicRequests: 1_000_000,
    fallbackStorageBytes: 5_000_000_000,
    fallbackStaticOveragePer1kUsd: 0.0026,
    fallbackDynamicOveragePer1kUsd: 0.013,
    fallbackStorageOveragePerGbUsd: null,
  },
];

const ALWAYS_INCLUDED_FEATURES = [
  "Unlimited projects",
  "Unlimited secrets",
  "Performance insights",
  "Analytics",
  "Instant, advanced AI support",
] as const;

function formatUsd(amount: number): string {
  return amount % 1 === 0 ? `$${amount}` : `$${amount.toFixed(2)}`;
}

function formatUsdPerThousand(amount: number): string {
  if (amount >= 1) {
    return amount % 1 === 0 ? `$${amount}` : `$${amount.toFixed(2)}`;
  }
  const fixed = amount.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return `$${fixed}`;
}

function formatUsdPerGb(amount: number): string {
  if (amount >= 1) {
    return formatUsd(amount);
  }
  const fixed = amount.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return `$${fixed}`;
}

function formatTierName(tier: PlanId): string {
  return PLAN_METADATA.find((plan) => plan.id === tier)?.name ?? tier;
}

function formatPlanSummary(
  tier: PlanId,
  interval: BillingInterval,
  overageMode: OverageMode,
  monthlyPriceUsd: number,
): string {
  const overageLabel = overageMode === "with_overages" ? "with overages" : "without overages";
  if (interval === "annually") {
    const annual = monthlyPriceUsd * 12;
    return `${formatTierName(tier)} annually (${overageLabel}) at ${formatUsd(monthlyPriceUsd)}/month equivalent (about ${formatUsd(annual)}/year billed)`;
  }
  return `${formatTierName(tier)} monthly (${overageLabel}) at ${formatUsd(monthlyPriceUsd)}/month`;
}

function formatPriceDeltaSentence(
  currentMonthlyPriceUsd: number,
  nextMonthlyPriceUsd: number,
): string {
  const monthlyDelta = nextMonthlyPriceUsd - currentMonthlyPriceUsd;
  if (monthlyDelta === 0) {
    return "with no monthly price change.";
  }
  const direction = monthlyDelta > 0 ? "increase" : "decrease";
  const monthlyAmount = Math.abs(monthlyDelta);
  const annualAmount = monthlyAmount * 12;
  return `with a ${direction} of ${formatUsd(monthlyAmount)}/month equivalent (about ${formatUsd(annualAmount)}/year).`;
}

function getPlanChangeErrorMessage(error: unknown): string {
  if (!(error instanceof Error) || error.message.trim().length === 0) {
    return formatSupportErrorMessage(
      "An error occurred while updating the billing plan.",
      extractRequestId(error),
    );
  }

  const message = error.message.trim();
  const normalized = message.toLowerCase();
  if (
    normalized.includes("free workspace credit is already assigned to another workspace") ||
    normalized.includes("free workspace credit is unavailable") ||
    normalized.includes("already using another member")
  ) {
    return message;
  }

  return formatSupportErrorMessage(
    "An error occurred while updating the billing plan.",
    extractRequestId(error),
  );
}

function formatScheduledPlanChangeNotice(input: {
  currentTier: PlanId;
  currentInterval: BillingInterval;
  currentOverageMode: OverageMode;
  currentMonthlyPriceUsd: number;
  scheduledPlanChange: NonNullable<BillingState["scheduledPlanChange"]>;
}): string {
  const currentSummary = formatPlanSummary(
    input.currentTier,
    input.currentInterval,
    input.currentOverageMode,
    input.currentMonthlyPriceUsd,
  );
  const scheduledSummary = formatPlanSummary(
    input.scheduledPlanChange.tier,
    input.scheduledPlanChange.interval,
    input.scheduledPlanChange.overageMode,
    input.scheduledPlanChange.monthlyPriceUsd,
  );
  const delta = formatPriceDeltaSentence(
    input.currentMonthlyPriceUsd,
    input.scheduledPlanChange.monthlyPriceUsd,
  );
  return `A plan change is set to execute soon, your workspace is currently on ${currentSummary}, and it will move to ${scheduledSummary}, ${delta}`;
}

export function Page() {
  const { orgSlug = "org" } = useParams();
  const orgClaims = useQuery(api.orgs.getCurrentOrgClaims, {
    expectedOrgSlug: orgSlug,
  });
  const currentUserFreePlanCredit = useQuery(api.users.getCurrentUserFreePlanCredit, {});
  const { organization } = useOrganization();
  const getBillingState = useAction(api.payments.getBillingStateForCurrentOrg);
  const changePlan = useAction(api.payments.changePlanForCurrentOrg);
  const revokeFreePlanCredit = useAction(api.payments.revokeFreePlanCreditForCurrentOrg);
  const openBillingPortal = useAction(api.payments.openBillingPortalForCurrentOrg);

  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [overageMode, setOverageMode] = useState<OverageMode>("without_overages");
  const [billingState, setBillingState] = useState<BillingState | null>(null);
  const [isBillingStateLoading, setIsBillingStateLoading] = useState(true);
  const [billingStateLoadError, setBillingStateLoadError] = useState<string | null>(null);
  const [isPlanSubmitting, setIsPlanSubmitting] = useState(false);
  const [isPortalSubmitting, setIsPortalSubmitting] = useState(false);
  const [isRevokeSubmitting, setIsRevokeSubmitting] = useState(false);
  const [pendingPlanId, setPendingPlanId] = useState<PlanId | null>(null);
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false);
  const [upgradeDialogPlanId, setUpgradeDialogPlanId] = useState<PlanId | null>(null);
  const [upgradeOverlay, setUpgradeOverlay] = useState<UpgradeOverlayState | null>(null);

  const isOrgClaimsLoading = orgClaims === undefined;

  useEffect(() => {
    const orgLabel = organization?.name?.trim() || orgSlug;
    document.title = `${orgLabel} · Billing`;
  }, [organization?.name, orgSlug]);

  useEffect(() => {
    let cancelled = false;
    setIsBillingStateLoading(true);
    setBillingStateLoadError(null);

    void getBillingState({
      expectedOrgSlug: orgSlug,
    })
      .then((result) => {
        if (cancelled) {
          return;
        }
        setBillingState(result as BillingState);
        setBillingStateLoadError(null);
        if (result.currentInterval) {
          setBillingInterval(result.currentInterval);
        }
        if (result.currentOverageMode) {
          setOverageMode(result.currentOverageMode);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setBillingState(null);
          setBillingStateLoadError(
            formatSupportErrorMessage(
              "Unable to load billing details right now.",
              extractRequestId(error),
            ),
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsBillingStateLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [getBillingState, orgSlug]);

  const currentPlanId: PlanId | null = billingState?.currentTier ?? null;
  const isWithoutPlan = billingState?.currentTier === null;
  const showBillingSkeleton = isBillingStateLoading;
  const isBillingUnavailable = !isBillingStateLoading && billingState === null;
  const isFreeCreditLoading = currentUserFreePlanCredit === undefined;
  const isFreeCreditAssignedToDifferentOrg =
    currentUserFreePlanCredit !== undefined &&
    billingState !== null &&
    currentUserFreePlanCredit.assignedOrgId !== null &&
    currentUserFreePlanCredit.assignedOrgId !== billingState.orgId;
  const isFreeCreditExhaustedWithoutAssignment =
    currentUserFreePlanCredit !== undefined &&
    currentUserFreePlanCredit.assignedOrgId === null &&
    currentUserFreePlanCredit.remainingCredits <= 0;
  const isFreePlanActivationBlocked =
    isFreeCreditLoading ||
    isFreeCreditAssignedToDifferentOrg ||
    isFreeCreditExhaustedWithoutAssignment;
  const currentPlanIndex =
    currentPlanId === null ? -1 : PLAN_METADATA.findIndex((tier) => tier.id === currentPlanId);

  const planTiers = useMemo(() => {
    return PLAN_METADATA.map((plan) => {
      const selectedVariant =
        billingState?.variants.find(
          (variant) =>
            variant.tier === plan.id &&
            variant.interval === (plan.id === "free" ? "monthly" : billingInterval) &&
            variant.overageMode === (plan.id === "free" ? "without_overages" : overageMode),
        ) ?? null;

      return {
        ...plan,
        isConfiguredInAutumn: selectedVariant?.isConfiguredInAutumn ?? false,
        monthlyPriceUsd: selectedVariant?.monthlyPriceUsd ?? plan.fallbackMonthlyPriceUsd,
        usage: {
          staticRequests: `${formatRequestCount(
            selectedVariant?.includedStaticRequests ?? plan.fallbackStaticRequests,
          )} static requests`,
          dynamicRequests: `${formatRequestCount(
            selectedVariant?.includedDynamicRequests ?? plan.fallbackDynamicRequests,
          )} dynamic requests`,
          storage: `${formatStorageBytes(
            selectedVariant?.includedStorageBytes ?? plan.fallbackStorageBytes,
          )} storage`,
        },
        overage: {
          staticPer1kUsd:
            selectedVariant?.staticOveragePer1kUsd ?? plan.fallbackStaticOveragePer1kUsd,
          dynamicPer1kUsd:
            selectedVariant?.dynamicOveragePer1kUsd ?? plan.fallbackDynamicOveragePer1kUsd,
          storagePerGbUsd:
            selectedVariant?.storageOveragePerGbUsd ?? plan.fallbackStorageOveragePerGbUsd,
        },
      };
    });
  }, [billingInterval, billingState?.variants, overageMode]);

  const currentPlanMonthlyPriceUsd = useMemo(() => {
    if (
      !billingState ||
      billingState.currentTier === null ||
      billingState.currentInterval === null
    ) {
      return null;
    }
    const fromVariant =
      billingState.variants.find(
        (variant) =>
          variant.tier === billingState.currentTier &&
          variant.interval === billingState.currentInterval &&
          variant.overageMode === (billingState.currentOverageMode ?? "without_overages"),
      )?.monthlyPriceUsd ?? null;
    if (fromVariant !== null) {
      return fromVariant;
    }
    return (
      PLAN_METADATA.find((plan) => plan.id === billingState.currentTier)?.fallbackMonthlyPriceUsd ??
      null
    );
  }, [
    billingState,
    billingState?.currentInterval,
    billingState?.currentOverageMode,
    billingState?.currentTier,
    billingState?.variants,
  ]);

  const upgradeDialogPlanMetadata = useMemo(() => {
    if (upgradeDialogPlanId === null) {
      return null;
    }
    return planTiers.find((plan) => plan.id === upgradeDialogPlanId) ?? null;
  }, [planTiers, upgradeDialogPlanId]);

  const nextBillingInterval = billingInterval;
  const nextOverageMode = overageMode;

  async function refreshBillingState(): Promise<void> {
    const refreshed = await getBillingState({
      expectedOrgSlug: orgSlug,
    });
    setBillingState(refreshed as BillingState);
    setBillingStateLoadError(null);
  }

  async function handleRetryBillingStateLoad(): Promise<void> {
    setIsBillingStateLoading(true);
    setBillingStateLoadError(null);
    try {
      await refreshBillingState();
    } catch (error: unknown) {
      setBillingState(null);
      setBillingStateLoadError(
        formatSupportErrorMessage(
          "Unable to load billing details right now.",
          extractRequestId(error),
        ),
      );
    } finally {
      setIsBillingStateLoading(false);
    }
  }

  function isNoopPlanSelection(nextPlanId: PlanId): boolean {
    if (!billingState) {
      return false;
    }
    const nextInterval = nextPlanId === "free" ? "monthly" : nextBillingInterval;
    const nextOverages = nextPlanId === "free" ? "without_overages" : nextOverageMode;
    return (
      currentPlanId === nextPlanId &&
      billingState.currentInterval === nextInterval &&
      billingState.currentOverageMode === nextOverages
    );
  }

  function isUpgradeLikeChange(nextPlanId: PlanId): boolean {
    if (!billingState || nextPlanId === "free") {
      return false;
    }

    if (currentPlanId === null || currentPlanId === "free") {
      return true;
    }

    if (currentPlanId !== nextPlanId) {
      const nextIndex = PLAN_METADATA.findIndex((tier) => tier.id === nextPlanId);
      return nextIndex > currentPlanIndex;
    }

    const currentInterval = billingState.currentInterval ?? "monthly";
    const currentOverage = billingState.currentOverageMode ?? "without_overages";
    if (currentInterval !== nextBillingInterval && nextBillingInterval === "annually") {
      return true;
    }
    if (currentOverage !== nextOverageMode && nextOverageMode === "with_overages") {
      return true;
    }
    return false;
  }

  function requiresPaidPlanChangeConfirmation(nextPlanId: PlanId): boolean {
    if (!billingState || isNoopPlanSelection(nextPlanId)) {
      return false;
    }
    const isCurrentPaid = currentPlanId === "pro" || currentPlanId === "max";
    const isNextPaid = nextPlanId === "pro" || nextPlanId === "max";
    return isCurrentPaid || isNextPaid;
  }

  function handlePlanButtonClick(nextPlanId: PlanId): void {
    if (isPlanSubmitting) {
      return;
    }
    if (requiresPaidPlanChangeConfirmation(nextPlanId)) {
      setUpgradeDialogPlanId(nextPlanId);
      setIsUpgradeDialogOpen(true);
      return;
    }
    void handleChangePlan(nextPlanId, {
      showUpgradeOverlay: false,
    });
  }

  async function handleChangePlan(
    nextPlanId: PlanId,
    options: { showUpgradeOverlay: boolean },
  ): Promise<void> {
    if (!billingState || !billingState.canManageBilling || isPlanSubmitting) {
      return;
    }

    setIsPlanSubmitting(true);
    setPendingPlanId(nextPlanId);
    const isUpgrade = isUpgradeLikeChange(nextPlanId);
    if (options.showUpgradeOverlay) {
      setUpgradeOverlay({
        title: isUpgrade ? "Applying upgrade..." : "Applying billing change...",
        description: "Please wait while we update your billing plan.",
        isSuccess: false,
      });
    }
    let didTriggerNavigation = false;

    try {
      const result = await changePlan({
        expectedOrgSlug: orgSlug,
        tier: nextPlanId,
        interval: nextPlanId === "free" ? "monthly" : nextBillingInterval,
        overageMode: nextPlanId === "free" ? "without_overages" : nextOverageMode,
        successUrl: window.location.href,
      });

      if (result.checkoutRequired && result.checkoutUrl) {
        if (options.showUpgradeOverlay) {
          setUpgradeOverlay({
            title: "Redirecting to secure checkout...",
            description: "A checkout confirmation is required to complete this billing change.",
            isSuccess: false,
          });
        }
        didTriggerNavigation = true;
        window.location.assign(result.checkoutUrl);
        return;
      }

      const didApplyImmediately = result.changeOutcome === "applied";
      const wasScheduled = result.changeOutcome === "scheduled";

      try {
        await refreshBillingState();
      } catch (refreshError: unknown) {
        toast.error(
          formatSupportErrorMessage(
            "Plan updated, but billing details could not be refreshed.",
            extractRequestId(refreshError),
          ),
        );
      }

      if (options.showUpgradeOverlay) {
        if (didApplyImmediately) {
          setUpgradeOverlay({
            title: isUpgrade ? "Upgrade successful" : "Plan update successful",
            description: "Your billing plan has been updated successfully.",
            isSuccess: true,
          });
          return;
        }

        setUpgradeOverlay({
          title: wasScheduled ? "Plan change scheduled" : "Plan change submitted",
          description: wasScheduled
            ? "This change is scheduled for the next billing cycle. Your current plan remains active until then."
            : "Your billing provider accepted the change, but it has not applied yet. Refresh billing in a moment.",
          isSuccess: true,
        });
        return;
      }

      if (didApplyImmediately) {
        toast.success(`Updated plan to ${nextPlanId}.`);
      } else if (wasScheduled) {
        toast.info("Plan change scheduled for the next billing cycle.");
      } else {
        toast.info("Plan change submitted. Refresh billing in a moment to confirm.");
      }
    } catch (error: unknown) {
      if (options.showUpgradeOverlay) {
        setUpgradeOverlay(null);
      }
      toast.error(getPlanChangeErrorMessage(error));
    } finally {
      if (!didTriggerNavigation && !options.showUpgradeOverlay) {
        setUpgradeOverlay(null);
      }
      setPendingPlanId(null);
      setIsPlanSubmitting(false);
    }
  }

  async function handleConfirmUpgradeChange(): Promise<void> {
    if (upgradeDialogPlanId === null) {
      return;
    }
    setIsUpgradeDialogOpen(false);
    await handleChangePlan(upgradeDialogPlanId, {
      showUpgradeOverlay: true,
    });
  }

  async function handleOpenBillingPortal(): Promise<void> {
    if (
      !billingState ||
      !billingState.canManageBilling ||
      isPortalSubmitting ||
      isPlanSubmitting ||
      upgradeOverlay !== null
    ) {
      return;
    }

    setIsPortalSubmitting(true);
    try {
      const result = await openBillingPortal({
        expectedOrgSlug: orgSlug,
        returnUrl: window.location.href,
      });
      window.location.assign(result.portalUrl);
    } catch (error: unknown) {
      toast.error(
        formatSupportErrorMessage(
          "An error occurred while opening the billing portal.",
          extractRequestId(error),
        ),
      );
    } finally {
      setIsPortalSubmitting(false);
    }
  }

  async function handleRevokeFreeCredit(): Promise<void> {
    if (
      !billingState ||
      !billingState.canManageBilling ||
      isRevokeSubmitting ||
      isPlanSubmitting ||
      upgradeOverlay !== null
    ) {
      return;
    }

    setIsRevokeSubmitting(true);
    try {
      const result = await revokeFreePlanCredit({
        expectedOrgSlug: orgSlug,
      });
      if (!result.revoked) {
        toast.info("This workspace is not currently using your free workspace credit.");
        return;
      }
      toast.success("Free workspace credit revoked. This workspace is now without a plan.");
      try {
        await refreshBillingState();
      } catch (refreshError: unknown) {
        toast.error(
          formatSupportErrorMessage(
            "Free credit was revoked, but billing details could not be refreshed.",
            extractRequestId(refreshError),
          ),
        );
      }
    } catch (error: unknown) {
      toast.error(
        formatSupportErrorMessage(
          "An error occurred while revoking the free workspace credit.",
          extractRequestId(error),
        ),
      );
    } finally {
      setIsRevokeSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <OrgPageHero
        title="Billing"
        orgSlug={orgSlug}
        orgName={organization?.name}
        imageUrl={organization?.imageUrl}
        imageSeed={organization?.id}
        subtitle={<>Organization plans, usage limits, and billing settings.</>}
        tags={
          <>
            {isOrgClaimsLoading ? (
              <SkeletonPlaceholder
                className="inline-block rounded-md align-middle"
                content={<Badge variant="outline">Workspace admin</Badge>}
              />
            ) : (
              <OrgRoleBadge role={orgClaims.orgRole} />
            )}
            {billingState ? (
              <Badge variant={billingState.canManageBilling ? "default" : "outline"}>
                {billingState.canManageBilling ? "Billing admin" : "Read-only"}
              </Badge>
            ) : null}
            {billingState?.currentTier === null && !isBillingStateLoading ? (
              <Badge variant="outline">Workspace without a plan</Badge>
            ) : null}
          </>
        }
      />

      {isBillingUnavailable ? (
        <OrgSectionCard
          title="Billing unavailable"
          description="We could not load billing details for this organization."
        >
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/70 p-4">
            <p className="text-sm text-muted-foreground">
              {billingStateLoadError ??
                "An error occurred while loading billing details. Please retry."}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void handleRetryBillingStateLoad();
              }}
              disabled={isBillingStateLoading}
            >
              Retry
            </Button>
          </div>
        </OrgSectionCard>
      ) : (
        <>
          {showBillingSkeleton ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-xl border bg-background/70 p-4">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="mt-3 h-7 w-32" />
                  <Skeleton className="mt-2 h-3 w-24" />
                </div>
              ))}
            </div>
          ) : billingState ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <OrgMetricCard
                label="Current Plan"
                value={
                  isWithoutPlan
                    ? "Without a plan"
                    : formatTierName(billingState.currentTier ?? "free")
                }
                hint={
                  isWithoutPlan
                    ? "Select a plan to enable billing and usage."
                    : `${billingState.currentInterval === "annually" ? "Annual" : "Monthly"} · ${billingState.currentOverageMode === "with_overages" ? "Overages enabled" : "Overages disabled"}`
                }
                icon={<IconCreditCard className="size-4" />}
              />
              <OrgMetricCard
                label="Static Requests"
                value={
                  isWithoutPlan
                    ? "Without a plan"
                    : formatUsageProgress(
                        billingState.usage.staticRequests.usage,
                        billingState.usage.staticRequests.includedUsage,
                        "requests",
                      )
                }
                hint={
                  isWithoutPlan
                    ? "Usage disabled"
                    : formatOverageHint(billingState.usage.staticRequests.overageAllowed)
                }
                icon={<IconBolt className="size-4" />}
              />
              <OrgMetricCard
                label="Dynamic Requests"
                value={
                  isWithoutPlan
                    ? "Without a plan"
                    : formatUsageProgress(
                        billingState.usage.dynamicRequests.usage,
                        billingState.usage.dynamicRequests.includedUsage,
                        "requests",
                      )
                }
                hint={
                  isWithoutPlan
                    ? "Usage disabled"
                    : formatOverageHint(billingState.usage.dynamicRequests.overageAllowed)
                }
                icon={<IconCpu className="size-4" />}
              />
              <OrgMetricCard
                label="Storage"
                value={
                  isWithoutPlan
                    ? "Without a plan"
                    : formatUsageProgress(
                        billingState.usage.storageBytes.usage ?? billingState.storageMirrorBytes,
                        billingState.usage.storageBytes.includedUsage,
                        "bytes",
                      )
                }
                hint={
                  isWithoutPlan
                    ? "Usage disabled"
                    : formatOverageHint(billingState.usage.storageBytes.overageAllowed)
                }
                icon={<IconDatabase className="size-4" />}
              />
            </div>
          ) : null}

          {showBillingSkeleton || billingState ? (
            <OrgSectionCard
              title="Plans"
              description="Choose a plan for this organization."
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <ToggleGroup
                    multiple={false}
                    value={[overageMode]}
                    onValueChange={(values) => {
                      const next = values[0];
                      if (next === "without_overages" || next === "with_overages") {
                        setOverageMode(next);
                      }
                    }}
                    variant="outline"
                    size="sm"
                    spacing={0}
                  >
                    <ToggleGroupItem
                      value="without_overages"
                      disabled={isPlanSubmitting || upgradeOverlay !== null}
                    >
                      Without overages
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="with_overages"
                      disabled={isPlanSubmitting || upgradeOverlay !== null}
                    >
                      With overages
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <ToggleGroup
                    multiple={false}
                    value={[billingInterval]}
                    onValueChange={(values) => {
                      const next = values[0];
                      if (next === "monthly" || next === "annually") {
                        setBillingInterval(next);
                      }
                    }}
                    variant="outline"
                    size="sm"
                    spacing={0}
                  >
                    <ToggleGroupItem
                      value="monthly"
                      disabled={isPlanSubmitting || upgradeOverlay !== null}
                    >
                      Monthly
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="annually"
                      disabled={isPlanSubmitting || upgradeOverlay !== null}
                    >
                      Annually (-20%)
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void handleOpenBillingPortal();
                    }}
                    disabled={
                      showBillingSkeleton ||
                      !billingState?.canManageBilling ||
                      isPortalSubmitting ||
                      isPlanSubmitting ||
                      upgradeOverlay !== null
                    }
                  >
                    {isPortalSubmitting ? (
                      <SkeletonPlaceholder
                        className="inline-block rounded-md"
                        content={<span>Manage billing</span>}
                      />
                    ) : (
                      "Manage billing"
                    )}
                  </Button>
                  {billingState?.currentTier === "free" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void handleRevokeFreeCredit();
                      }}
                      disabled={
                        showBillingSkeleton ||
                        !billingState.canManageBilling ||
                        isRevokeSubmitting ||
                        isPlanSubmitting ||
                        upgradeOverlay !== null
                      }
                    >
                      {isRevokeSubmitting ? (
                        <SkeletonPlaceholder
                          className="inline-block rounded-md"
                          content={<span>Revoke free credit</span>}
                        />
                      ) : (
                        "Revoke free credit"
                      )}
                    </Button>
                  ) : null}
                </div>
              }
            >
              {showBillingSkeleton ? (
                <div className="grid gap-3 pb-3 lg:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="rounded-xl border bg-background/70 p-6">
                      <Skeleton className="h-6 w-24" />
                      <Skeleton className="mt-3 h-4 w-4/5" />
                      <div className="mt-5 space-y-2">
                        <Skeleton className="h-4 w-4/5" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-2/3" />
                      </div>
                      <Skeleton className="mt-6 h-9 w-full" />
                    </div>
                  ))}
                </div>
              ) : billingState ? (
                <>
                  {billingState?.currentTier === null && !isBillingStateLoading ? (
                    <div className="mb-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      This workspace is without a plan and currently disabled. Select a plan to
                      enable project creation and usage tracking.
                    </div>
                  ) : null}
                  <div className="grid gap-3 pb-3 lg:grid-cols-3">
                    {planTiers.map((plan, index) => (
                      <div key={plan.name} className="relative flex h-full flex-col">
                        {plan.id === "pro" ? (
                          <div className="pointer-events-none absolute top-0 right-4 z-10 -translate-y-1/2 rounded-full bg-blue-500 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white shadow-sm">
                            Most popular
                          </div>
                        ) : null}
                        {plan.id === "max" ? (
                          <div className="pointer-events-none absolute top-0 right-4 z-10 -translate-y-1/2 rounded-full bg-orange-500 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white shadow-sm">
                            Most value
                          </div>
                        ) : null}
                        <div className="flex h-full flex-col rounded-xl border bg-background/70 p-6">
                          <h3 className="text-xl font-semibold tracking-tight">{plan.name}</h3>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {plan.description}{" "}
                            {plan.id === "free" ? (
                              <>
                                Available for{" "}
                                <span className="font-semibold text-foreground">free</span>.
                              </>
                            ) : (
                              <>
                                Available for{" "}
                                <span className="font-semibold text-foreground">
                                  {formatUsd(plan.monthlyPriceUsd)}
                                </span>{" "}
                                per month
                                {billingInterval === "annually" ? ", billed annually." : "."}
                              </>
                            )}
                          </p>
                          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                            {!plan.isConfiguredInAutumn ? (
                              <p className="text-sm text-amber-600">
                                Not configured in Autumn yet. Configure this product before
                                activation.
                              </p>
                            ) : null}
                            {plan.includes ? (
                              <div className="font-medium text-foreground">
                                <span>{plan.includes}</span>
                              </div>
                            ) : null}
                            <div>
                              <div className="flex items-start gap-2">
                                <IconBolt className="mt-0.5 size-4 shrink-0" />
                                <span>{plan.usage.staticRequests}</span>
                              </div>
                              {overageMode === "with_overages" && plan.overage.staticPer1kUsd ? (
                                <p className="ml-6 mt-0.5 text-sm text-foreground/60">
                                  then {formatUsdPerThousand(plan.overage.staticPer1kUsd)} per 1,000
                                  static requests
                                </p>
                              ) : null}
                            </div>
                            <div>
                              <div className="flex items-start gap-2">
                                <IconCpu className="mt-0.5 size-4 shrink-0" />
                                <span>{plan.usage.dynamicRequests}</span>
                              </div>
                              {overageMode === "with_overages" && plan.overage.dynamicPer1kUsd ? (
                                <p className="ml-6 mt-0.5 text-sm text-foreground/60">
                                  then {formatUsdPerThousand(plan.overage.dynamicPer1kUsd)} per
                                  1,000 dynamic requests
                                </p>
                              ) : null}
                            </div>
                            <div>
                              <div className="flex items-start gap-2">
                                <IconDatabase className="mt-0.5 size-4 shrink-0" />
                                <span>{plan.usage.storage}</span>
                              </div>
                              {overageMode === "with_overages" && plan.overage.storagePerGbUsd ? (
                                <p className="ml-6 mt-0.5 text-sm text-foreground/60">
                                  then {formatUsdPerGb(plan.overage.storagePerGbUsd)} per 1 GB
                                  storage
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <div className="mt-5 space-y-2 text-sm text-muted-foreground">
                            {plan.support.map((item) => {
                              const SupportIcon = item.toLowerCase().includes("priority")
                                ? IconClock
                                : item.toLowerCase().includes("email")
                                  ? IconMail
                                  : IconUsers;

                              return (
                                <div key={item} className="flex items-start gap-2">
                                  <SupportIcon className="mt-0.5 size-4 shrink-0" />
                                  <span>{item}</span>
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-auto pt-4">
                            <div className="space-y-2 border-t border-border/70 pt-4 text-sm text-muted-foreground">
                              <p className="font-semibold text-foreground">Always included:</p>
                              {ALWAYS_INCLUDED_FEATURES.map((feature) => (
                                <div key={feature} className="flex items-start gap-2">
                                  <IconCheck className="mt-0.5 size-4 shrink-0" />
                                  <span>{feature}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <Button
                            className="mt-4"
                            variant={
                              plan.id === currentPlanId
                                ? "secondary"
                                : currentPlanId === null
                                  ? plan.id === "pro"
                                    ? "default"
                                    : "outline"
                                  : index > currentPlanIndex
                                    ? "default"
                                    : "outline"
                            }
                            disabled={
                              isBillingStateLoading ||
                              isPlanSubmitting ||
                              upgradeOverlay !== null ||
                              !billingState?.canManageBilling ||
                              !plan.isConfiguredInAutumn ||
                              (plan.id === "free" && isFreePlanActivationBlocked) ||
                              (currentPlanId !== null &&
                                plan.id === currentPlanId &&
                                billingState.currentInterval ===
                                  (plan.id === "free" ? "monthly" : billingInterval) &&
                                billingState.currentOverageMode ===
                                  (plan.id === "free" ? "without_overages" : overageMode))
                            }
                            onClick={() => {
                              handlePlanButtonClick(plan.id);
                            }}
                          >
                            {isPlanSubmitting && pendingPlanId === plan.id ? (
                              <span className="inline-flex items-center gap-2">
                                <Skeleton className="size-4 rounded-full" />
                                <SkeletonPlaceholder
                                  className="inline-block rounded-md"
                                  content={<span>Updating...</span>}
                                />
                              </span>
                            ) : plan.id === currentPlanId ? (
                              billingState?.currentInterval ===
                                (plan.id === "free" ? "monthly" : billingInterval) &&
                              billingState.currentOverageMode ===
                                (plan.id === "free" ? "without_overages" : overageMode) ? (
                                `On ${plan.name}`
                              ) : (
                                `Update ${plan.name}`
                              )
                            ) : !plan.isConfiguredInAutumn ? (
                              "Configure in Autumn"
                            ) : plan.id === "free" && isFreeCreditAssignedToDifferentOrg ? (
                              "Free credit used elsewhere"
                            ) : plan.id === "free" && isFreeCreditExhaustedWithoutAssignment ? (
                              "Free credit unavailable"
                            ) : currentPlanId === null ? (
                              plan.id === "free" ? (
                                `Activate Free`
                              ) : (
                                `Choose ${plan.name}`
                              )
                            ) : index > currentPlanIndex ? (
                              `Upgrade to ${plan.name}`
                            ) : (
                              `Downgrade to ${plan.name}`
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
              <p className="pt-1 text-xs text-muted-foreground">
                {billingState?.hasScheduledPlanChange ? (
                  <span className="font-semibold text-foreground">
                    {billingState.scheduledPlanChange &&
                    billingState.currentTier !== null &&
                    billingState.currentInterval !== null &&
                    billingState.currentOverageMode !== null &&
                    currentPlanMonthlyPriceUsd !== null
                      ? `${formatScheduledPlanChangeNotice({
                          currentTier: billingState.currentTier,
                          currentInterval: billingState.currentInterval,
                          currentOverageMode: billingState.currentOverageMode,
                          currentMonthlyPriceUsd: currentPlanMonthlyPriceUsd,
                          scheduledPlanChange: billingState.scheduledPlanChange,
                        })} `
                      : "A plan change is set to apply soon. "}
                  </span>
                ) : null}
                You can create unlimited organizations. New organizations start without a plan until
                you apply your free workspace credit or choose a paid plan.
                {overageMode === "with_overages"
                  ? " Overage charges are billed monthly, even on annual plans."
                  : ""}
              </p>
            </OrgSectionCard>
          ) : null}
        </>
      )}
      <Dialog
        open={isUpgradeDialogOpen}
        onOpenChange={(open) => {
          if (isPlanSubmitting) {
            return;
          }
          setIsUpgradeDialogOpen(open);
          if (!open) {
            setUpgradeDialogPlanId(null);
          }
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {upgradeDialogPlanId && isUpgradeLikeChange(upgradeDialogPlanId)
                ? "Confirm upgrade"
                : "Confirm billing change"}
            </DialogTitle>
            <DialogDescription>
              This paid billing change may create an immediate charge for your workspace.
            </DialogDescription>
          </DialogHeader>
          {upgradeDialogPlanMetadata ? (
            <div className="rounded-xl border bg-muted/30 p-3 text-sm">
              <p className="font-medium text-foreground">
                {upgradeDialogPlanMetadata.name} ·{" "}
                {nextBillingInterval === "annually" ? "Annually" : "Monthly"}
              </p>
              <p className="mt-1 text-muted-foreground">
                {formatUsd(upgradeDialogPlanMetadata.monthlyPriceUsd)} per month
                {nextBillingInterval === "annually"
                  ? ` (about ${formatUsd(upgradeDialogPlanMetadata.monthlyPriceUsd * 12)} billed yearly).`
                  : "."}
              </p>
              <p className="mt-1 text-muted-foreground">
                {nextOverageMode === "with_overages" ? "With overages" : "Without overages"}.
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsUpgradeDialogOpen(false);
                setUpgradeDialogPlanId(null);
              }}
              disabled={isPlanSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                void handleConfirmUpgradeChange();
              }}
              disabled={isPlanSubmitting || upgradeDialogPlanId === null}
            >
              {upgradeDialogPlanId && isUpgradeLikeChange(upgradeDialogPlanId)
                ? "Confirm upgrade"
                : "Confirm change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {upgradeOverlay ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-md">
          <div className="mx-4 w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-xl">
            <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/10">
              {upgradeOverlay.isSuccess ? (
                <IconCheck className="size-5 text-primary" />
              ) : (
                <Skeleton className="size-5 rounded-full bg-primary/30" />
              )}
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">{upgradeOverlay.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{upgradeOverlay.description}</p>
            {upgradeOverlay.isSuccess ? (
              <Button
                className="mt-5"
                onClick={() => {
                  setUpgradeOverlay(null);
                }}
              >
                Continue
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
