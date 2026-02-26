import { useMutation, useQuery } from "convex/react";
import { useRef, useState } from "react";

import {
  IconArrowRight,
  IconBriefcase,
  IconFolderPlus,
  IconPlus,
  IconSearch,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "Unable to create project.";
}

function formatDateTime(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function Page() {
  const { orgSlug = "org" } = useParams();
  const [name, setName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const createProject = useMutation(api.projects.createForCurrentOrg);
  const orgClaims = useQuery(api.orgs.getCurrentOrgClaims, {
    expectedOrgSlug: orgSlug,
  });
  const projects = useQuery(api.projects.listForCurrentOrg, {
    expectedOrgSlug: orgSlug,
  });
  const { organization, memberships } = useOrganization({
    memberships: {
      pageSize: 10,
      keepPreviousData: true,
    },
  });

  const isClaimsLoading = orgClaims === undefined;
  const isMissingOrgClaims =
    orgClaims !== undefined && orgClaims.isSignedIn && orgClaims.orgId === null;
  const isCreateDisabled =
    isSubmitting || isClaimsLoading || isMissingOrgClaims || name.trim().length === 0;
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredProjects = (projects ?? []).filter((project) => {
    if (normalizedQuery.length === 0) {
      return true;
    }

    return `${project.name} ${project.slug}`.toLowerCase().includes(normalizedQuery);
  });
  const latestProject = projects?.[0] ?? null;

  async function handleCreateProject() {
    const trimmedName = name.trim();
    if (trimmedName.length === 0 || isSubmitting || isClaimsLoading || isMissingOrgClaims) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await createProject({
        expectedOrgSlug: orgSlug,
        name: trimmedName,
      });
      setName("");
      inputRef.current?.focus();
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <OrgPageHero
        title="Projects"
        orgSlug={orgSlug}
        orgName={organization?.name}
        imageUrl={organization?.imageUrl}
        imageSeed={organization?.id}
        subtitle={
          <>
            Build the inventory of apps and environments that inherit this workspace’s org-scoped
            access controls. Each project slug is unique within <span className="font-mono">@{orgSlug}</span>.
          </>
        }
        tags={
          <>
            <OrgRoleBadge role={orgClaims?.orgRole} />
            <Badge variant="outline">
              <IconShieldCheck />
              Org-scoped
            </Badge>
          </>
        }
        actions={
          <>
            <Button size="sm" onClick={() => inputRef.current?.focus()}>
              <IconFolderPlus />
              New project
            </Button>
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link to={`/o/${orgSlug}/members`} />}
            >
              <IconUsers />
              Members
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OrgMetricCard
          label="Total projects"
          value={projects === undefined ? "..." : projects.length}
          hint={projects && projects.length > 0 ? "Reactive Convex list" : "No projects yet"}
          icon={<IconBriefcase className="size-4" />}
          tone="accent"
        />
        <OrgMetricCard
          label="Latest project"
          value={latestProject ? latestProject.name : projects ? "None" : "..."}
          hint={latestProject ? latestProject.slug : "Create your first project"}
          icon={<IconArrowRight className="size-4" />}
        />
        <OrgMetricCard
          label="Member coverage"
          value={memberships ? memberships.count : "..."}
          hint="People with org access who may operate projects"
          icon={<IconUsers className="size-4" />}
        />
        <OrgMetricCard
          label="Claim status"
          value={isClaimsLoading ? "..." : isMissingOrgClaims ? "Missing org_id" : "Ready"}
          hint="Projects depend on active org claims in Convex identity"
          icon={<IconShieldCheck className="size-4" />}
          tone={isMissingOrgClaims ? "accent" : "muted"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <OrgSectionCard
          title="Create project"
          description="Projects are stored under the active organization id and displayed under the route slug."
        >
          <div className="space-y-4">
            <div className="rounded-xl border bg-background/70 p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">Slug policy</Badge>
                <span>Generated from the project name + numeric suffix</span>
              </div>
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                Example: <span className="text-foreground">secrets-api-4821</span>
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Input
                ref={inputRef}
                value={name}
                disabled={isSubmitting || isClaimsLoading || isMissingOrgClaims}
                placeholder="Project name (e.g. Secrets API)"
                onChange={(event) => setName(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleCreateProject();
                  }
                }}
              />

              <div className="flex flex-wrap items-center gap-2">
                <Button disabled={isCreateDisabled} onClick={handleCreateProject}>
                  <IconPlus />
                  {isSubmitting ? "Creating..." : "Create project"}
                </Button>
                <Button
                  variant="outline"
                  disabled={isSubmitting || isClaimsLoading || isMissingOrgClaims}
                  onClick={() => {
                    setName("");
                    setErrorMessage(null);
                    inputRef.current?.focus();
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>

            {errorMessage ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {errorMessage}
              </div>
            ) : null}

            {isMissingOrgClaims ? (
              <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                Convex identity is missing <code>org_id</code>. Add org claims to the Clerk Convex
                JWT template before using org-scoped project creation.
              </div>
            ) : null}
          </div>
        </OrgSectionCard>

        <OrgSectionCard
          title="Project index"
          description="Search and inspect project slugs inside this organization."
          action={
            <div className="text-xs text-muted-foreground">
              {projects === undefined ? "Loading..." : `${filteredProjects.length} shown`}
            </div>
          }
        >
          <div className="space-y-4">
            <div className="relative">
              <IconSearch className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.currentTarget.value)}
                placeholder="Search projects by name or slug"
                className="pl-9"
              />
            </div>

            {projects === undefined ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="rounded-xl border p-3">
                    <Skeleton className="h-4 w-44" />
                    <Skeleton className="mt-2 h-3 w-28" />
                  </div>
                ))}
              </div>
            ) : isMissingOrgClaims ? (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                Waiting for org claims in Convex identity. Listing is disabled until <code>org_id</code>{" "}
                is present.
              </div>
            ) : projects.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <IconBriefcase />
                  </EmptyMedia>
                  <EmptyTitle>No projects yet</EmptyTitle>
                  <EmptyDescription>
                    Create your first project for <span className="font-mono">@{orgSlug}</span> to
                    start organizing your workspace.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button
                    disabled={isSubmitting || isClaimsLoading || isMissingOrgClaims}
                    onClick={() => inputRef.current?.focus()}
                  >
                    <IconPlus />
                    New project
                  </Button>
                </EmptyContent>
              </Empty>
            ) : filteredProjects.length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                No projects match <span className="font-medium text-foreground">{searchQuery}</span>.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredProjects.map((project, index) => (
                  <div
                    key={project.id}
                    className="group relative overflow-hidden rounded-xl border bg-background/80 p-3"
                  >
                    <div className="absolute inset-y-0 left-0 w-1 bg-primary/15 transition-colors group-hover:bg-primary/50" />
                    <div className="ml-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {index < 3 ? (
                            <Badge variant={index === 0 ? "secondary" : "outline"}>
                              {index === 0 ? "Hot" : `#${index + 1}`}
                            </Badge>
                          ) : null}
                          <p className="truncate text-sm font-medium">{project.name}</p>
                        </div>
                        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                          {project.slug}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{formatDateTime(project.createdAtMs)}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          nativeButton={false}
                          render={<Link to={`/o/${orgSlug}/overview`} />}
                          className="h-6 px-2"
                        >
                          Workspace
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </OrgSectionCard>
      </div>
    </div>
  );
}
