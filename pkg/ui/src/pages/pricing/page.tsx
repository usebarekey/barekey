import { useAction } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  IconArrowRight,
  IconBolt,
  IconCheck,
  IconClock,
  IconCpu,
  IconDatabase,
  IconMail,
  IconUsers,
} from "@tabler/icons-react";
import { useAuth } from "@clerk/react-router";

import { api } from "@convex/_generated/api";
import { buttonVariants } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Nav, Footer } from "@/pages/home/landing";
import { cn } from "@/lib/utils";

type PlanId = "free" | "pro" | "max";
type BillingInterval = "monthly" | "annually";
type OverageMode = "without_overages" | "with_overages";

type PlanDisplayMetadata = {
  id: PlanId;
  name: string;
  description: string;
  includes: string | null;
  support: Array<string>;
  defaultMonthlyPriceUsd: number;
  defaultStaticRequests: number;
  defaultDynamicRequests: number;
  defaultStorageBytes: number;
  defaultStaticOveragePer1kUsd: number | null;
  defaultDynamicOveragePer1kUsd: number | null;
  defaultStorageOveragePerGbUsd: number | null;
};

type PricingVariant = {
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

const PLAN_METADATA: Array<PlanDisplayMetadata> = [
  {
    id: "free",
    name: "Free",
    description: "Best for personal projects and early experimentation.",
    includes: null,
    support: ["Community support"],
    defaultMonthlyPriceUsd: 0,
    defaultStaticRequests: 10_000,
    defaultDynamicRequests: 500,
    defaultStorageBytes: 25_000_000,
    defaultStaticOveragePer1kUsd: null,
    defaultDynamicOveragePer1kUsd: null,
    defaultStorageOveragePerGbUsd: null,
  },
  {
    id: "pro",
    name: "Pro",
    description: "For growing teams that need more scale and support.",
    includes: "Everything in Free, plus:",
    support: ["Email support"],
    defaultMonthlyPriceUsd: 9.99,
    defaultStaticRequests: 1_000_000,
    defaultDynamicRequests: 100_000,
    defaultStorageBytes: 500_000_000,
    defaultStaticOveragePer1kUsd: 0.0053,
    defaultDynamicOveragePer1kUsd: 0.0265,
    defaultStorageOveragePerGbUsd: null,
  },
  {
    id: "max",
    name: "Max",
    description: "Highest limits for production-heavy workloads.",
    includes: "Everything in Free and Pro, plus:",
    support: ["Priority support", "Audit export / advanced logs"],
    defaultMonthlyPriceUsd: 39.99,
    defaultStaticRequests: 10_000_000,
    defaultDynamicRequests: 1_000_000,
    defaultStorageBytes: 5_000_000_000,
    defaultStaticOveragePer1kUsd: 0.0026,
    defaultDynamicOveragePer1kUsd: 0.013,
    defaultStorageOveragePerGbUsd: null,
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
    return `${value / 1_000_000_000} GB storage`;
  }
  if (value >= 1_000_000) {
    const mb = value / 1_000_000;
    const rounded = mb % 1 === 0 ? mb.toFixed(0) : mb.toFixed(1);
    return `${rounded} MB storage`;
  }
  return `${value} B storage`;
}

export function Page() {
  const { isLoaded, isSignedIn, orgSlug } = useAuth();
  const getPricingCatalog = useAction(api.payments.getPricingCatalogPublic);
  const dashboardPath = orgSlug ? `/o/${orgSlug}/overview` : "/o/select";
  const billingPath = orgSlug ? `/o/${orgSlug}/billing` : "/o/select";
  const hasSignedInSession = isLoaded && !!isSignedIn;

  const [scrolled, setScrolled] = useState(false);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [overageMode, setOverageMode] = useState<OverageMode>("without_overages");
  const [variants, setVariants] = useState<Array<PricingVariant> | null>(null);

  useEffect(() => {
    document.title = "Pricing · Barekey";
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getPricingCatalog({})
      .then((result) => {
        if (!cancelled) {
          setVariants(result.variants as Array<PricingVariant>);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVariants(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [getPricingCatalog]);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 16);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const planTiers = useMemo(() => {
    return PLAN_METADATA.map((plan) => {
      const selectedVariant =
        variants?.find(
          (variant) =>
            variant.tier === plan.id &&
            variant.interval === (plan.id === "free" ? "monthly" : billingInterval) &&
            variant.overageMode ===
              (plan.id === "free" ? "without_overages" : overageMode),
        ) ?? null;

      const monthlyPriceUsd = selectedVariant?.monthlyPriceUsd ?? plan.defaultMonthlyPriceUsd;
      const staticRequests =
        selectedVariant?.includedStaticRequests ?? plan.defaultStaticRequests;
      const dynamicRequests =
        selectedVariant?.includedDynamicRequests ?? plan.defaultDynamicRequests;
      const storageBytes =
        selectedVariant?.includedStorageBytes ?? plan.defaultStorageBytes;
      const staticOveragePer1kUsd =
        selectedVariant?.staticOveragePer1kUsd ?? plan.defaultStaticOveragePer1kUsd;
      const dynamicOveragePer1kUsd =
        selectedVariant?.dynamicOveragePer1kUsd ?? plan.defaultDynamicOveragePer1kUsd;
      const storageOveragePerGbUsd =
        selectedVariant?.storageOveragePerGbUsd ?? plan.defaultStorageOveragePerGbUsd;

      return {
        ...plan,
        monthlyPriceUsd,
        usage: {
          staticRequests: `${formatRequestCount(staticRequests)} static requests`,
          dynamicRequests: `${formatRequestCount(dynamicRequests)} dynamic requests`,
          storage: formatStorageBytes(storageBytes),
        },
        overage:
          staticOveragePer1kUsd === null &&
          dynamicOveragePer1kUsd === null &&
          storageOveragePerGbUsd === null
            ? null
            : {
                staticPer1kUsd: staticOveragePer1kUsd,
                dynamicPer1kUsd: dynamicOveragePer1kUsd,
                storagePerGbUsd: storageOveragePerGbUsd,
              },
      };
    });
  }, [billingInterval, overageMode, variants]);

  return (
    <div className="min-h-screen">
      <Nav scrolled={scrolled} isSignedIn={hasSignedInSession} dashboardPath={dashboardPath} />

      <section className="pt-28 pb-16 md:pt-36 md:pb-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="space-y-2 text-center">
            <p className="org-kicker text-muted-foreground">Pricing</p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Simple, transparent pricing
            </h1>
            <p className="mx-auto max-w-lg text-muted-foreground leading-relaxed">
              Start free. Scale when you&apos;re ready. No surprises.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
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

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {planTiers.map((plan) => {
              const ctaPath = hasSignedInSession
                ? plan.id === "free"
                  ? dashboardPath
                  : `${billingPath}?plan=${plan.id}`
                : `/auth/sso?plan=${plan.id}`;
              const ctaLabel = hasSignedInSession
                ? plan.id === "free"
                  ? "Open dashboard"
                  : `Choose ${plan.name}`
                : plan.id === "free"
                  ? "Get started free"
                  : `Get started with ${plan.name}`;

              return (
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
                          per month
                          {billingInterval === "annually" ? ", billed annually." : "."}
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
                        {overageMode === "with_overages" && plan.overage?.staticPer1kUsd ? (
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
                        {overageMode === "with_overages" && plan.overage?.dynamicPer1kUsd ? (
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
                        {overageMode === "with_overages" && plan.overage?.storagePerGbUsd ? (
                          <p className="ml-6 mt-0.5 text-sm text-foreground/60">
                            then {formatUsdPerGb(plan.overage.storagePerGbUsd)} per 1 GB storage
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
                    <Link
                      to={ctaPath}
                      className={cn(
                        buttonVariants({ variant: plan.id === "pro" ? "default" : "outline" }),
                        "mt-4",
                      )}
                    >
                      {ctaLabel}
                      <IconArrowRight data-icon="inline-end" className="size-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            You can create unlimited organizations. New organizations start without a plan until
            you apply your free workspace credit or choose a paid plan.
            {overageMode === "with_overages"
              ? " Overage charges are billed monthly, even on annual plans."
              : ""}
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
