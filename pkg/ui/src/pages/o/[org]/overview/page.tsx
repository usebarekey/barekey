import { useQuery } from "convex/react";
import {
  IconArrowRight,
  IconBellRinging,
  IconBriefcase,
  IconShieldCheck,
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
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { generateGradientDataUrl } from "@/lib/generate-gradient";
import { displayName, initials } from "@/lib/org-utils";

function formatDateTime(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatRole(role: string | null | undefined): string {
  if (!role) {
    return "No role";
  }

  return role.replace(/^org:/, "");
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

  const members = memberships?.data ?? [];
  const invites = invitations?.data ?? [];
  const recentProjects = (projects ?? []).slice(0, 5);
  const memberCount = memberships?.count ?? members.length;
  const inviteCount = invitations?.count ?? invites.length;
  const projectCount = projects?.length ?? 0;
  const isOrgClaimsLoading = orgClaims === undefined;
  const hasWorkspaceLink = orgClaims?.orgId != null;
  const routeMatchesWorkspace = orgClaims?.routeMatchesActiveOrg ?? false;
  const sessionReady = orgClaims?.isSignedIn ?? false;
  const setupChecks = isOrgClaimsLoading
    ? null
    : [sessionReady, hasWorkspaceLink, routeMatchesWorkspace, projectCount > 0, memberCount > 0];
  const setupPercent =
    setupChecks === null
      ? null
      : Math.round((setupChecks.filter(Boolean).length / setupChecks.length) * 100);

  return (
    <div className="space-y-6">
      <OrgPageHero
        title="Workspace Overview"
        orgSlug={orgSlug}
        orgName={organization?.name}
        imageUrl={organization?.imageUrl}
        imageSeed={organization?.id}
        subtitle={
          <>
            Track project momentum, team access, and workspace setup in one place before you ship
            changes.
          </>
        }
        tags={
          <>
            {isOrgClaimsLoading ? (
              <Badge variant="outline">Checking workspace...</Badge>
            ) : (
              <OrgRoleBadge role={orgClaims.orgRole} />
            )}
            {isOrgClaimsLoading ? (
              <Badge variant="outline">Syncing...</Badge>
            ) : (
              <Badge variant={hasWorkspaceLink && routeMatchesWorkspace ? "secondary" : "outline"}>
                {hasWorkspaceLink && routeMatchesWorkspace ? "Ready" : "Needs setup"}
              </Badge>
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
              Review members
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OrgMetricCard
          label="Projects"
          value={projects === undefined ? "..." : projectCount}
          hint={
            projectCount > 0 && projects
              ? `Latest: ${projects[0]?.name ?? "n/a"}`
              : "Create the first project to start organizing variables."
          }
          icon={<IconBriefcase className="size-4" />}
          tone="accent"
        />
        <OrgMetricCard
          label="Members"
          value={memberships ? memberCount : "..."}
          hint="People with access to this workspace"
          icon={<IconUsers className="size-4" />}
        />
        <OrgMetricCard
          label="Pending invites"
          value={invitations ? inviteCount : "..."}
          hint={inviteCount > 0 ? "Follow up on pending invites" : "No pending invites"}
          icon={<IconBellRinging className="size-4" />}
          tone={inviteCount > 0 ? "accent" : "muted"}
        />
        <OrgMetricCard
          label="Workspace setup"
          value={setupPercent === null ? "..." : `${setupPercent}%`}
          hint={
            isOrgClaimsLoading
              ? "Running setup checks..."
              : `Current role: ${formatRole(orgClaims.orgRole)}`
          }
          icon={<IconShieldCheck className="size-4" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.85fr]">
        <OrgSectionCard
          title="Recent projects"
          description="Newest projects in this workspace."
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
              No projects yet. Create one in the Projects page to start organizing environments.
            </div>
          ) : (
            <div className="space-y-2">
              {recentProjects.map((project, index) => (
                <div
                  key={project.id}
                  className="group relative overflow-hidden rounded-xl border bg-background/80 p-3"
                >
                  <div className="absolute inset-y-0 left-0 w-1 bg-primary/25 transition-colors group-hover:bg-primary/60" />
                  <div className="ml-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant={index === 0 ? "secondary" : "outline"}>
                          {index === 0 ? "Newest" : `#${index + 1}`}
                        </Badge>
                        <p className="truncate text-sm font-medium">{project.name}</p>
                      </div>
                      <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                        {project.slug}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDateTime(project.createdAtMs)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </OrgSectionCard>

        <div className="space-y-4">
          <OrgSectionCard
            title="Workspace health"
            description="Quick checks to keep day-to-day work moving."
          >
            <div className="space-y-4">
              <div className="rounded-xl border bg-background/70 p-3">
                <Progress value={setupPercent ?? 0}>
                  <ProgressLabel>Setup progress</ProgressLabel>
                  <span className="text-muted-foreground ml-auto text-sm tabular-nums">
                    {setupPercent === null ? "..." : `${setupPercent}%`}
                  </span>
                </Progress>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <span className="text-sm">Signed-in session</span>
                  <Badge variant={isOrgClaimsLoading ? "outline" : sessionReady ? "secondary" : "outline"}>
                    {isOrgClaimsLoading ? "Loading" : sessionReady ? "Ready" : "Pending"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <span className="text-sm">Workspace link</span>
                  <Badge
                    variant={isOrgClaimsLoading ? "outline" : hasWorkspaceLink ? "secondary" : "outline"}
                  >
                    {isOrgClaimsLoading ? "Loading" : hasWorkspaceLink ? "Ready" : "Needs setup"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <span className="text-sm">Route alignment</span>
                  <Badge
                    variant={
                      isOrgClaimsLoading ? "outline" : routeMatchesWorkspace ? "secondary" : "outline"
                    }
                  >
                    {isOrgClaimsLoading ? "Loading" : routeMatchesWorkspace ? "Matched" : "Pending"}
                  </Badge>
                </div>
              </div>
            </div>
          </OrgSectionCard>

          <OrgSectionCard
            title="Team snapshot"
            description="Quick glance at current access and pending invites."
            action={
              <Button
                size="sm"
                variant="ghost"
                nativeButton={false}
                render={<Link to={`/o/${orgSlug}/members`} />}
              >
                Manage
                <IconArrowRight />
              </Button>
            }
          >
            <div className="space-y-4">
              <div className="rounded-xl border bg-background/70 p-3">
                <p className="mb-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Active members
                </p>
                {memberships === null ? (
                  <p className="text-sm text-muted-foreground">No organization selected.</p>
                ) : memberships?.isLoading ? (
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-20 rounded-full" />
                    <Skeleton className="h-8 w-24 rounded-full" />
                    <Skeleton className="h-8 w-16 rounded-full" />
                  </div>
                ) : members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No members loaded yet.</p>
                ) : (
                  <div className="space-y-3">
                    <AvatarGroup>
                      {members.slice(0, 4).map((member) => {
                        const publicUserData = member.publicUserData;
                        const name = displayName({
                          firstName: publicUserData?.firstName ?? null,
                          lastName: publicUserData?.lastName ?? null,
                          identifier: publicUserData?.identifier ?? "member",
                        });
                        const avatarSrc =
                          publicUserData?.imageUrl ??
                          generateGradientDataUrl(publicUserData?.userId ?? member.id);

                        return (
                          <Avatar key={member.id}>
                            <AvatarImage src={avatarSrc} />
                            <AvatarFallback>{initials(name) || "MB"}</AvatarFallback>
                          </Avatar>
                        );
                      })}
                      {memberCount > 4 ? <AvatarGroupCount>+{memberCount - 4}</AvatarGroupCount> : null}
                    </AvatarGroup>

                    <div className="space-y-1">
                      {members.slice(0, 3).map((member) => {
                        const publicUserData = member.publicUserData;
                        const name = displayName({
                          firstName: publicUserData?.firstName ?? null,
                          lastName: publicUserData?.lastName ?? null,
                          identifier: publicUserData?.identifier ?? "member",
                        });

                        return (
                          <div key={member.id} className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm">{name}</p>
                            <OrgRoleBadge role={member.role} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl border bg-background/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Invite queue</p>
                  <Badge variant={inviteCount > 0 ? "secondary" : "outline"}>{inviteCount} pending</Badge>
                </div>
                <div className="mt-2 space-y-1">
                  {invites.slice(0, 3).map((invite) => (
                    <div key={invite.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{invite.emailAddress}</span>
                      <Badge variant="outline">{invite.roleName || invite.role}</Badge>
                    </div>
                  ))}
                  {inviteCount === 0 ? (
                    <p className="text-sm text-muted-foreground">No pending invitations.</p>
                  ) : null}
                </div>
              </div>

              {orgClaims && !hasWorkspaceLink ? (
                <div className="rounded-xl border border-dashed p-3">
                  <p className="text-sm text-muted-foreground">
                    Workspace setup is incomplete. Open settings if project data is unavailable.
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
    </div>
  );
}
