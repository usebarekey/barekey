import { useAuth, useOrganizationList } from "@clerk/react-router";
import { useMutation, useQuery } from "convex/react";
import { IconArrowRight, IconCircleCheck, IconStar } from "@tabler/icons-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonPlaceholder } from "@/components/ui/skeleton-placeholder";
import { getCurrentUserPreferencesRef, upsertCurrentUserPreferencesRef } from "@/lib/convex-refs";
import { LandingPreference, PreferredTheme } from "@/lib/user-preferences";

export function Page() {
  const navigate = useNavigate();
  const { orgSlug: activeOrgSlug } = useAuth();
  const { isLoaded, setActive, userMemberships } = useOrganizationList({
    userMemberships: true,
  });
  const preferences = useQuery(getCurrentUserPreferencesRef, {});
  const upsertPreferences = useMutation(upsertCurrentUserPreferencesRef);
  const [activeActionSlug, setActiveActionSlug] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleOpenWorkspace(nextOrgSlug: string, nextOrgId: string) {
    setActiveActionSlug(nextOrgSlug);
    setActionError(null);

    try {
      if (!setActive) {
        throw new Error("Workspace switching is unavailable right now.");
      }
      await setActive({ organization: nextOrgId });
      void navigate(`/o/${nextOrgSlug}/overview`);
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : "Failed to open workspace.");
    } finally {
      setActiveActionSlug(null);
    }
  }

  async function handleSetDefaultWorkspace(nextOrgSlug: string) {
    setActiveActionSlug(nextOrgSlug);
    setActionError(null);

    try {
      await upsertPreferences({
        preferredTheme: preferences?.preferredTheme ?? PreferredTheme.System,
        defaultOrgSlug: nextOrgSlug,
        landingPreference: preferences?.landingPreference ?? LandingPreference.AccountOverview,
      });
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : "Failed to save default workspace.");
    } finally {
      setActiveActionSlug(null);
    }
  }

  if (!isLoaded) {
    return (
      <div className="space-y-4">
        <SkeletonPlaceholder
          className="w-36 rounded-md"
          content={<div className="text-sm text-muted-foreground">Loading workspaces...</div>}
        />
        <Card>
          <CardHeader>
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="space-y-3 rounded-lg border bg-background/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-14" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-32" />
                  <Skeleton className="h-9 w-28" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  const memberships = userMemberships.data ?? [];
  const selectableMemberships = memberships.filter((membership) =>
    Boolean(membership.organization.slug),
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Workspaces</CardTitle>
          <CardDescription>
            Manage your organization workspaces and account defaults.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectableMemberships.length === 0 ? (
            <div className="space-y-3 rounded-lg border bg-background/70 p-4 text-sm text-muted-foreground">
              <p>You are not a member of any workspaces yet.</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<Link to="/new?type=organization" />}
                >
                  Create workspace
                </Button>
                <Button variant="outline" nativeButton={false} render={<Link to="/o/select" />}>
                  Organization selector
                </Button>
              </div>
            </div>
          ) : (
            selectableMemberships.map((membership) => {
              const membershipSlug = membership.organization.slug ?? "";
              const membershipRole = (membership.roleName || membership.role).replace(/^org:/, "");
              const isDefault = preferences?.defaultOrgSlug === membershipSlug;
              const isActive = activeOrgSlug === membershipSlug;
              const isBusy = activeActionSlug === membershipSlug;

              return (
                <div
                  key={membership.organization.id}
                  className="space-y-3 rounded-lg border bg-background/70 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{membership.organization.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{membershipRole}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                          <IconCircleCheck className="size-3.5" />
                          Active
                        </span>
                      ) : null}
                      {isDefault ? (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-300">
                          <IconStar className="size-3.5" />
                          Default
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        void handleOpenWorkspace(membershipSlug, membership.organization.id);
                      }}
                      disabled={isBusy}
                    >
                      {isBusy ? (
                        <SkeletonPlaceholder
                          className="inline-block rounded-md"
                          content={<span>Open workspace</span>}
                        />
                      ) : (
                        "Open workspace"
                      )}
                      <IconArrowRight className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        void handleSetDefaultWorkspace(membershipSlug);
                      }}
                      disabled={isBusy || isDefault}
                    >
                      {isDefault ? "Default workspace" : "Set as default"}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
          {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
