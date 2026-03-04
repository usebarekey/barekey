import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { IconLock, IconFlask, IconChartLine, IconArrowRight } from "@tabler/icons-react";

import { Logo } from "@/components/custom/logo";
import { CodeBlock } from "@/components/custom/code-block";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const heroCode = `import { env } from "@barekey/sdk";

const db = env.get("DATABASE_URL");

const experiment = env.get("NEW_CHECKOUT", {
  seed: user.id,
});`;

const sdkCode = `import { env } from "@barekey/sdk";

// Known key — strongly typed
const databaseUrl = env.get("DATABASE_URL");

// Coerce and provide a default
const enableLogging = env.get("ENABLE_LOGGING")
  .coerce("boolean")
  .default(false);

// Dynamic with TTL cache and deterministic seed
const newDashboard = env.get("NEW_DASHBOARD", {
  dynamic: { ttl: 300_000 },
  seed: user.id,
});`;

const features = [
  {
    icon: IconLock,
    title: "Encrypted secrets",
    description: "Envelope encryption with per-project keys. Zero plaintext at rest.",
  },
  {
    icon: IconFlask,
    title: "A/B experiments",
    description: "Deterministic bucketing. Consistent assignment across sessions.",
  },
  {
    icon: IconChartLine,
    title: "Progressive rollouts",
    description: "Ship gradually with linear or exponential curves. Roll back instantly.",
  },
];

export function Nav({ scrolled, isSignedIn, dashboardPath }: { scrolled: boolean; isSignedIn: boolean; dashboardPath: string }) {
  return (
    <header
      className={cn(
        "fixed top-0 right-0 left-0 z-50 transition-colors duration-200",
        scrolled ? "border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80" : "bg-transparent",
      )}
    >
      <div className="mx-auto grid h-14 max-w-5xl grid-cols-[auto_1fr_auto] items-center gap-4 px-6">
        <Link to="/" className="flex items-center gap-2">
          <Logo className="h-5" />
        </Link>

        <div className="flex items-center justify-center gap-5">
          <Link to="/pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Pricing
          </Link>
          <a
            href="https://docs.barekey.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Docs
          </a>
        </div>

        <div className="justify-self-end">
          {isSignedIn ? (
            <Link to={dashboardPath} className={cn(buttonVariants({ size: "sm" }))}>
              Dashboard
            </Link>
          ) : (
            <Link to="/auth/sso" className={cn(buttonVariants({ size: "sm" }))}>
              Get started
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function Hero({ primaryCtaPath }: { primaryCtaPath: string }) {
  return (
    <section className="pt-28 pb-16 md:pt-36 md:pb-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-12">
          <div className="space-y-6">
            <p className="org-kicker text-muted-foreground">Developer infrastructure</p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Secrets, experiments, and rollouts — one&nbsp;SDK
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              Barekey gives your team encrypted environment variables, deterministic A/B bucketing, and progressive rollout curves through a single type-safe SDK.
            </p>
            <div className="flex gap-3">
              <Link to={primaryCtaPath} className={cn(buttonVariants({ size: "lg" }))}>
                Get started
                <IconArrowRight data-icon="inline-end" className="size-4" />
              </Link>
              <a
                href="https://docs.barekey.dev"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
              >
                View docs
              </a>
            </div>
          </div>
          <div className="ring-foreground/10 overflow-hidden rounded-xl bg-card ring-1">
            <div className="flex items-center gap-1.5 border-b px-4 py-2.5">
              <span className="size-2.5 rounded-full bg-border" />
              <span className="size-2.5 rounded-full bg-border" />
              <span className="size-2.5 rounded-full bg-border" />
              <span className="ml-3 text-xs text-muted-foreground font-mono">app.ts</span>
            </div>
            <CodeBlock code={heroCode} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-10 space-y-2 text-center">
          <p className="org-kicker text-muted-foreground">Core platform</p>
          <h2 className="text-2xl font-semibold tracking-tight">
            Everything your app config needs
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title}>
              <CardHeader>
                <f.icon className="size-5 text-muted-foreground mb-1" />
                <CardTitle>{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {f.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function SdkPreview() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid gap-10 md:grid-cols-[1fr_1.2fr] md:items-start md:gap-12">
          <div className="space-y-4 md:sticky md:top-24">
            <p className="org-kicker text-muted-foreground">Type-safe SDK</p>
            <h2 className="text-2xl font-semibold tracking-tight">
              One import, full control
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Coerce values, set defaults, add TTL caching, and seed experiments — all
              from a single <code className="font-mono text-foreground text-sm">env.get()</code> call.
            </p>
          </div>
          <div className="ring-foreground/10 overflow-hidden rounded-xl bg-card ring-1">
            <div className="flex items-center gap-1.5 border-b px-4 py-2.5">
              <span className="size-2.5 rounded-full bg-border" />
              <span className="size-2.5 rounded-full bg-border" />
              <span className="size-2.5 rounded-full bg-border" />
              <span className="ml-3 text-xs text-muted-foreground font-mono">config.ts</span>
            </div>
            <CodeBlock code={sdkCode} />
          </div>
        </div>
      </div>
    </section>
  );
}

function CtaBanner({ primaryCtaPath }: { primaryCtaPath: string }) {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="flex flex-col items-center gap-6 text-center">
          <Separator className="mb-6" />
          <h2 className="text-2xl font-semibold tracking-tight">
            Ready to ship with confidence?
          </h2>
          <p className="text-muted-foreground max-w-md">
            Get started with encrypted secrets, experiments, and rollouts in minutes.
          </p>
          <Link to={primaryCtaPath} className={cn(buttonVariants({ size: "lg" }))}>
            Get started free
            <IconArrowRight data-icon="inline-end" className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t py-8">
      <div className="mx-auto max-w-5xl px-6">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <Logo className="h-4 opacity-60" />
          <span>&copy; {new Date().getFullYear()} Barekey</span>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage({ isSignedIn, dashboardPath }: { isSignedIn: boolean; dashboardPath: string }) {
  const [scrolled, setScrolled] = useState(false);
  const primaryCtaPath = isSignedIn ? dashboardPath : "/auth/sso";

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 16);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen">
      <Nav scrolled={scrolled} isSignedIn={isSignedIn} dashboardPath={dashboardPath} />
      <Hero primaryCtaPath={primaryCtaPath} />
      <Features />
      <SdkPreview />
      <CtaBanner primaryCtaPath={primaryCtaPath} />
      <Footer />
    </div>
  );
}
