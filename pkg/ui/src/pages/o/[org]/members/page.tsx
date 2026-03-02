import { useEffect, useState } from "react";

import {
  IconArrowRight,
  IconFilter,
  IconMailShare,
  IconShieldStar,
  IconUserCheck,
  IconUsers,
  IconUserSearch,
} from "@tabler/icons-react";
import { useOrganization } from "@clerk/react-router";
import { Link, useParams } from "react-router-dom";

import {
  OrgMetricCard,
  OrgPageHero,
  OrgRoleBadge,
  OrgSectionCard,
} from "@/components/custom/org-workspace";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { generateGradientDataUrl } from "@/lib/generate-gradient";
import { displayName, formatDate, initials } from "@/lib/org-utils";

type SortMode =
  | "alphabetical_asc"
  | "alphabetical_desc"
  | "role_grouped"
  | "newest_added"
  | "oldest_added"
  | "email_asc";

const SORT_MODE_LABELS: Record<SortMode, string> = {
  alphabetical_asc: "Alphabetical (A-Z)",
  alphabetical_desc: "Alphabetical (Z-A)",
  role_grouped: "Grouped by role",
  newest_added: "Added at (newest first)",
  oldest_added: "Added at (oldest first)",
  email_asc: "Email/identifier (A-Z)",
};

export function Page() {
  const { orgSlug = "org" } = useParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("alphabetical_asc");
  const {
    organization,
    membership,
    memberships,
    invitations,
    membershipRequests,
  } = useOrganization({
    memberships: {
      pageSize: 50,
      keepPreviousData: true,
    },
    invitations: {
      pageSize: 20,
      keepPreviousData: true,
    },
    membershipRequests: {
      pageSize: 20,
      keepPreviousData: true,
    },
  });

  const allMembers = memberships?.data ?? [];
  const allInvites = invitations?.data ?? [];
  const allRequests = membershipRequests?.data ?? [];
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const searchedMembers = allMembers.filter((memberRow) => {
    const publicUserData = memberRow.publicUserData;
    const rowName = displayName({
      firstName: publicUserData?.firstName ?? null,
      lastName: publicUserData?.lastName ?? null,
      identifier: publicUserData?.identifier ?? "member",
    });
    const haystack = `${rowName} ${publicUserData?.identifier ?? ""} ${memberRow.role}`.toLowerCase();
    return normalizedQuery.length === 0 || haystack.includes(normalizedQuery);
  });
  const sortedMembers = [...searchedMembers].sort((left, right) => {
    const leftName = displayName({
      firstName: left.publicUserData?.firstName ?? null,
      lastName: left.publicUserData?.lastName ?? null,
      identifier: left.publicUserData?.identifier ?? "member",
    }).toLowerCase();
    const rightName = displayName({
      firstName: right.publicUserData?.firstName ?? null,
      lastName: right.publicUserData?.lastName ?? null,
      identifier: right.publicUserData?.identifier ?? "member",
    }).toLowerCase();
    const leftIdentifier = (left.publicUserData?.identifier ?? "").toLowerCase();
    const rightIdentifier = (right.publicUserData?.identifier ?? "").toLowerCase();

    switch (sortMode) {
      case "alphabetical_asc":
        return leftName.localeCompare(rightName);
      case "alphabetical_desc":
        return rightName.localeCompare(leftName);
      case "role_grouped": {
        const roleRank = (role: string) => {
          if (role === "org:admin") {
            return 0;
          }
          if (role === "org:member") {
            return 1;
          }
          return 2;
        };
        return roleRank(left.role) - roleRank(right.role) || leftName.localeCompare(rightName);
      }
      case "newest_added":
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      case "oldest_added":
        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      case "email_asc":
        return leftIdentifier.localeCompare(rightIdentifier) || leftName.localeCompare(rightName);
      default:
        return leftName.localeCompare(rightName);
    }
  });
  const adminCount = allMembers.filter((memberRow) => memberRow.role === "org:admin").length;

  useEffect(() => {
    const orgLabel = organization?.name?.trim() || orgSlug;
    document.title = `${orgLabel} · Members`;
  }, [organization?.name, orgSlug]);

  return (
    <div className="space-y-6">
      <OrgPageHero
        title="Members"
        orgSlug={orgSlug}
        orgName={organization?.name}
        imageUrl={organization?.imageUrl}
        imageSeed={organization?.id}
        subtitle={
          <>
            Review access across your workspace, monitor pending invitations, and keep a tight
            signal on who can touch workspace projects.
          </>
        }
        tags={
          <>
            <OrgRoleBadge role={membership?.role} />
            <Badge variant="outline">Workspace directory</Badge>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OrgMetricCard
          label="Members"
          value={memberships ? memberships.count : "..."}
          hint="Workspace members"
          icon={<IconUsers className="size-4" />}
          tone="accent"
        />
        <OrgMetricCard
          label="Admins"
          value={memberships ? adminCount : "..."}
          hint="Members with elevated access"
          icon={<IconShieldStar className="size-4" />}
        />
        <OrgMetricCard
          label="Pending Invites"
          value={invitations ? invitations.count : "..."}
          hint="Invitations waiting for acceptance"
          icon={<IconMailShare className="size-4" />}
          tone={(invitations?.count ?? 0) > 0 ? "accent" : "muted"}
        />
        <OrgMetricCard
          label="Join Requests"
          value={membershipRequests ? membershipRequests.count : "..."}
          hint="Membership requests requiring review"
          icon={<IconUserCheck className="size-4" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <OrgSectionCard
          title="Directory"
          description="Search and inspect current workspace members."
        >
          <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <IconUserSearch className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.currentTarget.value)}
                  placeholder="Search by name, email, or role"
                  className="pl-9"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={sortMode}
                  onValueChange={(value) => {
                    if (!value) {
                      return;
                    }
                    setSortMode(value as SortMode);
                  }}
                >
                  <SelectTrigger className="h-8 w-64 gap-2">
                    <IconFilter className="size-3.5 text-muted-foreground" />
                    <span className="truncate">{SORT_MODE_LABELS[sortMode]}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alphabetical_asc">Alphabetical (A-Z)</SelectItem>
                    <SelectItem value="alphabetical_desc">Alphabetical (Z-A)</SelectItem>
                    <SelectItem value="role_grouped">Grouped by role</SelectItem>
                    <SelectItem value="newest_added">Added at (newest first)</SelectItem>
                    <SelectItem value="oldest_added">Added at (oldest first)</SelectItem>
                    <SelectItem value="email_asc">Email/identifier (A-Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {memberships?.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-3 rounded-xl border p-3">
                    <Skeleton className="size-10 rounded-md" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                ))}
              </div>
            ) : sortedMembers.length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                {allMembers.length === 0
                  ? "No members found for this workspace yet."
                  : "No members match the current search."}
              </div>
            ) : (
              <div className="space-y-2">
                {sortedMembers.map((memberRow) => {
                  const publicUserData = memberRow.publicUserData;
                  const name = displayName({
                    firstName: publicUserData?.firstName ?? null,
                    lastName: publicUserData?.lastName ?? null,
                    identifier: publicUserData?.identifier ?? "member",
                  });
                  const avatarSrc =
                    publicUserData?.imageUrl ??
                    generateGradientDataUrl(publicUserData?.userId ?? memberRow.id);
                  const isCurrentUser =
                    membership?.publicUserData?.userId != null &&
                    publicUserData?.userId === membership.publicUserData.userId;

                  return (
                    <div
                      key={memberRow.id}
                      className="flex flex-col gap-3 rounded-xl border bg-background/80 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar size="lg">
                          <AvatarImage src={avatarSrc} />
                          <AvatarFallback>{initials(name) || "MB"}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium">{name}</p>
                            {isCurrentUser ? <Badge variant="outline">You</Badge> : null}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {publicUserData?.identifier ?? "Unknown identifier"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <Badge variant="outline">{memberRow.roleName || memberRow.role}</Badge>
                        <p className="text-xs text-muted-foreground">
                          Added {formatDate(memberRow.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </OrgSectionCard>

        <div className="space-y-4">
          <OrgSectionCard title="Invitation queue" description="People invited to join this workspace.">
            <div className="space-y-2">
              {invitations?.isLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="rounded-lg border p-3">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="mt-2 h-3 w-24" />
                  </div>
                ))
              ) : allInvites.length === 0 ? (
                <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  No pending invitations.
                </div>
              ) : (
                allInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="rounded-xl border bg-background/80 p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium">{invite.emailAddress}</p>
                      <Badge variant="outline">{invite.status}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{invite.roleName || invite.role}</span>
                      <span>•</span>
                      <span>Invited {formatDate(invite.createdAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </OrgSectionCard>

          <OrgSectionCard title="Membership requests" description="Inbound requests to join.">
            <div className="space-y-2">
              {membershipRequests?.isLoading ? (
                Array.from({ length: 2 }).map((_, index) => (
                  <div key={index} className="rounded-lg border p-3">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="mt-2 h-3 w-20" />
                  </div>
                ))
              ) : allRequests.length === 0 ? (
                <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  No join requests right now.
                </div>
              ) : (
                allRequests.map((request) => {
                  const name = displayName({
                    firstName: request.publicUserData.firstName,
                    lastName: request.publicUserData.lastName,
                    identifier: request.publicUserData.identifier,
                  });
                  const avatarSrc =
                    request.publicUserData.imageUrl ??
                    generateGradientDataUrl(request.publicUserData.userId ?? request.id);

                  return (
                    <div
                      key={request.id}
                      className="flex items-center gap-3 rounded-xl border bg-background/80 p-3"
                    >
                      <Avatar>
                        <AvatarImage src={avatarSrc} />
                        <AvatarFallback>{initials(name) || "RQ"}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {request.publicUserData.identifier}
                        </p>
                      </div>
                      <Badge variant="outline">{request.status}</Badge>
                    </div>
                  );
                })
              )}
            </div>
          </OrgSectionCard>
        </div>
      </div>
    </div>
  );
}
