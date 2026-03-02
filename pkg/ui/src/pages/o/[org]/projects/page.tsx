import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";

import {
  IconArrowRight,
  IconBriefcase,
  IconPlus,
  IconSearch,
  IconSettings,
} from "@tabler/icons-react";
import { useOrganization } from "@clerk/react-router";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { api } from "@convex/_generated/api";
import {
  OrgPageHero,
  OrgRoleBadge,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardFooter, CardTitle } from "@/components/ui/card";
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

export function Page() {
  const { orgSlug = "org" } = useParams();
  const [name, setName] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogInputRef = useRef<HTMLInputElement | null>(null);
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

  useEffect(() => {
    const orgLabel = organization?.name?.trim() || orgSlug;
    document.title = `${orgLabel} · Projects`;
  }, [organization?.name, orgSlug]);

  function openCreateDialog() {
    if (isClaimsLoading || isMissingWorkspaceLink) {
      return;
    }

    setIsCreateDialogOpen(true);
    queueMicrotask(() => dialogInputRef.current?.focus());
  }

  async function handleCreateProject() {
    const trimmedName = name.trim();
    if (trimmedName.length === 0 || isSubmitting || isClaimsLoading || isMissingWorkspaceLink) {
      return;
    }

    setIsSubmitting(true);

    try {
      await createProject({
        expectedOrgSlug: orgSlug,
        name: trimmedName,
      });
      setName("");
      setIsCreateDialogOpen(false);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
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
          </>
        }
        tags={
          <>
            <OrgRoleBadge role={orgClaims?.orgRole} />
          </>
        }
      />

      <div>
        <Card className="overflow-hidden">
          <CardContent>
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
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Card key={index} className="flex aspect-square flex-col overflow-hidden">
                    <CardContent className="flex flex-1 items-start justify-start">
                      <div className="space-y-1">
                        <Skeleton className="h-5 w-28" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Skeleton className="h-8 w-full" />
                    </CardFooter>
                  </Card>
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
                  <EmptyTitle>{showNoProjectsEmpty ? "No projects yet" : "No matching projects"}</EmptyTitle>
                  <EmptyDescription>
                    Create your first project in this workspace.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent className="sm:flex-row sm:justify-center">
                  <Button
                    disabled={isSubmitting || isClaimsLoading || isMissingWorkspaceLink}
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
            ) : filteredProjects.length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                No projects match <span className="font-medium text-foreground">{searchQuery}</span>.
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {filteredProjects.map((project) => (
                  <Card
                    key={project.id}
                    className="group relative flex aspect-square flex-col overflow-hidden"
                  >
                    <CardContent className="flex flex-1 items-start justify-start">
                      <div className="space-y-0 text-left">
                        <CardTitle className="line-clamp-2 text-base">{project.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {project.secretCount} secret{project.secretCount === 1 ? "" : "s"}
                        </p>
                      </div>
                    </CardContent>
                    <CardFooter className="gap-2">
                      <Button
                        size="sm"
                        nativeButton={false}
                        render={<Link to={`/o/${orgSlug}/project/${project.slug}`} />}
                        className="flex-1 justify-between bg-white text-black hover:bg-white/90"
                      >
                        Go to project
                        <IconArrowRight className="size-4 text-black/80" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        nativeButton={false}
                        render={<Link to={`/o/${orgSlug}/project/${project.slug}/settings`} />}
                        className="px-2"
                        aria-label={`Open ${project.name} settings`}
                      >
                        <IconSettings className="size-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
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
