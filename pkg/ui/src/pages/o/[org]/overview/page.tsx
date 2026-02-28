import { useQuery } from "convex/react";
import {
  IconArrowRight,
  IconBriefcase,
  IconUsers,
} from "@tabler/icons-react";
import { useOrganization } from "@clerk/react-router";
import { Link, useParams } from "react-router-dom";

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

function formatDateTime(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function Page() {
  const { orgSlug = "org" } = useParams();
  const orgClaims = useQuery(api.orgs.getCurrentOrgClaims, {
    expectedOrgSlug: orgSlug,
  });
  const projects = useQuery(api.projects.listForCurrentOrg, {
    expectedOrgSlug: orgSlug,
  });
  const { organization, memberships, invitations } = useOrganization({
    memberships: {
      pageSize: 8,
      keepPreviousData: true,
    },
    invitations: {
      pageSize: 8,
      keepPreviousData: true,
    },
  });

  const recentProjects = (projects ?? []).slice(0, 5);
  const projectCount = projects?.length ?? 0;
  const memberCount = memberships?.count ?? 0;
  const inviteCount = invitations?.count ?? 0;
  const isOrgClaimsLoading = orgClaims === undefined;
  const isMissingWorkspaceLink =
    orgClaims !== undefined && orgClaims.isSignedIn && orgClaims.orgId === null;

  return (
    <div className="space-y-6">
      <OrgPageHero
        title="Workspace overview"
        orgSlug={orgSlug}
        orgName={organization?.name}
        imageUrl={organization?.imageUrl}
        imageSeed={organization?.id}
        subtitle={<>Track projects and team access from one place.</>}
        tags={
          <>
            {isOrgClaimsLoading ? (
              <Badge variant="outline">Loading role...</Badge>
            ) : (
              <OrgRoleBadge role={orgClaims.orgRole} />
            )}
          </>
        }
        actions={
          <>
            <Button size="sm" nativeButton={false} render={<Link to={`/o/${orgSlug}/projects`} />}>
              <IconBriefcase />
              Open projects
            </Button>
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link to={`/o/${orgSlug}/members`} />}
            >
              <IconUsers />
              Manage team
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <OrgMetricCard
          label="Projects"
          value={projects === undefined ? "..." : projectCount}
          hint={
            projectCount > 0 && projects
              ? `Latest: ${projects[0]?.name ?? "n/a"}`
              : "Create your first project."
          }
          icon={<IconBriefcase className="size-4" />}
          tone="accent"
        />
        <OrgMetricCard
          label="Team access"
          value={memberships && invitations ? memberCount : "..."}
          hint={
            invitations
              ? `${inviteCount} pending invite${inviteCount === 1 ? "" : "s"}`
              : "Loading team access"
          }
          icon={<IconUsers className="size-4" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <OrgSectionCard
          title="Recent projects"
          description="Your latest project spaces."
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
              No projects yet. Create one in the Projects page to get started.
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
                    <p className="min-w-0 truncate text-sm font-medium">{project.name}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(project.createdAtMs)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </OrgSectionCard>

        <OrgSectionCard
          title="Team access"
          description="Keep your workspace members and invites up to date."
          action={
            <Button
              size="sm"
              variant="ghost"
              nativeButton={false}
              render={<Link to={`/o/${orgSlug}/members`} />}
            >
              Open members
              <IconArrowRight />
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border bg-background/70 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Members</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">
                  {memberships ? memberCount : "..."}
                </p>
              </div>
              <div className="rounded-xl border bg-background/70 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Pending invites</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">
                  {invitations ? inviteCount : "..."}
                </p>
              </div>
            </div>

            {isMissingWorkspaceLink ? (
              <div className="rounded-xl border border-dashed p-3">
                <p className="text-sm text-muted-foreground">
                  Workspace details are temporarily unavailable. Open diagnostics for troubleshooting.
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  nativeButton={false}
                  render={<Link to={`/o/${orgSlug}/settings#advanced-diagnostics`} />}
                  className="mt-2 h-7 px-2"
                >
                  Open diagnostics
                  <IconArrowRight />
                </Button>
              </div>
            ) : null}
          </div>
        </OrgSectionCard>
      </div>
    </div>
  );
}
