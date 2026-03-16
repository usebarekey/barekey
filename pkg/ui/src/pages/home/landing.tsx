import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  IconLock,
  IconFlask,
  IconChartLine,
  IconArrowRight,
  IconCode,
  IconLayoutDashboard,
  IconGitBranch,
  IconTerminal2,
  IconUsers,
  IconPencil,
} from "@tabler/icons-react";

import { Logo } from "@/components/custom/logo";
import { CodeBlock } from "@/components/custom/code-block";
import { useAnalytics } from "@/lib/posthog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const codeExamples = [
  {
    file: "secrets.ts",
    heading: "Encrypted at rest, typed at build",
    description:
      "Retrieve secrets with full type safety. Coerce values and set fallback defaults in a single chain.",
    code: `import { env } from "@barekey/sdk";

const databaseUrl = env.get("DATABASE_URL");

const stripeKey = env.get("STRIPE_SECRET_KEY");

const debug = env.get("DEBUG_MODE")
  .coerce("boolean")
  .default(false);`,
  },
  {
    file: "experiment.ts",
    heading: "Deterministic A/B bucketing",
    description:
      "Assign users to experiment cohorts with a stable seed. Same user, same variant, every request.",
    code: `import { env } from "@barekey/sdk";

const variant = env.get("CHECKOUT_REDESIGN", {
  seed: user.id,
});

if (variant === "treatment") {
  renderNewCheckout();
} else {
  renderClassicCheckout();
}`,
  },
  {
    file: "rollout.ts",
    heading: "Progressive rollouts with TTL",
    description:
      "Ship features gradually with dynamic evaluation and time-based cache invalidation.",
    code: `import { env } from "@barekey/sdk";

const useNewDashboard = env.get("NEW_DASHBOARD", {
  dynamic: { ttl: 300_000 },
  seed: user.id,
});

if (useNewDashboard) {
  renderDashboardV2();
}`,
  },
];

export function Nav({
  scrolled,
  isSignedIn,
  dashboardPath,
}: {
  scrolled: boolean;
  isSignedIn: boolean;
  dashboardPath: string;
}) {
  const { capture } = useAnalytics();

  return (
    <header
      className={cn(
        "fixed top-0 right-0 left-0 z-50 transition-colors duration-200",
        scrolled ? "border-b bg-background/90 backdrop-blur" : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center">
          <Logo className="h-5" />
        </Link>

        <div className="flex items-center gap-6">
          <Link
            to="/pricing"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => {
              capture("navigation_clicked", {
                destination: "/pricing",
                location: "nav",
                type: "internal_link",
              });
            }}
          >
            Pricing
          </Link>
          <a
            href="https://docs.barekey.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => {
              capture("navigation_clicked", {
                destination: "https://docs.barekey.dev",
                location: "nav",
                type: "external_link",
              });
            }}
          >
            Docs
          </a>
          {isSignedIn ? (
            <Link
              to={dashboardPath}
              className={cn(buttonVariants({ size: "sm" }))}
              onClick={() => {
                capture("cta_clicked", {
                  cta: "dashboard",
                  location: "nav",
                });
              }}
            >
              Dashboard
            </Link>
          ) : (
            <Link
              to="/auth/sso"
              className={cn(buttonVariants({ size: "sm" }))}
              onClick={() => {
                capture("cta_clicked", {
                  cta: "get_started",
                  location: "nav",
                });
              }}
            >
              Get started
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function Hero({ primaryCtaPath }: { primaryCtaPath: string }) {
  const { capture } = useAnalytics();

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_25%,color-mix(in_oklab,var(--primary)_14%,transparent),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,color-mix(in_oklab,var(--foreground)_5%,transparent),transparent_40%)]" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(to right, color-mix(in oklab, var(--border) 50%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--border) 50%, transparent) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            maskImage: "radial-gradient(ellipse at 50% 40%, black 30%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 pt-32 pb-20 md:pt-44 md:pb-28">
        <div className="max-w-2xl space-y-6">
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Manage secrets across every environment
          </h1>
          <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
            Encrypted variables, deterministic experiments, and progressive rollouts — managed from
            one SDK, visible from one dashboard.
          </p>
          <div className="flex gap-3 pt-2">
            <Link
              to={primaryCtaPath}
              className={cn(buttonVariants({ size: "lg" }))}
              onClick={() => {
                capture("cta_clicked", {
                  cta: "get_started",
                  location: "hero",
                });
              }}
            >
              Get started
              <IconArrowRight className="size-4" />
            </Link>
            <a
              href="https://docs.barekey.dev"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
              onClick={() => {
                capture("cta_clicked", {
                  cta: "documentation",
                  location: "hero",
                });
              }}
            >
              Documentation
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Bento() {
  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="relative grid gap-2 md:min-h-[80vh] md:grid-cols-4 md:grid-rows-3">
          {/* Shared light source — single radial gradient clipped to the bento grid */}
          <div
            className="pointer-events-none absolute inset-0 z-10"
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(ellipse 80% 70% at 28% 20%, color-mix(in oklab, var(--primary) 13%, transparent), transparent 75%)",
            }}
          />

          {/* Row 1 */}

          {/* Envelope encryption — 2 cols */}
          <div className="flex flex-col justify-between overflow-hidden border bg-card p-5 md:col-span-2">
            <div>
              <IconLock className="mb-4 size-5 text-muted-foreground" />
              <h3 className="mb-1.5 text-sm font-medium">Industry standard encryption</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Every secret is isolated per project and encrypted via XChaCha20-Poly1305.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-3">
              <div className="flex gap-1">
                <div className="h-3 w-3 border border-primary/30 bg-primary/10" />
                <div className="h-3 w-6 border border-foreground/10 bg-foreground/5" />
                <div className="h-3 w-6 border border-foreground/10 bg-foreground/5" />
              </div>
              <span className="select-none font-mono text-[11px] tracking-wider text-muted-foreground/30">
                KEK → DEK → value
              </span>
            </div>
          </div>

          {/* Stages */}
          <div className="flex flex-col justify-between overflow-hidden border bg-card p-5">
            <div>
              <IconGitBranch className="mb-4 size-5 text-muted-foreground" />
              <h3 className="mb-1.5 text-sm font-medium">Stages</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Separate variable sets per environment. Add custom stages beyond the defaults.
              </p>
            </div>
            <div className="mt-4 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 bg-foreground/25" />
                <span className="font-mono text-[10px] text-muted-foreground/50">development</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 bg-primary/40" />
                <span className="font-mono text-[10px] text-muted-foreground/50">production</span>
              </div>
            </div>
          </div>

          {/* Type-safe SDK */}
          <div className="flex flex-col justify-between overflow-hidden border bg-card p-5">
            <div>
              <IconCode className="mb-4 size-5 text-muted-foreground" />
              <h3 className="mb-1.5 text-sm font-medium">Type-safe SDK</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Validated at build time. Coerce, default, and chain with full inference.
              </p>
            </div>
            <code className="mt-4 block font-mono text-[11px] text-muted-foreground/40">
              {"env.get<string>(key)"}
            </code>
          </div>

          {/* Row 2 */}

          {/* A/B experiments */}
          <div className="flex flex-col justify-between overflow-hidden border bg-card p-5">
            <div>
              <IconFlask className="mb-4 size-5 text-muted-foreground" />
              <h3 className="mb-1.5 text-sm font-medium">A/B experiments</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Deterministic bucketing with a stable seed. Same user, same variant.
              </p>
            </div>
            <div className="mt-4 flex gap-0.5">
              <div className="h-2 flex-60 bg-foreground/15" />
              <div className="h-2 flex-40 bg-primary/25" />
            </div>
          </div>

          {/* Progressive rollouts — 2 cols */}
          <div className="flex flex-col justify-between overflow-hidden border bg-card p-5 md:col-span-2">
            <div>
              <IconChartLine className="mb-4 size-5 text-muted-foreground" />
              <h3 className="mb-1.5 text-sm font-medium">Progressive rollouts</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Ship gradually with dynamic TTL cache. Roll back in one click.
              </p>
            </div>
            <div className="mt-4 flex items-end gap-1">
              <div className="h-1.5 w-8 bg-foreground/8" />
              <div className="h-3 w-8 bg-foreground/10" />
              <div className="h-5 w-8 bg-foreground/14" />
              <div className="h-8 w-8 bg-primary/20" />
            </div>
          </div>

          {/* CLI access */}
          <div className="flex flex-col justify-between overflow-hidden border bg-card p-5">
            <div>
              <IconTerminal2 className="mb-4 size-5 text-muted-foreground" />
              <h3 className="mb-1.5 text-sm font-medium">CLI access</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Pull, write, and list variables from the terminal. Device-code auth flow.
              </p>
            </div>
            <code className="mt-4 block font-mono text-[11px] text-muted-foreground/40">
              $ barekey env pull
            </code>
          </div>

          {/* Row 3 */}

          {/* Team workspaces */}
          <div className="flex flex-col justify-between overflow-hidden border bg-card p-5">
            <div>
              <IconUsers className="mb-4 size-5 text-muted-foreground" />
              <h3 className="mb-1.5 text-sm font-medium">Team workspaces</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Members, roles, and invitations. Projects are always team-owned.
              </p>
            </div>
            <div className="mt-4 flex -space-x-1.5">
              <div className="size-5 border border-card bg-foreground/12" />
              <div className="size-5 border border-card bg-foreground/10" />
              <div className="size-5 border border-card bg-foreground/8" />
              <div className="size-5 border border-card bg-foreground/6" />
            </div>
          </div>

          {/* Draft editing */}
          <div className="flex flex-col justify-between overflow-hidden border bg-card p-5">
            <div>
              <IconPencil className="mb-4 size-5 text-muted-foreground" />
              <h3 className="mb-1.5 text-sm font-medium">Draft editing</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Stage changes, preview byte deltas, then commit or discard.
              </p>
            </div>
            <div className="mt-4 flex flex-col gap-0.5 font-mono text-[10px]">
              <span className="text-green-500/50">+ DATABASE_URL</span>
              <span className="text-red-400/50">- OLD_API_KEY</span>
            </div>
          </div>

          {/* Dashboard — 2 cols */}
          <div className="flex flex-col justify-between overflow-hidden border bg-card p-5 md:col-span-2">
            <div>
              <IconLayoutDashboard className="mb-4 size-5 text-muted-foreground" />
              <h3 className="mb-1.5 text-sm font-medium">One dashboard</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Variables, experiments, and rollouts — managed from one place with real-time sync.
              </p>
            </div>
            <div className="mt-4 space-y-1">
              <div className="h-1 w-full bg-foreground/6" />
              <div className="h-1 w-3/4 bg-foreground/6" />
              <div className="h-1 w-1/2 bg-foreground/6" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SdkPreview() {
  const [activeTab, setActiveTab] = useState(0);
  const { capture } = useAnalytics();
  const active = codeExamples[activeTab];

  return (
    <section className="border-t py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-10 md:grid-cols-[1fr_1.3fr] md:items-start md:gap-14">
          <div className="space-y-4 md:sticky md:top-24">
            <h2 className="text-2xl font-semibold tracking-tight">{active.heading}</h2>
            <p className="leading-relaxed text-muted-foreground">{active.description}</p>
          </div>
          <div className="overflow-hidden border bg-card ring-1 ring-foreground/10">
            <div className="flex items-center border-b">
              <div className="flex items-center gap-1.5 px-4">
                <span className="size-2 rounded-full bg-border" />
                <span className="size-2 rounded-full bg-border" />
                <span className="size-2 rounded-full bg-border" />
              </div>
              {codeExamples.map((example, i) => (
                <button
                  key={example.file}
                  type="button"
                  onClick={() => {
                    setActiveTab(i);
                    capture("sdk_example_selected", {
                      example_file: example.file,
                      example_index: i,
                    });
                  }}
                  className={cn(
                    "border-l px-4 py-2.5 font-mono text-xs transition-colors",
                    i === activeTab
                      ? "bg-background/50 text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {example.file}
                </button>
              ))}
            </div>
            <CodeBlock code={active.code} />
          </div>
        </div>
      </div>
    </section>
  );
}

function CtaBanner({ primaryCtaPath }: { primaryCtaPath: string }) {
  const { capture } = useAnalytics();

  return (
    <section className="border-t py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-center gap-5 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">
            Start managing secrets in minutes
          </h2>
          <p className="max-w-md text-muted-foreground">Free to start. No credit card required.</p>
          <Link
            to={primaryCtaPath}
            className={cn(buttonVariants({ size: "lg" }))}
            onClick={() => {
              capture("cta_clicked", {
                cta: "get_started",
                location: "cta_banner",
              });
            }}
          >
            Get started
            <IconArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t py-8">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <Logo className="h-4 opacity-60" />
          <span>&copy; {new Date().getFullYear()} Barekey</span>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage({
  isSignedIn,
  dashboardPath,
}: {
  isSignedIn: boolean;
  dashboardPath: string;
}) {
  const [scrolled, setScrolled] = useState(false);
  const primaryCtaPath = isSignedIn ? dashboardPath : "/auth/sso";

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 16);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen">
      <Nav scrolled={scrolled} isSignedIn={isSignedIn} dashboardPath={dashboardPath} />
      <Hero primaryCtaPath={primaryCtaPath} />
      <Bento />
      <SdkPreview />
      <CtaBanner primaryCtaPath={primaryCtaPath} />
      <Footer />
    </div>
  );
}
