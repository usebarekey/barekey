import { useAction, useQuery } from "convex/react";
import {
  IconArrowUpRight,
  IconArrowRight,
  IconBolt,
  IconCpu,
  IconDatabase,
} from "@tabler/icons-react";
import { useOrganization } from "@clerk/react-router";
import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";

import { api } from "@convex/_generated/api";
import {
  OrgMetricCard,
  OrgPageHero,
  OrgRoleBadge,
  OrgSectionCard,
} from "@/components/custom/org-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function Page() {
  const { orgSlug = "org" } = useParams();
  const orgClaims = useQuery(api.orgs.getCurrentOrgClaims, {
    expectedOrgSlug: orgSlug,
  });
  const projects = useQuery(api.projects.listForCurrentOrg, {
    expectedOrgSlug: orgSlug,
  });
  const getWorkspacePlanStatus = useAction(api.payments.getWorkspacePlanStatusForCurrentOrg);
  const [isWorkspacePlanless, setIsWorkspacePlanless] = useState(false);
  const [isWorkspaceBillingUnavailable, setIsWorkspaceBillingUnavailable] = useState(false);
  const { organization } = useOrganization();
  const recentProjects = (projects ?? []).slice(0, 5);
  const isOrgClaimsLoading = orgClaims === undefined;

  useEffect(() => {
    const orgLabel = organization?.name?.trim() || orgSlug;
    document.title = `${orgLabel} · Overview`;
  }, [organization?.name, orgSlug]);

  useEffect(() => {
    let cancelled = false;
    void getWorkspacePlanStatus({
      expectedOrgSlug: orgSlug,
    })
      .then((result) => {
        if (!cancelled) {
          setIsWorkspacePlanless(result.isPlanless);
          setIsWorkspaceBillingUnavailable(result.billingUnavailable);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsWorkspacePlanless(false);
          setIsWorkspaceBillingUnavailable(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [getWorkspacePlanStatus, orgSlug]);

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
              <Badge variant="outline">Loading role...</Badge>
            ) : (
              <OrgRoleBadge role={orgClaims.orgRole} />
            )}
            {isWorkspacePlanless ? <Badge variant="outline">Workspace without a plan</Badge> : null}
          </>
        }
      />

      {isWorkspacePlanless ? (
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
        <OrgMetricCard
          label="Static Requests"
          value="0"
          hint="Usage limits tracking soon"
          icon={<IconBolt className="size-4" />}
        />
        <OrgMetricCard
          label="Dynamic Requests"
          value="0"
          hint="Usage limits tracking soon"
          icon={<IconCpu className="size-4" />}
        />
        <OrgMetricCard
          label="Storage"
          value="0 MB"
          hint="Usage limits tracking soon"
          icon={<IconDatabase className="size-4" />}
        />
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
          description="Scaffolded feed for org and project activity (implementation pending)."
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-dashed bg-background/70 p-3">
              <p className="org-kicker text-muted-foreground">Scaffold</p>
              <p className="mt-2 text-sm text-muted-foreground">
                This panel will show an audit trail for key actions like project creation, secret
                changes, stage updates, membership changes, and access-sensitive operations.
              </p>
            </div>

            <div className="rounded-xl border bg-background/70 p-3">
              <p className="org-kicker text-muted-foreground">Preview events</p>
              <div className="mt-2 space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="rounded-md border bg-background/50 p-2">
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="mt-2 h-2.5 w-1/3" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </OrgSectionCard>
      </div>
    </div>
  );
}
