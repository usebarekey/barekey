import { useMutation } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import {
  SignedIn,
  SignedOut,
  useAuth,
  useOrganizationList,
  useUser,
} from "@clerk/react-router";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { getClerkErrorMessage, isClerkIdentifierExistsError } from "@/lib/clerk-errors";
import { generateOrganizationSlugCandidateFromName } from "@/lib/slugs";

type CreateKind = "project" | "organization";

function resolveCreateKind(value: string | null, fallback: CreateKind): CreateKind {
  if (value === "project" || value === "organization") {
    return value;
  }

  return fallback;
}

function getProjectErrorMessage(error: unknown): string {
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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isLoaded: isAuthLoaded, isSignedIn, orgSlug } = useAuth();
  const { user } = useUser();
  const {
    isLoaded: isOrgListLoaded,
    createOrganization,
    setActive,
    userMemberships,
  } = useOrganizationList({
    userMemberships: true,
  });
  const createProject = useMutation(api.projects.createForCurrentOrg);

  const [organizationName, setOrganizationName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [isOrganizationSubmitting, setIsOrganizationSubmitting] = useState(false);
  const [isProjectSubmitting, setIsProjectSubmitting] = useState(false);
  const [isSwitchingOrganization, setIsSwitchingOrganization] = useState(false);
  const [organizationErrorMessage, setOrganizationErrorMessage] = useState<string | null>(null);
  const [projectErrorMessage, setProjectErrorMessage] = useState<string | null>(null);
  const memberships = userMemberships.data ?? [];
  const selectableMemberships = memberships.filter(
    (membership) =>
      typeof membership.organization.slug === "string" && membership.organization.slug.length > 0,
  );
  const selectedProjectOrgName =
    selectableMemberships.find((membership) => membership.organization.slug === orgSlug)?.organization
      .name ?? null;

  const defaultCreateKind: CreateKind = orgSlug ? "project" : "organization";
  const createKind = useMemo(
    () => resolveCreateKind(searchParams.get("type"), defaultCreateKind),
    [defaultCreateKind, searchParams],
  );

  useEffect(() => {
    document.title = createKind === "project" ? "Create Project" : "Create Organization";
  }, [createKind]);

  function setCreateKind(nextKind: CreateKind) {
    if (nextKind === createKind) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("type", nextKind);
    setSearchParams(nextParams, { replace: true });
    setOrganizationErrorMessage(null);
    setProjectErrorMessage(null);
  }

  async function handleCreateOrganization() {
    const trimmedName = organizationName.trim();
    if (!isOrgListLoaded || isOrganizationSubmitting || trimmedName.length === 0) {
      return;
    }

    setIsOrganizationSubmitting(true);
    setOrganizationErrorMessage(null);

    try {
      let createdOrganization: { id: string; slug: string | null } | null = null;
      let lastError: unknown = null;

      for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
          createdOrganization = await createOrganization({
            name: trimmedName,
            slug: generateOrganizationSlugCandidateFromName(trimmedName),
          });
          break;
        } catch (error: unknown) {
          if (!isClerkIdentifierExistsError(error)) {
            throw error;
          }

          lastError = error;
        }
      }

      if (createdOrganization === null) {
        throw lastError ?? new Error("Unable to create organization.");
      }

      await setActive({
        organization: createdOrganization.id,
      });

      setOrganizationName("");
      void navigate(
        createdOrganization.slug ? `/o/${createdOrganization.slug}/overview` : "/o/select",
        { replace: true },
      );
    } catch (error: unknown) {
      setOrganizationErrorMessage(getClerkErrorMessage(error, "Unable to create organization."));
    } finally {
      setIsOrganizationSubmitting(false);
    }
  }

  async function handleCreateProject() {
    const trimmedName = projectName.trim();
    if (
      !isAuthLoaded ||
      !isSignedIn ||
      isProjectSubmitting ||
      isSwitchingOrganization ||
      !orgSlug ||
      trimmedName.length === 0
    ) {
      return;
    }

    setIsProjectSubmitting(true);
    setProjectErrorMessage(null);

    try {
      const createdProject = await createProject({
        expectedOrgSlug: orgSlug,
        name: trimmedName,
      });

      setProjectName("");
      void navigate(`/o/${orgSlug}/project/${createdProject.slug}/variables`, { replace: true });
    } catch (error: unknown) {
      setProjectErrorMessage(getProjectErrorMessage(error));
    } finally {
      setIsProjectSubmitting(false);
    }
  }

  async function handleSelectProjectOrganization(nextOrgSlug: string) {
    if (!nextOrgSlug || nextOrgSlug === orgSlug || isSwitchingOrganization || !setActive) {
      return;
    }

    const targetMembership = selectableMemberships.find(
      (membership) => membership.organization.slug === nextOrgSlug,
    );
    if (!targetMembership) {
      return;
    }

    setIsSwitchingOrganization(true);
    setProjectErrorMessage(null);

    try {
      await setActive({
        organization: targetMembership.organization.id,
      });
    } catch (error: unknown) {
      setProjectErrorMessage(
        getClerkErrorMessage(error, "Unable to switch organization right now."),
      );
    } finally {
      setIsSwitchingOrganization(false);
    }
  }

  const isCreateOrganizationDisabled =
    !isOrgListLoaded || isOrganizationSubmitting || organizationName.trim().length === 0;
  const isCreateProjectDisabled =
    !isAuthLoaded ||
    !isSignedIn ||
    isProjectSubmitting ||
    isSwitchingOrganization ||
    !orgSlug ||
    projectName.trim().length === 0;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl items-stretch justify-center px-4 py-6">
      <Card className="flex h-[calc(100vh-3rem)] w-full flex-col overflow-hidden">
        <CardHeader className="space-y-4 border-b">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={createKind === "project" ? "default" : "outline"}
              onClick={() => setCreateKind("project")}
            >
              Project
            </Button>
            <Button
              variant={createKind === "organization" ? "default" : "outline"}
              onClick={() => setCreateKind("organization")}
            >
              Organization
            </Button>
          </div>

          <div className="space-y-1">
            <CardTitle className="text-2xl">
              {createKind === "project" ? "Create project" : "Create organization"}
            </CardTitle>
            <CardDescription>
              {createKind === "project"
                ? "Create a project in your active organization workspace."
                : "Start a new organization workspace."}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="flex-1 space-y-4 py-6">
          <SignedOut>
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Sign in first to continue.
            </div>
          </SignedOut>

          <SignedIn>
            {createKind === "organization" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="organization-name" className="text-sm font-medium">
                    Organization name
                  </label>
                  <Input
                    id="organization-name"
                    placeholder={user?.fullName ? `${user.fullName}'s Organization` : "My Organization"}
                    value={organizationName}
                    disabled={isOrganizationSubmitting}
                    onChange={(event) => setOrganizationName(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleCreateOrganization();
                      }
                    }}
                  />
                </div>

                {organizationErrorMessage ? (
                  <p className="text-sm text-destructive">{organizationErrorMessage}</p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Organization
                  </label>
                  <Select
                    value={orgSlug ?? undefined}
                    onValueChange={(value) => {
                      if (!value) {
                        return;
                      }
                      void handleSelectProjectOrganization(value);
                    }}
                  >
                    <SelectTrigger
                      className="w-full"
                      disabled={isSwitchingOrganization || !isOrgListLoaded || selectableMemberships.length === 0}
                    >
                      <span className="truncate">
                        {selectedProjectOrgName ??
                          (selectableMemberships.length === 0
                            ? "No organizations available"
                            : "Select organization")}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                    {selectableMemberships.map((membership) => {
                      const membershipOrgSlug = membership.organization.slug;
                      if (!membershipOrgSlug) {
                        return null;
                      }

                      return (
                        <SelectItem key={membership.organization.id} value={membershipOrgSlug}>
                          {membership.organization.name}
                        </SelectItem>
                      );
                    })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="project-name" className="text-sm font-medium">
                    Project name
                  </label>
                  <Input
                    id="project-name"
                    placeholder="My Project"
                    value={projectName}
                    disabled={!orgSlug || isProjectSubmitting}
                    onChange={(event) => setProjectName(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleCreateProject();
                      }
                    }}
                  />
                </div>

                {isSwitchingOrganization ? (
                  <p className="text-xs text-muted-foreground">Switching organization...</p>
                ) : orgSlug ? (
                  <p className="text-xs text-muted-foreground">
                    Creating in workspace <span className="font-mono">{orgSlug}</span>.
                  </p>
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    Select an organization before creating a project.
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="outline" render={<Link to="/o/select" />}>
                        Select organization
                      </Button>
                      <Button variant="outline" onClick={() => setCreateKind("organization")}>
                        Create organization
                      </Button>
                    </div>
                  </div>
                )}

                {projectErrorMessage ? (
                  <p className="text-sm text-destructive">{projectErrorMessage}</p>
                ) : null}
              </div>
            )}
          </SignedIn>
        </CardContent>

        <SignedIn>
          <CardFooter className="justify-end gap-2 border-t">
            <Button
              variant="outline"
              render={
                <Link
                  to={
                    createKind === "project" && orgSlug ? `/o/${orgSlug}/projects` : "/o/select"
                  }
                />
              }
            >
              Cancel
            </Button>
            <Button
              onClick={createKind === "project" ? handleCreateProject : handleCreateOrganization}
              disabled={
                createKind === "project" ? isCreateProjectDisabled : isCreateOrganizationDisabled
              }
            >
              {createKind === "project"
                ? isProjectSubmitting
                  ? "Creating..."
                  : "Create project"
                : isOrganizationSubmitting
                  ? "Creating..."
                  : "Create organization"}
            </Button>
          </CardFooter>
        </SignedIn>
      </Card>
    </div>
  );
}
