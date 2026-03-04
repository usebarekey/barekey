import { useQuery } from "convex/react";
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
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { api } from "@convex/_generated/api";
import { OrgPageHero, OrgRoleBadge, OrgSectionCard } from "@/components/custom/org-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const PLAN_TIERS = [
  {
    id: "free",
    name: "Free",
    description: "Best for personal projects and early experimentation.",
    monthlyPriceUsd: 0,
    includes: null,
    usage: {
      staticRequests: "10k static requests",
      dynamicRequests: "500 dynamic requests",
      storage: "25 MB storage",
    },
    support: ["Community support"],
    overage: null,
  },
  {
    id: "pro",
    name: "Pro",
    description: "For growing teams that need more scale and support.",
    monthlyPriceUsd: 9.99,
    includes: "Everything in Free, plus:",
    usage: {
      staticRequests: "1M static requests",
      dynamicRequests: "100k dynamic requests",
      storage: "500 MB storage",
    },
    support: ["Email support"],
    overage: {
      dynamicPer1kUsd: 0.0265,
      staticPer1kUsd: 0.0053,
    },
  },
  {
    id: "max",
    name: "Max",
    description: "Highest limits for production-heavy workloads.",
    monthlyPriceUsd: 39.99,
    includes: "Everything in Free and Pro, plus:",
    usage: {
      staticRequests: "10M static requests",
      dynamicRequests: "1M dynamic requests",
      storage: "5 GB storage",
    },
    support: ["Priority support", "Audit export / advanced logs"],
    overage: {
      dynamicPer1kUsd: 0.013,
      staticPer1kUsd: 0.0026,
    },
  },
] as const;
type PlanId = (typeof PLAN_TIERS)[number]["id"];
type BillingInterval = "monthly" | "annually";
type OverageMode = "without_overages" | "with_overages";
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

export function Page() {
  const { orgSlug = "org" } = useParams();
  const orgClaims = useQuery(api.orgs.getCurrentOrgClaims, {
    expectedOrgSlug: orgSlug,
  });
  const { organization } = useOrganization();
  const isOrgClaimsLoading = orgClaims === undefined;
  const currentPlanId: PlanId = "free";
  const currentPlanIndex = PLAN_TIERS.findIndex((tier) => tier.id === currentPlanId);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [overageMode, setOverageMode] = useState<OverageMode>("without_overages");

  useEffect(() => {
    const orgLabel = organization?.name?.trim() || orgSlug;
    document.title = `${orgLabel} · Billing`;
  }, [organization?.name, orgSlug]);

  return (
    <div className="space-y-6">
      <OrgPageHero
        title="Billing"
        orgSlug={orgSlug}
        orgName={organization?.name}
        imageUrl={organization?.imageUrl}
        imageSeed={organization?.id}
        subtitle={<>Organization plans and workspace billing tiers.</>}
        tags={
          <>
            {isOrgClaimsLoading ? (
              <Badge variant="outline">Loading role...</Badge>
            ) : (
              <OrgRoleBadge role={orgClaims.orgRole} />
            )}
          </>
        }
      />

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
          </div>
        }
      >
        <div className="grid gap-3 pb-3 lg:grid-cols-3">
          {PLAN_TIERS.map((plan, index) => (
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
                        {formatUsd(
                          billingInterval === "annually"
                            ? plan.monthlyPriceUsd * 0.8
                            : plan.monthlyPriceUsd,
                        )}
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
                    {overageMode === "with_overages" && plan.overage ? (
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
                    {overageMode === "with_overages" && plan.overage ? (
                      <p className="ml-6 mt-0.5 text-sm text-foreground/60">
                        then {formatUsdPerThousand(plan.overage.dynamicPer1kUsd)} per 1,000 dynamic requests
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-start gap-2">
                    <IconDatabase className="mt-0.5 size-4 shrink-0" />
                    <span>{plan.usage.storage}</span>
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
                  variant={plan.id === currentPlanId ? "secondary" : index > currentPlanIndex ? "default" : "outline"}
                  disabled={plan.id === currentPlanId}
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
