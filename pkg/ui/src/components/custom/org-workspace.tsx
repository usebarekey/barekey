import type { ReactNode } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { generateGradientDataUrl } from "@/lib/generate-gradient";

function getInitials(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");
}

function roleLabel(value: string | null | undefined): string {
  if (!value) {
    return "No role";
  }

  return value.replace(/^org:/, "").replace(/[_-]/g, " ");
}

function roleVariant(value: string | null | undefined): "secondary" | "outline" | "default" {
  if (value === "org:admin") {
    return "default";
  }

  if (value === "org:member") {
    return "secondary";
  }

  return "outline";
}

export function OrgIdentityChip({
  orgSlug,
  orgName,
  imageUrl,
  seed,
}: {
  orgSlug: string;
  orgName?: string | null;
  imageUrl?: string | null;
  seed?: string | null;
}) {
  const displayName = orgName?.trim() || orgSlug;
  const normalizedImageUrl = imageUrl?.trim() ?? "";
  const avatarSrc =
    normalizedImageUrl.length > 0
      ? normalizedImageUrl
      : generateGradientDataUrl(seed ?? orgSlug, { size: 96 });

  return (
    <div className="inline-flex items-center gap-3 rounded-xl border bg-background/80 px-3 py-2 shadow-xs backdrop-blur-sm">
      <Avatar size="lg">
        <AvatarImage src={avatarSrc} />
        <AvatarFallback>{getInitials(displayName) || "OR"}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{displayName}</p>
        <p className="truncate font-mono text-xs text-muted-foreground">@{orgSlug}</p>
      </div>
    </div>
  );
}

export function OrgRoleBadge({ role }: { role: string | null | undefined }) {
  return <Badge variant={roleVariant(role)}>{roleLabel(role)}</Badge>;
}

export function OrgPageHero({
  title,
  subtitle,
  tags,
  actions,
  className,
}: {
  title: string;
  subtitle: ReactNode;
  orgSlug: string;
  orgName?: string | null;
  imageUrl?: string | null;
  imageSeed?: string | null;
  tags?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card shadow-xs",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_10%_20%,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_55%)]",
        "after:pointer-events-none after:absolute after:inset-0 after:bg-[radial-gradient(circle_at_85%_15%,color-mix(in_oklab,var(--foreground)_7%,transparent),transparent_45%)]",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(to right, color-mix(in oklab, var(--border) 55%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--border) 55%, transparent) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(circle at center, black 48%, transparent 100%)",
        }}
      />
      <div className="relative flex flex-col gap-6 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-3 self-stretch sm:items-end">
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export function OrgMetricCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "accent" | "muted";
}) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden",
        tone === "accent" &&
          "border-primary/30 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_10%,transparent),transparent_55%)]",
        tone === "muted" && "bg-muted/35",
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardDescription>{label}</CardDescription>
          {icon ? <div className="text-muted-foreground">{icon}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export function OrgSectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
