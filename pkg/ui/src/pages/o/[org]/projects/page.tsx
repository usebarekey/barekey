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
        subtitle={<>Create and manage project spaces for variables and rollouts.</>}
        tags={
          <>
            <OrgRoleBadge role={orgClaims?.orgRole} />
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

        {showEmptyState ? (
          <div className="flex justify-center py-10">
            <div className="w-full max-w-lg">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <IconBriefcase />
                  </EmptyMedia>
                  <EmptyTitle>{showNoProjectsEmpty ? "No projects yet" : "No matching projects"}</EmptyTitle>
                  <EmptyDescription>
                    {showNoProjectsEmpty ? (
                      "Create your first project in this workspace."
                    ) : (
                      <>
                        No projects match <span className="font-medium text-foreground">{searchQuery}</span>.
                      </>
                    )}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent className="sm:flex-row sm:justify-center">
                  <Button
                    disabled={isClaimsLoading || isMissingWorkspaceLink}
                    onClick={openCreateDialog}
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
