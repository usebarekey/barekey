import { useMutation, useQuery } from "convex/react";
import { useRef, useState } from "react";

import {
  IconArrowRight,
  IconBriefcase,
  IconFolderPlus,
  IconPlus,
  IconSearch,
  IconUsers,
} from "@tabler/icons-react";
import { useOrganization } from "@clerk/react-router";
import { Link, useParams } from "react-router-dom";

import { api } from "@convex/_generated/api";
import {
  OrgPageHero,
  OrgRoleBadge,
  OrgSectionCard,
} from "@/components/custom/org-workspace";
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
    const normalizedMessage = error.message.toLowerCase();

    if (normalizedMessage.includes("project name")) {
      return error.message;
    }

    if (
      normalizedMessage.includes("workspace") ||
      normalizedMessage.includes("organization") ||
      normalizedMessage.includes("unauthorized")
    ) {
      return "Project actions are temporarily unavailable for this workspace. Switch workspaces and try again.";
    }
  }

  return "Unable to create project right now. Please try again.";
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
  const { organization } = useOrganization();

  const isClaimsLoading = orgClaims === undefined;
  const isMissingWorkspaceLink =
    orgClaims !== undefined && orgClaims.isSignedIn && orgClaims.orgId === null;
  const isCreateDisabled =
    isSubmitting || isClaimsLoading || isMissingWorkspaceLink || name.trim().length === 0;
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredProjects = (projects ?? []).filter((project) => {
    if (normalizedQuery.length === 0) {
      return true;
    }

    return project.name.toLowerCase().includes(normalizedQuery);
  });

  async function handleCreateProject() {
    const trimmedName = name.trim();
    if (trimmedName.length === 0 || isSubmitting || isClaimsLoading || isMissingWorkspaceLink) {
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
        subtitle={<>Create and manage project spaces for variables and rollouts.</>}
        tags={
          <>
            <OrgRoleBadge role={orgClaims?.orgRole} />
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

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <OrgSectionCard title="Create project" description="Start a new project in this workspace.">
          <div className="space-y-4">
            <div className="flex flex-col gap-3">
              <Input
                ref={inputRef}
                value={name}
                disabled={isSubmitting || isClaimsLoading || isMissingWorkspaceLink}
                placeholder="Project name"
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
                  disabled={isSubmitting || isClaimsLoading || isMissingWorkspaceLink}
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

            {isMissingWorkspaceLink ? (
              <div className="rounded-xl border border-dashed p-3">
                <p className="text-sm text-muted-foreground">
                  Project actions are temporarily unavailable for this workspace.
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

        <OrgSectionCard
          title="Project list"
          description="Search and inspect projects by name."
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
                placeholder="Search projects"
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
            ) : isMissingWorkspaceLink ? (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                Project listing is unavailable until workspace access is restored.
              </div>
            ) : projects.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <IconBriefcase />
                  </EmptyMedia>
                  <EmptyTitle>No projects yet</EmptyTitle>
                  <EmptyDescription>Create your first project in this workspace.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button
                    disabled={isSubmitting || isClaimsLoading || isMissingWorkspaceLink}
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
                {filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    className="group relative overflow-hidden rounded-xl border bg-background/80 p-3"
                  >
                    <div className="absolute inset-y-0 left-0 w-1 bg-primary/15 transition-colors group-hover:bg-primary/50" />
                    <div className="ml-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="min-w-0 truncate text-sm font-medium">{project.name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{formatDateTime(project.createdAtMs)}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          nativeButton={false}
                          render={<Link to={`/o/${orgSlug}/overview`} />}
                          className="h-6 px-2"
                        >
                          Overview
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
