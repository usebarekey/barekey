import { useEffect, useState } from "react";
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

import { Nav, Footer } from "@/pages/home/landing";
import { Button, buttonVariants } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

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
  const { isLoaded, isSignedIn, orgSlug } = useAuth();
  const dashboardPath = orgSlug ? `/o/${orgSlug}/overview` : "/o/select";
  const billingPath = orgSlug ? `/o/${orgSlug}/billing` : "/o/select";
  const hasSignedInSession = isLoaded && !!isSignedIn;

  const [scrolled, setScrolled] = useState(false);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [overageMode, setOverageMode] = useState<OverageMode>("without_overages");

  useEffect(() => {
    document.title = "Pricing · Barekey";
  }, []);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 16);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen">
      <Nav scrolled={scrolled} isSignedIn={isLoaded && !!isSignedIn} dashboardPath={dashboardPath} />

      <section className="pt-28 pb-16 md:pt-36 md:pb-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="space-y-2 text-center">
            <p className="org-kicker text-muted-foreground">Pricing</p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Simple, transparent pricing
            </h1>
            <p className="mx-auto max-w-lg text-muted-foreground leading-relaxed">
              Start free. Scale when you're ready. No surprises.
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
            {PLAN_TIERS.map((plan) => {
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
            The Free plan is limited to one organization per user.
            {overageMode === "with_overages"
              ? " Overage usage is billed monthly regardless of billing interval."
              : ""}
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
