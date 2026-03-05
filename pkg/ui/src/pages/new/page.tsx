import { useAction } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { SignedIn, SignedOut, useAuth, useOrganizationList, useUser } from "@clerk/react-router";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getClerkErrorMessage, isClerkIdentifierExistsError } from "@/lib/clerk-errors";
import { generateOrganizationSlugCandidateFromName } from "@/lib/slugs";
import { extractRequestId, formatSupportErrorMessage } from "@/lib/support-errors";

type CreateKind = "project" | "organization";
type PlanId = "free" | "pro" | "max";
type BillingInterval = "monthly" | "annually";
type OverageMode = "without_overages" | "with_overages";
type OrganizationStartingPlan = "without_plan" | PlanId;
type ChangePlanResult = {
  attachedProductId: string;
  checkoutRequired: boolean;
  checkoutUrl: string | null;
  changeOutcome: "applied" | "scheduled" | "submitted";
  effectiveProductId: string | null;
};

type WorkspacePlanStatus = {
  orgId: string;
  orgRole: string | null;
  canManageBilling: boolean;
  currentProductId: string | null;
  currentTier: PlanId | null;
  currentInterval: "monthly" | "annually" | null;
  currentOverageMode: "without_overages" | "with_overages" | null;
  isPlanless: boolean;
  billingUnavailable: boolean;
};

const ORGANIZATION_STARTING_PLAN_OPTIONS: Array<{
  id: OrganizationStartingPlan;
  label: string;
  priceHint: string | null;
  description: string;
}> = [
  {
    id: "without_plan",
    label: "Without a plan",
    priceHint: null,
    description: "Create the organization in disabled billing state.",
  },
  {
    id: "free",
    label: "Free",
    priceHint: "$0/mo",
    description: "Uses your free workspace credit if available.",
  },
  {
    id: "pro",
    label: "Pro",
    priceHint: "$9.99/mo",
    description: "Paid plan with higher limits and support.",
  },
  {
    id: "max",
    label: "Max",
    priceHint: "$39.99/mo",
    description: "Paid plan with maximum limits.",
  },
];

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

    if (normalizedMessage.includes("planless") || normalizedMessage.includes("without a plan")) {
      return "This workspace is disabled until you select a billing plan.";
    }

    if (normalizedMessage.includes("billing service")) {
      return "Billing is temporarily unavailable. Please try again.";
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isActiveOrganizationMismatchError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("Active organization does not match the requested workspace.")
  );
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
  const createProject = useAction(api.projects.createForCurrentOrg);
  const getWorkspacePlanStatus = useAction(api.payments.getWorkspacePlanStatusForCurrentOrg);
  const changePlanForCurrentOrg = useAction(api.payments.changePlanForCurrentOrg);

  const [organizationName, setOrganizationName] = useState("");
  const [organizationStartingPlan, setOrganizationStartingPlan] =
    useState<OrganizationStartingPlan>("without_plan");
  const [organizationStartingInterval, setOrganizationStartingInterval] =
    useState<BillingInterval>("monthly");
  const [organizationStartingOverageMode, setOrganizationStartingOverageMode] =
    useState<OverageMode>("without_overages");
  const [organizationPlanSetupPath, setOrganizationPlanSetupPath] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [isOrganizationSubmitting, setIsOrganizationSubmitting] = useState(false);
  const [isProjectSubmitting, setIsProjectSubmitting] = useState(false);
  const [isSwitchingOrganization, setIsSwitchingOrganization] = useState(false);
  const [organizationErrorMessage, setOrganizationErrorMessage] = useState<string | null>(null);
  const [projectErrorMessage, setProjectErrorMessage] = useState<string | null>(null);
  const [workspacePlanStatus, setWorkspacePlanStatus] = useState<WorkspacePlanStatus | null>(null);
  const [isWorkspacePlanStatusLoading, setIsWorkspacePlanStatusLoading] = useState(false);
  const [workspacePlanStatusErrorMessage, setWorkspacePlanStatusErrorMessage] = useState<
    string | null
  >(null);
  const memberships = userMemberships.data ?? [];
  const selectableMemberships = memberships.filter(
    (membership) =>
      typeof membership.organization.slug === "string" && membership.organization.slug.length > 0,
  );
  const selectedProjectOrgName =
    selectableMemberships.find((membership) => membership.organization.slug === orgSlug)
      ?.organization.name ?? null;

  const defaultCreateKind: CreateKind = orgSlug ? "project" : "organization";
  const createKind = useMemo(
    () => resolveCreateKind(searchParams.get("type"), defaultCreateKind),
    [defaultCreateKind, searchParams],
  );

  useEffect(() => {
    document.title = createKind === "project" ? "Create Project" : "Create Organization";
  }, [createKind]);

  useEffect(() => {
    if (!isAuthLoaded || !isSignedIn || !orgSlug || createKind !== "project") {
      setWorkspacePlanStatus(null);
      setIsWorkspacePlanStatusLoading(false);
      setWorkspacePlanStatusErrorMessage(null);
      return;
    }

    let cancelled = false;
    setIsWorkspacePlanStatusLoading(true);
    setWorkspacePlanStatusErrorMessage(null);
    void getWorkspacePlanStatus({
      expectedOrgSlug: orgSlug,
    })
      .then((result) => {
        if (!cancelled) {
          setWorkspacePlanStatus(result as WorkspacePlanStatus);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setWorkspacePlanStatus(null);
          setWorkspacePlanStatusErrorMessage(
            getProjectErrorMessage(error) || "Unable to verify workspace billing status.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsWorkspacePlanStatusLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [createKind, getWorkspacePlanStatus, isAuthLoaded, isSignedIn, orgSlug]);

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
    setOrganizationPlanSetupPath(null);
    let createdOrgPathForRecovery: string | null = null;

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

      const createdOrgPath = createdOrganization.slug ? `/o/${createdOrganization.slug}` : null;
      createdOrgPathForRecovery = createdOrgPath;
      if (organizationStartingPlan !== "without_plan") {
        if (createdOrganization.slug === null) {
          throw new Error(
            "Organization was created but its slug is unavailable. Open billing to finish plan setup.",
          );
        }

        for (let attempt = 0; attempt < 10; attempt += 1) {
          try {
            await getWorkspacePlanStatus({
              expectedOrgSlug: createdOrganization.slug,
            });
            break;
          } catch (error: unknown) {
            if (!isActiveOrganizationMismatchError(error) || attempt === 9) {
              throw error;
            }
            await sleep(180);
          }
        }

        let result: ChangePlanResult | null = null;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            result = await changePlanForCurrentOrg({
              expectedOrgSlug: createdOrganization.slug,
              tier: organizationStartingPlan,
              interval:
                organizationStartingPlan === "free" ? "monthly" : organizationStartingInterval,
              overageMode:
                organizationStartingPlan === "free"
                  ? "without_overages"
                  : organizationStartingOverageMode,
              successUrl: `${window.location.origin}${createdOrgPath}/billing`,
            });
            break;
          } catch (error: unknown) {
            if (!isActiveOrganizationMismatchError(error) || attempt === 2) {
              throw error;
            }
            await setActive({
              organization: createdOrganization.id,
            });
            await sleep(220);
          }
        }

        if (result === null) {
          throw new Error("Unable to start billing setup for this organization.");
        }

        if (result.checkoutRequired && result.checkoutUrl) {
          window.location.assign(result.checkoutUrl);
          return;
        }

        setOrganizationName("");
        void navigate(`${createdOrgPath}/billing`, { replace: true });
        return;
      }

      setOrganizationName("");
      void navigate(
        createdOrganization.slug ? `/o/${createdOrganization.slug}/overview` : "/o/select",
        { replace: true },
      );
    } catch (error: unknown) {
      if (createdOrgPathForRecovery) {
        setOrganizationPlanSetupPath(`${createdOrgPathForRecovery}/billing`);
      }
      const defaultFallback =
        organizationStartingPlan === "without_plan"
          ? "Unable to create organization."
          : formatSupportErrorMessage(
              "An error occurred while creating the organization and setting up billing.",
              extractRequestId(error),
            );
      setOrganizationErrorMessage(getClerkErrorMessage(error, defaultFallback));
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
      isWorkspacePlanStatusLoading ||
      workspacePlanStatus?.isPlanless === true ||
      workspacePlanStatus?.billingUnavailable === true ||
      workspacePlanStatusErrorMessage !== null ||
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
    isWorkspacePlanStatusLoading ||
    workspacePlanStatus?.isPlanless === true ||
    workspacePlanStatus?.billingUnavailable === true ||
    workspacePlanStatusErrorMessage !== null ||
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
                : "Start a new organization and optionally select a billing plan now."}
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
                    placeholder={
                      user?.fullName ? `${user.fullName}'s Organization` : "My Organization"
                    }
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

                <div className="space-y-2">
                  <label className="text-sm font-medium">Starting plan</label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {ORGANIZATION_STARTING_PLAN_OPTIONS.map((planOption) => (
                      <button
                        key={planOption.id}
                        type="button"
                        className={`rounded-lg border p-3 text-left transition-colors ${
                          organizationStartingPlan === planOption.id
                            ? "border-primary bg-primary/10"
                            : "hover:bg-muted/30"
                        }`}
                        disabled={isOrganizationSubmitting}
                        onClick={() => {
                          setOrganizationStartingPlan(planOption.id);
                        }}
                      >
                        <p className="text-sm font-medium">
                          {planOption.label}{" "}
                          {planOption.priceHint ? (
                            <span className="text-muted-foreground text-xs font-mono">
                              ({planOption.priceHint})
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {planOption.description}
                        </p>
                      </button>
                    ))}
                  </div>
                  {organizationStartingPlan === "pro" || organizationStartingPlan === "max" ? (
                    <div className="space-y-2 rounded-lg border border-dashed p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          Billing interval
                        </span>
                        <ToggleGroup
                          multiple={false}
                          value={[organizationStartingInterval]}
                          onValueChange={(values) => {
                            const next = values[0];
                            if (next === "monthly" || next === "annually") {
                              setOrganizationStartingInterval(next);
                            }
                          }}
                          variant="outline"
                          size="sm"
                          spacing={0}
                        >
                          <ToggleGroupItem value="monthly" disabled={isOrganizationSubmitting}>
                            Monthly
                          </ToggleGroupItem>
                          <ToggleGroupItem value="annually" disabled={isOrganizationSubmitting}>
                            Annually
                          </ToggleGroupItem>
                        </ToggleGroup>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          Overage mode
                        </span>
                        <ToggleGroup
                          multiple={false}
                          value={[organizationStartingOverageMode]}
                          onValueChange={(values) => {
                            const next = values[0];
                            if (next === "without_overages" || next === "with_overages") {
                              setOrganizationStartingOverageMode(next);
                            }
                          }}
                          variant="outline"
                          size="sm"
                          spacing={0}
                        >
                          <ToggleGroupItem
                            value="without_overages"
                            disabled={isOrganizationSubmitting}
                          >
                            Without overages
                          </ToggleGroupItem>
                          <ToggleGroupItem
                            value="with_overages"
                            disabled={isOrganizationSubmitting}
                          >
                            With overages
                          </ToggleGroupItem>
                        </ToggleGroup>
                      </div>
                    </div>
                  ) : null}
                  {organizationStartingPlan === "pro" || organizationStartingPlan === "max" ? (
                    <p className="text-xs text-muted-foreground">
                      Annual gives a{" "}
                      <span className="font-semibold text-foreground">20% discount</span>. Paid
                      plans may redirect to secure checkout to confirm payment.
                    </p>
                  ) : null}
                </div>

                {organizationErrorMessage ? (
                  <p className="text-sm text-destructive">{organizationErrorMessage}</p>
                ) : null}
                {organizationPlanSetupPath ? (
                  <Button
                    size="sm"
                    variant="outline"
                    render={<Link to={organizationPlanSetupPath} />}
                  >
                    Open billing setup
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Organization</label>
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
                      disabled={
                        isSwitchingOrganization ||
                        !isOrgListLoaded ||
                        selectableMemberships.length === 0
                      }
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
                ) : isWorkspacePlanStatusLoading ? (
                  <p className="text-xs text-muted-foreground">
                    Checking workspace billing status...
                  </p>
                ) : workspacePlanStatus?.isPlanless ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    This workspace is without a plan and currently disabled for project creation.
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="outline" render={<Link to={`/o/${orgSlug}/billing`} />}>
                        Choose billing plan
                      </Button>
                    </div>
                  </div>
                ) : workspacePlanStatus?.billingUnavailable ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    Billing is temporarily unavailable, so project creation is paused right now.
                  </div>
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
                {workspacePlanStatusErrorMessage ? (
                  <p className="text-sm text-destructive">{workspacePlanStatusErrorMessage}</p>
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
                  to={createKind === "project" && orgSlug ? `/o/${orgSlug}/projects` : "/o/select"}
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
                  : organizationStartingPlan === "without_plan"
                    ? "Create organization"
                    : "Create organization and continue"}
            </Button>
          </CardFooter>
        </SignedIn>
      </Card>
    </div>
  );
}
