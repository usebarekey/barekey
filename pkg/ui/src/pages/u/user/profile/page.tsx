import { useOrganizationList } from "@clerk/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "theme-watcher";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getCurrentUserAccountRef,
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
import { Input } from "@/components/ui/input";
import { LandingPreference, PreferredTheme } from "@/lib/user-preferences";

const NO_DEFAULT_WORKSPACE = "__no_default_workspace__";

export function Page() {
  const { setTheme } = useTheme();
  const { userMemberships } = useOrganizationList({ userMemberships: true });
  const currentUser = useQuery(getCurrentUserAccountRef, {});
  const preferences = useQuery(getCurrentUserPreferencesRef, {});
  const upsertPreferences = useMutation(upsertCurrentUserPreferencesRef);

  const [preferredTheme, setPreferredTheme] = useState<string>(PreferredTheme.System);
  const [defaultOrgSlug, setDefaultOrgSlug] = useState<string>(NO_DEFAULT_WORKSPACE);
  const [landingPreference, setLandingPreference] = useState<string>(LandingPreference.AccountOverview);
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
    setDefaultOrgSlug(preferences?.defaultOrgSlug ?? NO_DEFAULT_WORKSPACE);
    setLandingPreference(preferences?.landingPreference ?? LandingPreference.AccountOverview);
  }, [preferences]);

  const isPreferencesLoading = preferences === undefined;
  const isDisabled = isSaving || isPreferencesLoading;
  const isDirty =
    !isPreferencesLoading &&
    preferences !== null &&
    (preferences.preferredTheme !== preferredTheme ||
      (preferences.defaultOrgSlug ?? NO_DEFAULT_WORKSPACE) !== defaultOrgSlug ||
      preferences.landingPreference !== landingPreference);

  async function handleSavePreferences() {
    if (isDisabled || !isDirty) {
      return;
    }

    const isThemeValid =
      preferredTheme === PreferredTheme.System ||
      preferredTheme === PreferredTheme.Light ||
      preferredTheme === PreferredTheme.Dark;
    const isLandingPreferenceValid =
      landingPreference === LandingPreference.AccountOverview ||
      landingPreference === LandingPreference.DefaultWorkspace;
    if (!isThemeValid || !isLandingPreferenceValid) {
      setSaveError("Invalid preferences selected.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      await upsertPreferences({
        preferredTheme,
        defaultOrgSlug: defaultOrgSlug === NO_DEFAULT_WORKSPACE ? null : defaultOrgSlug,
        landingPreference,
      });
      setTheme(preferredTheme);
      setSaveSuccess("Preferences updated.");
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : "Failed to update preferences.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account identity and personal defaults.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">Identity</p>
            <div className="rounded-lg border bg-background/70 p-3 text-sm text-muted-foreground">
              <p>
                <span className="text-foreground">Name:</span> {currentUser?.displayName ?? "Not set"}
              </p>
              <p>
                <span className="text-foreground">Email:</span> {currentUser?.email ?? "Not set"}
              </p>
              <p>
                <span className="text-foreground">Slug:</span>{" "}
                <span className="font-mono">{currentUser?.slug ?? "Not set"}</span>
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Preferences</p>
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="space-y-2">
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

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Default workspace</label>
                <Select
                  value={defaultOrgSlug}
                  onValueChange={(value) => {
                    if (value !== null) {
                      setDefaultOrgSlug(value);
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start">
                    <SelectItem value={NO_DEFAULT_WORKSPACE}>No default workspace</SelectItem>
                    {selectableMemberships.map((membership) => (
                      <SelectItem
                        key={membership.organization.id}
                        value={membership.organization.slug ?? NO_DEFAULT_WORKSPACE}
                      >
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate">{membership.organization.name}</span>
                          <span className="truncate text-[11px] text-muted-foreground">
                            @{membership.organization.slug}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Landing page</label>
                <Select
                  value={landingPreference}
                  onValueChange={(value) => {
                    if (value !== null) {
                      setLandingPreference(value);
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start">
                    <SelectItem value={LandingPreference.AccountOverview}>Account overview</SelectItem>
                    <SelectItem value={LandingPreference.DefaultWorkspace}>Default workspace</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleSavePreferences} disabled={!isDirty || isDisabled}>
                {isSaving ? "Saving..." : "Save preferences"}
              </Button>
              {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}
              {saveSuccess ? <p className="text-sm text-muted-foreground">{saveSuccess}</p> : null}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Account metadata</p>
            <Input value={currentUser?.clerkUserId ?? ""} disabled={true} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
