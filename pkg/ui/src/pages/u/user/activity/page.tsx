import { useAuth } from "@clerk/react-router";
import { useQuery } from "convex/react";
import { IconActivityHeartbeat, IconClock, IconRoute2 } from "@tabler/icons-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonPlaceholder } from "@/components/ui/skeleton-placeholder";
import { getCurrentUserAccountRef, getCurrentUserPreferencesRef } from "@/lib/convex-refs";

type TimelineEntry = {
  id: string;
  label: string;
  detail: string;
  timestampMs: number | null;
};

function formatDateTime(timestampMs: number | null): string {
  if (timestampMs === null) {
    return "Not available";
  }

  return new Date(timestampMs).toLocaleString();
}

export function Page() {
  const { orgSlug: activeOrgSlug } = useAuth();
  const account = useQuery(getCurrentUserAccountRef, {});
  const preferences = useQuery(getCurrentUserPreferencesRef, {});
  const isLoading = account === undefined || preferences === undefined;

  const timeline: Array<TimelineEntry> = [
    {
      id: "account-created",
      label: "Account created",
      detail: "Initial Barekey account record was created.",
      timestampMs: account?.createdAtMs ?? null,
    },
    {
      id: "account-updated",
      label: "Account profile updated",
      detail: "Latest sync of account identity fields.",
      timestampMs: account?.updatedAtMs ?? null,
    },
    {
      id: "last-seen",
      label: "Last seen",
      detail: "Last successful authenticated presence update.",
      timestampMs: account?.lastSeenAtMs ?? null,
    },
    {
      id: "preferences-updated",
      label: "Preferences updated",
      detail: "Latest saved account preference change.",
      timestampMs: preferences?.updatedAtMs ?? null,
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>Recent account-level timeline and routing context.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border bg-background/70 p-3 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <IconRoute2 className="size-4" />
              Active workspace context:{" "}
              <span className="text-foreground">
                {activeOrgSlug ? "Workspace selected" : "No workspace selected"}
              </span>
            </p>
            <p className="mt-2 text-xs">
              This timeline is derived from current account and preference records. Detailed event
              history can be added in a dedicated audit phase.
            </p>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <SkeletonPlaceholder
                className="w-44 rounded-md"
                content={
                  <p className="text-sm text-muted-foreground">Loading activity timeline...</p>
                }
              />
              {timeline.map((entry) => (
                <div key={entry.id} className="rounded-lg border bg-background/70 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="size-4 rounded-full" />
                      <SkeletonPlaceholder
                        className="w-36 rounded-md"
                        content={<p className="font-medium">{entry.label}</p>}
                      />
                    </div>
                    <SkeletonPlaceholder
                      className="w-40 rounded-md"
                      content={
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(entry.timestampMs)}
                        </p>
                      }
                    />
                  </div>
                  <SkeletonPlaceholder
                    className="mt-2 w-full rounded-md"
                    content={<p className="text-xs text-muted-foreground">{entry.detail}</p>}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {timeline.map((entry) => (
                <div key={entry.id} className="rounded-lg border bg-background/70 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 font-medium">
                      <IconActivityHeartbeat className="size-4 text-cyan-300" />
                      {entry.label}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <IconClock className="size-3.5" />
                      {formatDateTime(entry.timestampMs)}
                    </p>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{entry.detail}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
