import { useAction, useQuery } from "convex/react";
import {
  IconBolt,
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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

function formatRequestCount(value: number): string {
  if (value >= 1_000_000 && value % 1_000_000 === 0) {
    return `${value / 1_000_000}M`;
  }
  if (value >= 1_000 && value % 1_000 === 0) {
    return `${value / 1_000}k`;
  }
  return value.toLocaleString();
}

function formatStorageBytes(value: number): string {
  if (value >= 1_000_000_000 && value % 1_000_000_000 === 0) {
    return `${value / 1_000_000_000} GB`;
  }
  if (value >= 1_000_000) {
    const mb = value / 1_000_000;
    const rounded = mb % 1 === 0 ? mb.toFixed(0) : mb.toFixed(1);
    return `${rounded} MB`;
  }
  return `${value} B`;
}

function formatUsageProgress(used: number | null, included: number | null, unit: string): string {
  const usedLabel = used === null ? "0" : unit === "bytes" ? formatStorageBytes(used) : formatRequestCount(used);
  const includedLabel =
    included === null
      ? "unlimited"
      : unit === "bytes"
        ? formatStorageBytes(included)
        : formatRequestCount(included);
  return `${usedLabel} / ${includedLabel}`;
}

export function Page() {
  const { orgSlug = "org" } = useParams();
  const orgClaims = useQuery(api.orgs.getCurrentOrgClaims, {
    expectedOrgSlug: orgSlug,
  });
  const { organization } = useOrganization();
  const getBillingState = useAction(api.payments.getBillingStateForCurrentOrg);
  const changePlan = useAction(api.payments.changePlanForCurrentOrg);
  const openBillingPortal = useAction(api.payments.openBillingPortalForCurrentOrg);

  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [overageMode, setOverageMode] = useState<OverageMode>("without_overages");
  const [billingState, setBillingState] = useState<BillingState | null>(null);
  const [isBillingStateLoading, setIsBillingStateLoading] = useState(true);
  const [isPlanSubmitting, setIsPlanSubmitting] = useState(false);
  const [isPortalSubmitting, setIsPortalSubmitting] = useState(false);

  const isOrgClaimsLoading = orgClaims === undefined;

  useEffect(() => {
    const orgLabel = organization?.name?.trim() || orgSlug;
    document.title = `${orgLabel} · Billing`;
  }, [organization?.name, orgSlug]);

  useEffect(() => {
    let cancelled = false;
    setIsBillingStateLoading(true);

    void getBillingState({
      expectedOrgSlug: orgSlug,
    })
      .then((result) => {
        if (cancelled) {
          return;
        }
        setBillingState(result as BillingState);
        if (result.currentInterval) {
          setBillingInterval(result.currentInterval);
        }
        if (result.currentOverageMode) {
          setOverageMode(result.currentOverageMode);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Failed to load billing details.");
          setBillingState(null);
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

  const currentPlanId: PlanId = billingState?.currentTier ?? "free";
  const currentPlanIndex = PLAN_METADATA.findIndex((tier) => tier.id === currentPlanId);

  const planTiers = useMemo(() => {
    return PLAN_METADATA.map((plan) => {
      const selectedVariant =
        billingState?.variants.find(
          (variant) =>
            variant.tier === plan.id &&
            variant.interval === (plan.id === "free" ? "monthly" : billingInterval) &&
            variant.overageMode ===
              (plan.id === "free" ? "without_overages" : overageMode),
        ) ?? null;

      return {
        ...plan,
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

  async function refreshBillingState(): Promise<void> {
    const refreshed = await getBillingState({
      expectedOrgSlug: orgSlug,
    });
    setBillingState(refreshed as BillingState);
  }

  async function handleChangePlan(nextPlanId: PlanId): Promise<void> {
    if (!billingState || !billingState.canManageBilling || isPlanSubmitting) {
      return;
    }

    setIsPlanSubmitting(true);
    try {
      const result = await changePlan({
        expectedOrgSlug: orgSlug,
        tier: nextPlanId,
        interval: nextPlanId === "free" ? "monthly" : billingInterval,
        overageMode: nextPlanId === "free" ? "without_overages" : overageMode,
        successUrl: window.location.href,
      });

      if (result.checkoutRequired && result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }

      await refreshBillingState();
      toast.success(`Updated plan to ${nextPlanId}.`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to update billing plan.");
    } finally {
      setIsPlanSubmitting(false);
    }
  }

  async function handleOpenBillingPortal(): Promise<void> {
    if (!billingState || !billingState.canManageBilling || isPortalSubmitting) {
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
      toast.error(error instanceof Error ? error.message : "Failed to open billing portal.");
    } finally {
      setIsPortalSubmitting(false);
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
        subtitle={<>Organization plans, usage limits, and workspace billing settings.</>}
        tags={
          <>
            {isOrgClaimsLoading ? (
              <Badge variant="outline">Loading role...</Badge>
            ) : (
              <OrgRoleBadge role={orgClaims.orgRole} />
            )}
            {billingState ? (
              <Badge variant={billingState.canManageBilling ? "default" : "outline"}>
                {billingState.canManageBilling ? "Billing admin" : "Read-only"}
              </Badge>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <OrgMetricCard
          label="Static Requests"
          value={
            billingState
              ? formatUsageProgress(
                  billingState.usage.staticRequests.usage,
                  billingState.usage.staticRequests.includedUsage,
                  "requests",
                )
              : "..."
          }
          hint={
            billingState?.usage.staticRequests.overageAllowed
              ? "Overages enabled"
              : "Overages disabled"
          }
          icon={<IconBolt className="size-4" />}
        />
        <OrgMetricCard
          label="Dynamic Requests"
          value={
            billingState
              ? formatUsageProgress(
                  billingState.usage.dynamicRequests.usage,
                  billingState.usage.dynamicRequests.includedUsage,
                  "requests",
                )
              : "..."
          }
          hint={
            billingState?.usage.dynamicRequests.overageAllowed
              ? "Overages enabled"
              : "Overages disabled"
          }
          icon={<IconCpu className="size-4" />}
        />
        <OrgMetricCard
          label="Storage"
          value={
            billingState
              ? formatUsageProgress(
                  billingState.usage.storageBytes.usage ?? billingState.storageMirrorBytes,
                  billingState.usage.storageBytes.includedUsage,
                  "bytes",
                )
              : "..."
          }
          hint={
            billingState?.usage.storageBytes.overageAllowed
              ? "Overages enabled"
              : "Overages disabled"
          }
          icon={<IconDatabase className="size-4" />}
        />
      </div>

      <OrgSectionCard
        title="Plans"
        description="Choose a plan for this organization workspace."
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
              <ToggleGroupItem value="without_overages">Without overages</ToggleGroupItem>
              <ToggleGroupItem value="with_overages">With overages</ToggleGroupItem>
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
              <ToggleGroupItem value="monthly">Monthly</ToggleGroupItem>
              <ToggleGroupItem value="annually">Annually (-20%)</ToggleGroupItem>
            </ToggleGroup>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void handleOpenBillingPortal();
              }}
              disabled={
                isBillingStateLoading ||
                !billingState?.canManageBilling ||
                isPortalSubmitting
              }
            >
              {isPortalSubmitting ? "Opening..." : "Manage billing"}
            </Button>
          </div>
        }
      >
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
                      Available for <span className="font-semibold text-foreground">free</span>.
                    </>
                  ) : (
                    <>
                      Available for{" "}
                      <span className="font-semibold text-foreground">
                        {formatUsd(plan.monthlyPriceUsd)}
                      </span>{" "}
                      per month{billingInterval === "annually" ? ", billed annually." : "."}
                    </>
                  )}
                </p>
                <div className="mt-4 space-y-2 text-sm text-muted-foreground">
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
                        then {formatUsdPerThousand(plan.overage.staticPer1kUsd)} per 1,000 static requests
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
                        then {formatUsdPerThousand(plan.overage.dynamicPer1kUsd)} per 1,000 dynamic requests
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
                        then {formatUsd(plan.overage.storagePerGbUsd)} per 1 GB storage
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
                      : index > currentPlanIndex
                        ? "default"
                        : "outline"
                  }
                  disabled={
                    isBillingStateLoading ||
                    isPlanSubmitting ||
                    !billingState?.canManageBilling ||
                    plan.id === currentPlanId
                  }
                  onClick={() => {
                    void handleChangePlan(plan.id);
                  }}
                >
                  {plan.id === currentPlanId
                    ? `On ${plan.name}`
                    : index > currentPlanIndex
                      ? `Upgrade to ${plan.name}`
                      : `Downgrade to ${plan.name}`}
                </Button>
              </div>
            </div>
          ))}
        </div>
        <p className="pt-1 text-xs text-muted-foreground">
          The Free plan is limited to one organization per user.
          {overageMode === "with_overages"
            ? " Overage usage is billed monthly regardless of billing interval."
            : ""}
        </p>
      </OrgSectionCard>
    </div>
  );
}
