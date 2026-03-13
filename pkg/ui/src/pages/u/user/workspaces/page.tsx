import { useAuth, useOrganizationList } from "@clerk/react-router";
import { useMutation, useQuery } from "convex/react";
import { IconArrowRight, IconCircleCheck, IconStar } from "@tabler/icons-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    return <div className="text-sm text-muted-foreground">Loading workspaces...</div>;
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
                      {isBusy ? "Opening..." : "Open workspace"}
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
