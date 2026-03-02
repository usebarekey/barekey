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
import { Link, useParams } from "react-router-dom";

import { api } from "@convex/_generated/api";
import { OrgPageHero, OrgRoleBadge } from "@/components/custom/org-workspace";
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
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogInputRef = useRef<HTMLInputElement | null>(null);
  const createProject = useMutation(api.projects.createForCurrentOrg);
  const orgClaims = useQuery(api.orgs.getCurrentOrgClaims, {
    expectedOrgSlug: orgSlug,
  });
  const projects = useQuery(api.projects.listForCurrentOrg, {
    expectedOrgSlug: orgSlug,
  });

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
  const showNoProjectsEmpty =
    projects !== undefined &&
    !isMissingWorkspaceLink &&
    projects.length === 0 &&
    filteredProjects.length === 0;
  const showNoMatchesEmpty =
    projects !== undefined &&
    !isMissingWorkspaceLink &&
    projects.length > 0 &&
    filteredProjects.length === 0;
  const showEmptyState = showNoProjectsEmpty || showNoMatchesEmpty;

  function openCreateDialog() {
    if (isClaimsLoading || isMissingWorkspaceLink) {
      return;
    }

    setErrorMessage(null);
    setIsCreateDialogOpen(true);
    queueMicrotask(() => dialogInputRef.current?.focus());
  }

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
      setIsCreateDialogOpen(false);
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
            Create and manage project spaces for variables, experiments, and rollout decisions.
            Project slugs remain unique inside <span className="font-mono">/o/{orgSlug}</span>.
          </>
        }
        tags={
          <>
            <OrgRoleBadge role={orgClaims?.orgRole} />
            <Badge variant="outline">
              <IconShieldCheck />
              Workspace scoped
            </Badge>
          </>
        }
        actions={
          <>
            <Button size="sm" disabled={isClaimsLoading || isMissingWorkspaceLink} onClick={openCreateDialog}>
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
          hint={projects && projects.length > 0 ? "Live project list" : "No projects yet"}
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
          hint="People who can operate projects"
          icon={<IconUsers className="size-4" />}
        />
        <OrgMetricCard
          label="Workspace access"
          value={isClaimsLoading ? "..." : isMissingWorkspaceLink ? "Needs setup" : "Ready"}
          hint="Required before creating and listing projects"
          icon={<IconShieldCheck className="size-4" />}
          tone={isMissingWorkspaceLink ? "accent" : "muted"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <OrgSectionCard
          title="Create project"
          description="Start a new project in this workspace."
        >
          <div className="space-y-4">
            <div className="rounded-xl border bg-background/70 p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">Slug policy</Badge>
                <span>Generated from the project name with a short numeric suffix</span>
              </div>
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                Example: <span className="text-foreground">secrets-api-4821</span>
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Input
                ref={inputRef}
                value={name}
                disabled={isSubmitting || isClaimsLoading || isMissingWorkspaceLink}
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
                  Workspace setup is incomplete. Review advanced diagnostics in settings before
                  creating projects.
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
          title="Project index"
          description="Search and inspect project slugs in this workspace."
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
            ) : isMissingWorkspaceLink ? (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                Project listing is unavailable until workspace setup is complete.
              </div>
            ) : projects.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <IconBriefcase />
                  </EmptyMedia>
                  <EmptyTitle>{showNoProjectsEmpty ? "No projects yet" : "No matching projects"}</EmptyTitle>
                  <EmptyDescription>
                    Create your first project for <span className="font-mono">/o/{orgSlug}</span> to
                    start organizing your workspace.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent className="sm:flex-row sm:justify-center">
                  <Button
                    disabled={isSubmitting || isClaimsLoading || isMissingWorkspaceLink}
                    onClick={() => inputRef.current?.focus()}
                  >
                    <IconPlus />
                    Create project
                  </Button>
                  {projects !== undefined && projects.length > 0 && normalizedQuery.length > 0 ? (
                    <Button variant="outline" onClick={() => setSearchQuery("")}>
                      Clear search
                    </Button>
                  ) : null}
                </EmptyContent>
              </Empty>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {projects === undefined
                ? Array.from({ length: 5 }).map((_, index) => (
                    <Card key={index}>
                      <CardContent>
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="mt-2 h-3 w-32" />
                        <Skeleton className="mt-8 h-8 w-full" />
                      </CardContent>
                    </Card>
                  ))
                : null}

              {projects !== undefined && isMissingWorkspaceLink ? (
                <Card>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Project listing is unavailable until workspace access is restored.
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      nativeButton={false}
                      render={<Link to={`/o/${orgSlug}/settings#advanced-diagnostics`} />}
                      className="justify-start px-0"
                    >
                      Open diagnostics
                      <IconArrowRight />
                    </Button>
                  </CardContent>
                </Card>
              ) : null}

              {projects !== undefined && !isMissingWorkspaceLink
                ? filteredProjects.map((project) => (
                    <Card key={project.id} className="aspect-square">
                      <CardHeader>
                        <CardTitle className="line-clamp-2">{project.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{formatDateTime(project.createdAtMs)}</p>
                      </CardHeader>
                      <CardContent className="flex-1" />
                      <CardFooter>
                        <Button
                          size="sm"
                          variant="outline"
                          nativeButton={false}
                          render={<Link to={`/o/${orgSlug}/project/${project.slug}`} />}
                          className="w-full justify-between"
                        >
                          Overview
                          <IconArrowRight className="size-4" />
                        </Button>
                      </CardFooter>
                    </Card>
                  ))
                : null}
          </div>
        )}
      </div>

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
            setErrorMessage(null);
            setName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create project</DialogTitle>
            <DialogDescription>Projects are shared with your current organization.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Input
              ref={dialogInputRef}
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
            {errorMessage ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-xs text-destructive">
                {errorMessage}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button disabled={isCreateDisabled} onClick={handleCreateProject}>
              <IconPlus />
              {isSubmitting ? "Creating..." : "Create project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
