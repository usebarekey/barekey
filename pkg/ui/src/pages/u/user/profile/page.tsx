import { useOrganizationList } from "@clerk/react-router";
import { useMutation, useQuery } from "convex/react";
import {
  IconBuildingSkyscraper,
  IconCircleCheckFilled,
  IconCircleDashed,
  IconPalette,
  IconSettings,
  IconUserCircle,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "theme-watcher";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getCurrentUserAccountRef,
  getCurrentUserFreePlanCreditRef,
  getCurrentUserPreferencesRef,
  upsertCurrentUserPreferencesRef,
} from "@/lib/convex-refs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LandingPreference, PreferredTheme } from "@/lib/user-preferences";

export function Page() {
  const { setTheme } = useTheme();
  const { userMemberships } = useOrganizationList({ userMemberships: true });
  const currentUser = useQuery(getCurrentUserAccountRef, {});
  const freePlanCredit = useQuery(getCurrentUserFreePlanCreditRef, {});
  const preferences = useQuery(getCurrentUserPreferencesRef, {});
  const upsertPreferences = useMutation(upsertCurrentUserPreferencesRef);

  const [preferredTheme, setPreferredTheme] = useState<string>(
    PreferredTheme.System,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const hasInitializedRef = useRef(false);

  const memberships = userMemberships.data ?? [];
  const selectableMemberships = memberships.filter((membership) =>
    Boolean(membership.organization.slug),
  );

  useEffect(() => {
    if (preferences === undefined || hasInitializedRef.current) {
      return;
    }

    hasInitializedRef.current = true;
    setPreferredTheme(preferences?.preferredTheme ?? PreferredTheme.System);
  }, [preferences]);

  const isPreferencesLoading = preferences === undefined;
  const isDisabled = isSaving || isPreferencesLoading;
  const savedPreferredTheme =
    preferences?.preferredTheme ?? PreferredTheme.System;
  const isDirty = !isPreferencesLoading && savedPreferredTheme !== preferredTheme;

  const assignedWorkspaceName = (() => {
    if (!freePlanCredit || !freePlanCredit.assignedOrgSlug) {
      return null;
    }
    const matched = selectableMemberships.find(
      (membership) =>
        membership.organization.slug === freePlanCredit.assignedOrgSlug,
    );
    return matched?.organization.name ?? null;
  })();

  async function handleSavePreferences() {
    if (isDisabled || !isDirty) {
      return;
    }

    const isThemeValid =
      preferredTheme === PreferredTheme.System ||
      preferredTheme === PreferredTheme.Light ||
      preferredTheme === PreferredTheme.Dark;
    if (!isThemeValid) {
      setSaveError("Invalid preferences selected.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      await upsertPreferences({
        preferredTheme,
        defaultOrgSlug: preferences?.defaultOrgSlug ?? null,
        landingPreference:
          preferences?.landingPreference ?? LandingPreference.AccountOverview,
      });
      setTheme(preferredTheme);
      setSaveSuccess("Preferences updated.");
    } catch (error: unknown) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Failed to update preferences.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section id="profile-information" className="scroll-mt-24">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <IconUserCircle className="mt-0.5 size-5 text-muted-foreground" />
              <div>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Your account identity and primary contact details.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentUser === undefined ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Display name</p>
                  <p className="mt-1 text-sm font-medium">
                    {currentUser?.displayName ?? "Not set"}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="mt-1 text-sm font-medium">
                    {currentUser?.email ?? "Not set"}
                  </p>
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Profile identity fields are managed by your sign-in provider.
            </p>
          </CardContent>
        </Card>
      </section>

      <section id="free-workspace-credit" className="scroll-mt-24">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <IconBuildingSkyscraper className="mt-0.5 size-5 text-muted-foreground" />
              <div>
                <CardTitle>Free Workspace Credit</CardTitle>
                <CardDescription>
                  Your single free workspace credit and where it is currently
                  assigned.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {freePlanCredit === undefined ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-44" />
                <Skeleton className="h-4 w-72" />
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {freePlanCredit.remainingCredits > 0 ? (
                    <Badge variant="outline" className="gap-1.5">
                      <IconCircleCheckFilled className="size-3.5" />
                      Available
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1.5">
                      <IconCircleDashed className="size-3.5" />
                      In use
                    </Badge>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {freePlanCredit.remainingCredits}/
                    {freePlanCredit.totalCredits} credit remaining
                  </span>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">
                    Assigned workspace
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {freePlanCredit.assignedOrgSlug
                      ? (assignedWorkspaceName ?? "Assigned workspace")
                      : "Not assigned to any workspace"}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  A used credit can be revoked later through workspace billing
                  actions.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <section id="appearance-defaults" className="scroll-mt-24">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <IconPalette className="mt-0.5 size-5 text-muted-foreground" />
              <div>
                <CardTitle>Appearance Defaults</CardTitle>
                <CardDescription>
                  Choose how your dashboard should look by default.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-w-sm space-y-2">
              <label className="text-xs text-muted-foreground">Theme</label>
              <Select
                value={preferredTheme}
                onValueChange={(value) => {
                  if (value !== null) {
                    setPreferredTheme(value);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value={PreferredTheme.System}>System</SelectItem>
                  <SelectItem value={PreferredTheme.Light}>Light</SelectItem>
                  <SelectItem value={PreferredTheme.Dark}>Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="save-changes" className="scroll-mt-24">
        <Card>
          <CardHeader>
            <CardTitle>Save Changes</CardTitle>
            <CardDescription>
              Apply all selected preference changes in one step.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={handleSavePreferences}
                disabled={!isDirty || isDisabled}
              >
                <IconSettings className="size-4" />
                {isSaving ? "Saving..." : "Save preferences"}
              </Button>
              {isDirty ? (
                <Badge variant="outline">Unsaved changes</Badge>
              ) : (
                <Badge variant="secondary">All changes saved</Badge>
              )}
            </div>
            {saveError ? (
              <p className="text-sm text-destructive">{saveError}</p>
            ) : null}
            {saveSuccess ? (
              <p className="text-sm text-muted-foreground">{saveSuccess}</p>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
