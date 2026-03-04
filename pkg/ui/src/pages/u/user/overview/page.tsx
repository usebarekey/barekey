import { useQuery } from "convex/react";
import { IconArrowRight, IconCheck, IconClock, IconSettingsCog, IconShieldLock } from "@tabler/icons-react";
import { Link, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUserAccountRef, getCurrentUserPreferencesRef } from "@/lib/convex-refs";

function formatDateTime(timestampMs: number | null): string {
  if (timestampMs === null) {
    return "Not available";
  }

  return new Date(timestampMs).toLocaleString();
}

export function Page() {
  const { userSlug = "user" } = useParams();
  const currentUser = useQuery(getCurrentUserAccountRef, {});
  const preferences = useQuery(getCurrentUserPreferencesRef, {});

  const isAccountLoading = currentUser === undefined;
  const isPreferencesLoading = preferences === undefined;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Account overview</CardTitle>
          <CardDescription>Your identity, preferences, and account readiness.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {isAccountLoading ? (
            <p className="text-muted-foreground">Loading account details...</p>
          ) : currentUser ? (
            <>
              <p className="flex items-center gap-2">
                <IconCheck className="size-4 text-emerald-400" />
                <span>Signed in and ready.</span>
              </p>
              <p>
                <span className="text-muted-foreground">Name:</span>{" "}
                <span>{currentUser.displayName ?? "Not set"}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Email:</span>{" "}
                <span>{currentUser.email ?? "Not set"}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Account slug:</span>{" "}
                <span className="font-mono">{currentUser.slug}</span>
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">Your account record is still being prepared.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {isPreferencesLoading ? (
              <p>Loading preferences...</p>
            ) : preferences ? (
              <>
                <p>
                  <span className="text-foreground">Theme:</span> {preferences.preferredTheme}
                </p>
                <p>
                  <span className="text-foreground">Default workspace:</span>{" "}
                  {preferences.defaultOrgSlug ?? "Not set"}
                </p>
                <p>
                  <span className="text-foreground">Landing:</span>{" "}
                  {preferences.landingPreference === "account_overview"
                    ? "Account overview"
                    : "Default workspace"}
                </p>
              </>
            ) : (
              <p>Sign in to load preferences.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p className="flex items-start gap-2">
              <IconClock className="mt-0.5 size-4" />
              <span>
                Account created:{" "}
                <span className="text-foreground">{formatDateTime(currentUser?.createdAtMs ?? null)}</span>
              </span>
            </p>
            <p className="flex items-start gap-2">
              <IconClock className="mt-0.5 size-4" />
              <span>
                Last seen:{" "}
                <span className="text-foreground">{formatDateTime(currentUser?.lastSeenAtMs ?? null)}</span>
              </span>
            </p>
            <p className="flex items-start gap-2">
              <IconClock className="mt-0.5 size-4" />
              <span>
                Preferences updated:{" "}
                <span className="text-foreground">{formatDateTime(preferences?.updatedAtMs ?? null)}</span>
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-between"
              nativeButton={false}
              render={<Link to={`/u/${userSlug}/profile`} />}
            >
              Profile
              <IconSettingsCog className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="w-full justify-between"
              nativeButton={false}
              render={<Link to={`/u/${userSlug}/security`} />}
            >
              Security
              <IconShieldLock className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="w-full justify-between"
              nativeButton={false}
              render={<Link to={`/u/${userSlug}/workspaces`} />}
            >
              Manage workspaces
              <IconArrowRight className="size-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
