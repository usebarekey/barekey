import { useAction, useQuery } from "convex/react";
import {
  IconArrowUpRight,
  IconArrowRight,
  IconBolt,
  IconCpu,
  IconDatabase,
  IconHistory,
} from "@tabler/icons-react";
import { useOrganization } from "@clerk/react-router";
import { Link, useParams } from "react-router-dom";
import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from "react";

import { api } from "@convex/_generated/api";
import { AuditFeed } from "@/components/custom/audit-feed";
import {
  OrgMetricCard,
  OrgPageHero,
  OrgRoleBadge,
  OrgSectionCard,
} from "@/components/custom/org-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonPlaceholder } from "@/components/ui/skeleton-placeholder";
import type { AuditEventRow } from "@/lib/audit";
import {
  formatOverageHint,
  formatUsageProgress,
} from "@/lib/billing-display";

type OverviewBillingState = {
  currentTier: "free" | "pro" | "max" | null;
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
};

class AuditPreviewErrorBoundary extends Component<
  {
    children: ReactNode;
    fallback: ReactNode;
  },
  {
    hasError: boolean;
  }
> {
  state = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {}

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

function AuditPreviewSection({ orgSlug }: { orgSlug: string }) {
  const previewAuditEvents = useQuery(api.audit.getPreviewEventsForCurrentOrg, {
    expectedOrgSlug: orgSlug,
    limit: 6,
  }) as Array<AuditEventRow> | undefined;

  return (
    <AuditFeed
      events={previewAuditEvents ?? []}
      isLoading={previewAuditEvents === undefined}
      compact
    />
  );
}

function OverviewMetricCardSkeleton({
  label,
  icon,
}: {
  label: string;
  icon: ReactNode;
}) {
  return (
    <OrgMetricCard
      label={label}
      icon={icon}
      value={
        <SkeletonPlaceholder
          className="block rounded-lg"
          content={<span className="text-2xl font-semibold tracking-tight">88,888 / 999,999</span>}
        />
      }
      hint={
        <SkeletonPlaceholder
          className="inline-block rounded-md"
          content={<span className="text-xs text-muted-foreground">Overages enabled</span>}
        />
      }
    />
  );
}

export function Page() {
  const { orgSlug = "org" } = useParams();
  const orgClaims = useQuery(api.orgs.getCurrentOrgClaims, {
    expectedOrgSlug: orgSlug,
  });
  const projects = useQuery(api.projects.listForCurrentOrg, {
    expectedOrgSlug: orgSlug,
  });
  const getBillingState = useAction(api.payments.getBillingStateForCurrentOrg);
  const [isWorkspacePlanless, setIsWorkspacePlanless] = useState(false);
  const [isWorkspaceBillingUnavailable, setIsWorkspaceBillingUnavailable] = useState(false);
  const [billingState, setBillingState] = useState<OverviewBillingState | null>(null);
  const { organization } = useOrganization();
  const recentProjects = (projects ?? []).slice(0, 5);
  const isOrgClaimsLoading = orgClaims === undefined;
  const isBillingLoading = billingState === null && !isWorkspaceBillingUnavailable;

  useEffect(() => {
    const orgLabel = organization?.name?.trim() || orgSlug;
    document.title = `${orgLabel} · Overview`;
  }, [organization?.name, orgSlug]);

  useEffect(() => {
    let cancelled = false;
    void getBillingState({
      expectedOrgSlug: orgSlug,
    })
      .then((result) => {
        if (!cancelled) {
          setBillingState(result);
          setIsWorkspacePlanless(result.currentTier === null);
          setIsWorkspaceBillingUnavailable(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBillingState(null);
          setIsWorkspacePlanless(false);
          setIsWorkspaceBillingUnavailable(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [getBillingState, orgSlug]);

  const storageUsage = billingState?.usage.storageBytes.usage ?? billingState?.storageMirrorBytes ?? null;

  return (
    <div className="space-y-6">
      <OrgPageHero
        title="Overview"
        orgSlug={orgSlug}
        orgName={organization?.name}
        imageUrl={organization?.imageUrl}
        imageSeed={organization?.id}
        subtitle={
          <>
            Track projects, team access, and pending invites from one place. All values reflect the
            last 24 hours.
          </>
        }
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
            {isBillingLoading ? (
              <SkeletonPlaceholder
                className="inline-block rounded-md align-middle"
                content={<Badge variant="outline">Workspace without a plan</Badge>}
              />
            ) : isWorkspacePlanless ? (
              <Badge variant="outline">Workspace without a plan</Badge>
            ) : null}
          </>
        }
      />

      {isBillingLoading ? (
        <div className="rounded-xl border border-dashed p-4">
          <div className="flex flex-wrap items-center gap-3">
            <SkeletonPlaceholder
              className="inline-block flex-1 rounded-md"
              content={
                <p className="text-sm text-muted-foreground">
                  This workspace is without a plan and currently disabled for project creation.
                </p>
              }
            />
            <SkeletonPlaceholder
              className="inline-block rounded-md"
              content={<Button size="sm" variant="outline">Choose billing plan</Button>}
            />
          </div>
        </div>
      ) : isWorkspacePlanless ? (
        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          This workspace is without a plan and currently disabled for project creation.
          <Button
            size="sm"
            variant="outline"
            className="ml-3"
            nativeButton={false}
            render={<Link to={`/o/${orgSlug}/billing`} />}
          >
            Choose billing plan
          </Button>
        </div>
      ) : null}
      {!isWorkspacePlanless && isWorkspaceBillingUnavailable ? (
        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Billing status is temporarily unavailable.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        {isBillingLoading ? (
          <>
            <OverviewMetricCardSkeleton
              label="Static Requests"
              icon={<IconBolt className="size-4" />}
            />
            <OverviewMetricCardSkeleton
              label="Dynamic Requests"
              icon={<IconCpu className="size-4" />}
            />
            <OverviewMetricCardSkeleton
              label="Storage"
              icon={<IconDatabase className="size-4" />}
            />
          </>
        ) : (
          <>
            <OrgMetricCard
              label="Static Requests"
              value={
                isWorkspaceBillingUnavailable
                  ? "Unavailable"
                  : isWorkspacePlanless
                    ? "Without a plan"
                    : formatUsageProgress(
                        billingState?.usage.staticRequests.usage ?? null,
                        billingState?.usage.staticRequests.includedUsage ?? null,
                        "requests",
                      )
              }
              hint={
                isWorkspaceBillingUnavailable
                  ? "Usage unavailable"
                  : isWorkspacePlanless
                    ? "Usage disabled"
                    : formatOverageHint(billingState?.usage.staticRequests.overageAllowed)
              }
              icon={<IconBolt className="size-4" />}
            />
            <OrgMetricCard
              label="Dynamic Requests"
              value={
                isWorkspaceBillingUnavailable
                  ? "Unavailable"
                  : isWorkspacePlanless
                    ? "Without a plan"
                    : formatUsageProgress(
                        billingState?.usage.dynamicRequests.usage ?? null,
                        billingState?.usage.dynamicRequests.includedUsage ?? null,
                        "requests",
                      )
              }
              hint={
                isWorkspaceBillingUnavailable
                  ? "Usage unavailable"
                  : isWorkspacePlanless
                    ? "Usage disabled"
                    : formatOverageHint(billingState?.usage.dynamicRequests.overageAllowed)
              }
              icon={<IconCpu className="size-4" />}
            />
            <OrgMetricCard
              label="Storage"
              value={
                isWorkspaceBillingUnavailable
                  ? "Unavailable"
                  : isWorkspacePlanless
                    ? "Without a plan"
                    : formatUsageProgress(
                        storageUsage,
                        billingState?.usage.storageBytes.includedUsage ?? null,
                        "bytes",
                      )
              }
              hint={
                isWorkspaceBillingUnavailable
                  ? "Usage unavailable"
                  : isWorkspacePlanless
                    ? "Usage disabled"
                    : formatOverageHint(billingState?.usage.storageBytes.overageAllowed)
              }
              icon={<IconDatabase className="size-4" />}
            />
          </>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.85fr]">
        <OrgSectionCard
          title="Recent projects"
          description="Your latest projects."
          action={
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link to={`/o/${orgSlug}/projects`} />}
            >
              View all
              <IconArrowRight />
            </Button>
          }
        >
          {projects === undefined ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-xl border p-3">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="mt-2 h-3 w-28" />
                </div>
              ))}
            </div>
          ) : recentProjects.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              No projects yet. Create one in the Projects page to start organizing variables.
            </div>
          ) : (
            <div className="space-y-2">
              {recentProjects.map((project) => (
                <div
                  key={project.id}
                  className="group relative overflow-hidden rounded-xl border bg-background/80 p-3"
                >
                  <div className="absolute inset-y-0 left-0 w-1 bg-primary/25 transition-colors group-hover:bg-primary/60" />
                  <div className="ml-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{project.name}</p>
                      <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                        {project.slug}
                      </p>
                    </div>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link to={`/o/${orgSlug}/project/${project.slug}`} />}
                      aria-label={`Open ${project.name}`}
                    >
                      <IconArrowUpRight />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </OrgSectionCard>

        <OrgSectionCard
          title="Audit log"
          description="Recent workspace activity across projects, members, schedules, billing, and automation."
          action={
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link to={`/o/${orgSlug}/audit`} />}
            >
              View all
              <IconHistory className="size-4" />
            </Button>
          }
        >
          <AuditPreviewErrorBoundary
            fallback={
              <div className="rounded-xl border border-dashed p-4">
                <SkeletonPlaceholder
                  className="inline-block rounded-md"
                  content={
                    <p className="text-sm text-muted-foreground">
                      Audit activity is temporarily unavailable.
                    </p>
                  }
                />
              </div>
            }
          >
            <AuditPreviewSection orgSlug={orgSlug} />
          </AuditPreviewErrorBoundary>
        </OrgSectionCard>
      </div>
    </div>
  );
}
