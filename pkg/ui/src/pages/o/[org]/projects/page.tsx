import { useMutation, useQuery } from "convex/react";
import { useRef, useState } from "react";
import { IconBriefcase, IconPlus } from "@tabler/icons-react";
import { useParams } from "react-router-dom";

import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";

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
  const isClaimsLoading = orgClaims === undefined;
  const isMissingOrgClaims =
    orgClaims !== undefined && orgClaims.isSignedIn && orgClaims.orgId === null;
  const isCreateDisabled =
    isSubmitting || isClaimsLoading || isMissingOrgClaims || name.trim().length === 0;

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
      <div className="space-y-1">
        <p className="text-lg font-semibold">Projects</p>
        <p className="text-sm text-muted-foreground">
          Projects are scoped to <span className="font-mono">{orgSlug}</span>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create project</CardTitle>
          <CardDescription>
            Create a project inside this organization workspace. Project slugs are generated
            automatically and are unique per organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              ref={inputRef}
              value={name}
              disabled={isSubmitting || isClaimsLoading || isMissingOrgClaims}
              placeholder="Project name"
              onChange={(event) => setName(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleCreateProject();
                }
              }}
            />
            <Button
              className="sm:self-start"
              disabled={isCreateDisabled}
              onClick={handleCreateProject}
            >
              <IconPlus />
              {isSubmitting ? "Creating..." : "Create project"}
            </Button>
          </div>
          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Projects</p>
          <p className="text-xs text-muted-foreground">
            {projects === undefined ? "Loading..." : `${projects.length} total`}
          </p>
        </div>

        {projects === undefined ? (
          <div className="rounded-xl border p-4 text-sm text-muted-foreground">
            Loading projects...
          </div>
        ) : isMissingOrgClaims ? (
          <div className="rounded-xl border p-4 text-sm text-muted-foreground">
            Convex is authenticated, but the token does not include an active organization claim
            (`org_id`). Projects are org-scoped, so project creation/listing is disabled until
            org claims are present in the Convex identity.
          </div>
        ) : projects.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <IconBriefcase />
              </EmptyMedia>
              <EmptyTitle>No projects yet</EmptyTitle>
              <EmptyDescription>
                Create your first project for <span className="font-mono">@{orgSlug}</span> to get
                started.
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
        ) : (
          <div className="rounded-xl border">
            <div className="divide-y">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{project.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      <span className="font-mono">{project.slug}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Created {formatDateTime(project.createdAtMs)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
