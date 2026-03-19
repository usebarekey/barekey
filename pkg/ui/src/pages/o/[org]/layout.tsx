import { useAuth, useClerk, useOrganizationList, useUser } from "@clerk/react-router";
import { useQuery } from "convex/react";
import {
  IconChevronUp,
  IconChevronRight,
  IconBriefcase,
  IconChartBar,
  IconCreditCard,
  IconHistory,
  IconLogout2,
  IconPlus,
  IconSettings,
  IconSettingsCog,
  IconUserCircle,
  IconUsers,
} from "@tabler/icons-react";
import { capitalCase } from "change-case";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import { Logo } from "@/components/custom/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useEnsureCurrentUserRecord } from "@/hooks/use-ensure-current-user-record";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { generateGradientDataUrl } from "@/lib/generate-gradient";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonPlaceholder } from "@/components/ui/skeleton-placeholder";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@convex/_generated/api";
import { listLocallyDeletedOrgIds, subscribeToDeletedOrgIds } from "@/lib/deleted-orgs";
import { useTheme } from "theme-watcher";

const primaryNavItems = [
  { label: "Overview", icon: IconChartBar, segment: "overview" },
  { label: "Projects", icon: IconBriefcase, segment: "projects" },
  { label: "Audit", icon: IconHistory, segment: "audit" },
  { label: "Members", icon: IconUsers, segment: "members" },
  { label: "Billing", icon: IconCreditCard, segment: "billing" },
] as const;

const settingsAnchorItems = [
  { label: "Workspace profile", sectionId: "workspace-profile" },
  { label: "Workspace image", sectionId: "workspace-image" },
  { label: "Member access", sectionId: "member-access" },
  { label: "Danger zone", sectionId: "danger-zone" },
] as const;

const CREATE_NEW_ORG_SELECT_VALUE = "__create_new_org__";

function initials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");
}

function OrgSelectItem({
  value,
  name,
  imageUrl,
  seed,
}: {
  value: string;
  name: string;
  imageUrl?: string | null;
  seed: string;
}) {
  const avatarSrc = imageUrl ?? generateGradientDataUrl(seed, { size: 64 });

  return (
    <SelectItem value={value}>
      <Avatar size="sm" className="mr-1">
        <AvatarImage src={avatarSrc} />
        <AvatarFallback>{initials(name) || "OR"}</AvatarFallback>
      </Avatar>
      <span className="truncate">{name}</span>
    </SelectItem>
  );
}

function OrgSelectTriggerContent({
  name,
  imageUrl,
  seed,
}: {
  name: string;
  imageUrl?: string | null;
  seed: string;
}) {
  const avatarSrc = imageUrl ?? generateGradientDataUrl(seed, { size: 64 });

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 group-data-[collapsible=icon]:justify-center">
      <Avatar size="sm" className="mr-1 group-data-[collapsible=icon]:mr-0">
        <AvatarImage src={avatarSrc} />
        <AvatarFallback>{initials(name) || "OR"}</AvatarFallback>
      </Avatar>
      <span className="truncate text-sm group-data-[collapsible=icon]:hidden">{name}</span>
    </div>
  );
}

function SidebarUserMenu() {
  const navigate = useNavigate();
  const { user } = useUser();
  const clerk = useClerk();
  const { resolvedTheme, toggleMode } = useTheme();
  const currentUser = useQuery(api.users.getCurrentUser, {});

  const displayName =
    user?.fullName?.trim() || user?.username?.trim() || user?.firstName?.trim() || "Account";
  const email =
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? null;
  const avatarSeed = user?.id ?? currentUser?.slug ?? "user";
  const avatarSrc = user?.imageUrl ?? generateGradientDataUrl(avatarSeed, { size: 96 });
  const userPath = currentUser?.slug ? `/u/${currentUser.slug}#profile` : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={
          "ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground flex w-full items-center gap-2 rounded-xl border border-sidebar-border/70 bg-sidebar-accent/40 p-2 text-left outline-hidden transition-colors group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-lg group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-1"
        }
      >
        <Avatar size="sm" className="border-sidebar-border group-data-[collapsible=icon]:size-6">
          <AvatarImage src={avatarSrc} />
          <AvatarFallback>{initials(displayName) || "U"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
          <p className="truncate text-sm font-medium">{displayName}</p>
          <p className="text-muted-foreground truncate text-xs">{email ?? "No email"}</p>
        </div>
        <IconChevronUp className="size-4 text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-72 min-w-72 rounded-xl p-1.5"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-2">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={avatarSrc} />
                <AvatarFallback>{initials(displayName) || "U"}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{email ?? "No email"}</p>
              </div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => {
              if (userPath) {
                void navigate(userPath);
              }
            }}
            disabled={userPath === null}
          >
            <IconUserCircle />
            <span>Account overview</span>
            <DropdownMenuShortcut>U</DropdownMenuShortcut>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => {
              if (userPath) {
                void navigate(userPath.replace("/overview", "/profile"));
              }
            }}
            disabled={userPath === null}
          >
            <IconSettingsCog />
            <span>User settings</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => {
              toggleMode();
            }}
          >
            <IconSettings />
            <span>Toggle theme</span>
            <Badge variant="outline" className="ml-auto h-4 px-1 text-[10px]">
              {resolvedTheme === "dark" ? "Dark" : "Light"}
            </Badge>
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              void clerk.signOut({
                redirectUrl: "/auth/sso",
              });
            }}
          >
            <IconLogout2 />
            <span>Log out</span>
            <DropdownMenuShortcut>⇧Q</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Layout() {
  const { orgSlug = "org" } = useParams();
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();
  const {
    isLoaded: isAuthLoaded,
    isSignedIn,
    orgId: activeOrgId,
    orgSlug: activeOrgSlug,
  } = useAuth();
  const {
    isLoaded: isOrgListLoaded,
    setActive,
    userMemberships,
  } = useOrganizationList({
    userMemberships: true,
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const lastRequestedOrgIdRef = useRef<string | null>(null);
  useEnsureCurrentUserRecord();
  const locallyDeletedOrgIds = useSyncExternalStore(
    subscribeToDeletedOrgIds,
    listLocallyDeletedOrgIds,
    () => [],
  );

  const orgBasePath = `/o/${orgSlug}`;
  const relativePath = pathname.startsWith(orgBasePath)
    ? pathname.slice(orgBasePath.length).replace(/^\/+/, "")
    : "";
  const relativeSegments = relativePath.split("/").filter(Boolean);
  const activeSegment = relativeSegments[0] ?? "overview";
  const isSettingsRoute = activeSegment === "settings";
  const requestedSettingsSectionId = hash.replace(/^#/, "");
  const activeSettingsSectionId = settingsAnchorItems.some(
    (item) => item.sectionId === requestedSettingsSectionId,
  )
    ? requestedSettingsSectionId
    : "workspace-profile";
  const nextOrgSegment = activeSegment === "project" ? "projects" : activeSegment;
  const isProjectRoute = activeSegment === "project";
  const projectSlugSegment = isProjectRoute ? (relativeSegments[1] ?? null) : null;
  const projectPageSegment = isProjectRoute ? (relativeSegments[2] ?? "variables") : null;
  const projectPageTitle =
    projectPageSegment === null ? null : capitalCase(projectPageSegment.replaceAll("-", " "));
  const segmentTitles: Record<string, string> = {
    overview: "Overview",
    projects: "Projects",
    members: "Members",
    billing: "Billing",
    settings: "Settings",
  };
  const activeTitle =
    segmentTitles[nextOrgSegment] ?? capitalCase(nextOrgSegment.replaceAll("-", " "));

  const memberships = (userMemberships.data ?? []).filter(
    (membership) => !locallyDeletedOrgIds.includes(membership.organization.id),
  );
  const selectableMemberships = memberships.filter((membership) =>
    Boolean(membership.organization.slug),
  );
  const routeMatchesActiveOrg = activeOrgSlug === orgSlug;
  const matchingMembershipBySlug =
    memberships.find((membership) => membership.organization.slug === orgSlug) ?? null;
  const matchingMembershipByActiveOrgId =
    activeOrgId === null
      ? null
      : (memberships.find((membership) => membership.organization.id === activeOrgId) ?? null);
  const matchingMembership =
    matchingMembershipBySlug ?? (routeMatchesActiveOrg ? matchingMembershipByActiveOrgId : null);

  if (isSettingsRoute && !isSettingsOpen) {
    setIsSettingsOpen(true);
  }

  useEffect(() => {
    if (!isAuthLoaded || !isSignedIn || !isOrgListLoaded) {
      return;
    }

    if (routeMatchesActiveOrg && memberships.length > 0 && matchingMembership === null) {
      void navigate("/o/select", { replace: true });
    }
  }, [
    isAuthLoaded,
    isOrgListLoaded,
    isSignedIn,
    memberships.length,
    matchingMembership,
    navigate,
    routeMatchesActiveOrg,
  ]);

  useEffect(() => {
    if (!isAuthLoaded || !isSignedIn || !isOrgListLoaded) {
      return;
    }

    if (routeMatchesActiveOrg) {
      lastRequestedOrgIdRef.current = null;
      return;
    }

    if (matchingMembership === null) {
      return;
    }

    const targetOrgId = matchingMembership.organization.id;
    if (lastRequestedOrgIdRef.current === targetOrgId) {
      return;
    }

    lastRequestedOrgIdRef.current = targetOrgId;
    void setActive({ organization: targetOrgId }).catch((error: unknown) => {
      lastRequestedOrgIdRef.current = targetOrgId;
      console.error(error instanceof Error ? error.message : "Failed to switch workspace.");
    });
  }, [
    isAuthLoaded,
    isOrgListLoaded,
    isSignedIn,
    matchingMembership,
    routeMatchesActiveOrg,
    setActive,
  ]);

  if (!isAuthLoaded || !isOrgListLoaded) {
    return (
      <div className="flex min-h-screen gap-4 p-4">
        <Skeleton className="hidden w-16 shrink-0 rounded-2xl md:block" />
        <div className="flex-1 space-y-4">
          <div className="flex h-14 items-center gap-3 rounded-2xl border px-4">
            <Skeleton className="size-8 rounded-full" />
            <SkeletonPlaceholder
              className="w-36 rounded-md"
              content={<p className="text-sm text-muted-foreground">Loading workspace...</p>}
            />
          </div>
          <div className="space-y-4 rounded-2xl border p-6">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-44 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/auth/sso" replace />;
  }

  if (!routeMatchesActiveOrg) {
    if (matchingMembership !== null) {
      return (
        <div className="flex min-h-screen items-center justify-center px-4">
          <Spinner className="size-8" />
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-lg space-y-4 rounded-xl border p-5">
          <div>
            <p className="text-sm font-medium">Workspace not available</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You do not have access to <span className="font-mono">{orgSlug}</span>, or this
              workspace is unavailable.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" nativeButton={false} render={<Link to="/o/select" />}>
              Select workspace
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link to="/new?type=organization" />}
            >
              Create workspace
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader className="flex items-center justify-center">
          <Logo className="w-5" />
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <Select
              value={orgSlug}
              onValueChange={(nextOrgSlug) => {
                if (!nextOrgSlug || nextOrgSlug === orgSlug) {
                  return;
                }

                if (nextOrgSlug === CREATE_NEW_ORG_SELECT_VALUE) {
                  void navigate("/new?type=organization");
                  return;
                }

                void navigate(`/o/${nextOrgSlug}/${nextOrgSegment}`);
              }}
            >
              <SelectTrigger className="w-full group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-lg group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-1 group-data-[collapsible=icon]:[&>svg:last-child]:hidden">
                {matchingMembership ? (
                  <OrgSelectTriggerContent
                    name={matchingMembership.organization.name}
                    imageUrl={matchingMembership.organization.imageUrl}
                    seed={matchingMembership.organization.id}
                  />
                ) : (
                  <SelectValue placeholder="Select workspace" />
                )}
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {selectableMemberships.map((membership) => {
                    const membershipOrgSlug = membership.organization.slug;
                    if (!membershipOrgSlug) {
                      return null;
                    }

                    return (
                      <OrgSelectItem
                        key={membership.organization.id}
                        value={membershipOrgSlug}
                        name={membership.organization.name}
                        imageUrl={membership.organization.imageUrl}
                        seed={membership.organization.id}
                      />
                    );
                  })}
                </SelectGroup>
                <SelectSeparator />
                <SelectGroup>
                  <SelectItem
                    value={CREATE_NEW_ORG_SELECT_VALUE}
                    className="text-muted-foreground [&_svg]:text-muted-foreground"
                  >
                    <IconPlus />
                    <span>Create new workspace</span>
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Organization</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {primaryNavItems.map((item) => {
                  const href = `/o/${orgSlug}/${item.segment}`;
                  const isActive =
                    item.segment === "overview"
                      ? pathname === `/o/${orgSlug}` || pathname === href
                      : item.segment === "projects"
                        ? pathname.startsWith(href) || pathname.startsWith(`/o/${orgSlug}/project/`)
                        : pathname.startsWith(href);

                  return (
                    <SidebarMenuItem key={item.segment}>
                      <SidebarMenuButton isActive={isActive} render={<NavLink to={href} />}>
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <Collapsible
            open={isSettingsOpen}
            onOpenChange={(nextOpen) => {
              setIsSettingsOpen(nextOpen);
            }}
            className="group/collapsible"
          >
            <SidebarGroup>
              <SidebarGroupLabel
                render={<CollapsibleTrigger />}
                className={`group/label text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${isSettingsRoute ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""}`}
              >
                Settings
                <IconChevronRight
                  className={`ml-auto transition-transform ${isSettingsOpen ? "rotate-90" : ""}`}
                />
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-1">
                    {settingsAnchorItems.map((item) => (
                      <SidebarMenuItem key={item.sectionId}>
                        <SidebarMenuButton
                          className="pl-5 text-muted-foreground"
                          isActive={isSettingsRoute && activeSettingsSectionId === item.sectionId}
                          render={<NavLink to={`/o/${orgSlug}/settings#${item.sectionId}`} />}
                        >
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        </SidebarContent>

        <SidebarFooter>
          <SidebarUserMenu />
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-20 border-b bg-background/85 px-4 py-3 backdrop-blur-sm lg:px-6">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <Separator orientation="vertical" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink render={<NavLink to={`/o/${orgSlug}/overview`} />}>
                      {orgSlug}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  {isProjectRoute ? (
                    <>
                      <BreadcrumbItem>
                        <BreadcrumbLink render={<NavLink to={`/o/${orgSlug}/projects`} />}>
                          Projects
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      {projectSlugSegment ? (
                        <>
                          <BreadcrumbSeparator />
                          <BreadcrumbItem>
                            <BreadcrumbLink
                              render={
                                <NavLink
                                  to={`/o/${orgSlug}/project/${projectSlugSegment}/variables`}
                                />
                              }
                            >
                              {projectSlugSegment}
                            </BreadcrumbLink>
                          </BreadcrumbItem>
                        </>
                      ) : null}
                      {projectPageTitle ? (
                        <>
                          <BreadcrumbSeparator />
                          <BreadcrumbItem>
                            <BreadcrumbPage>{projectPageTitle}</BreadcrumbPage>
                          </BreadcrumbItem>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <BreadcrumbItem>
                      <BreadcrumbPage>{activeTitle}</BreadcrumbPage>
                    </BreadcrumbItem>
                  )}
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </div>
        </header>

        <div className="relative">
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(circle at 12% 8%, color-mix(in oklab, var(--primary) 9%, transparent), transparent 45%), radial-gradient(circle at 88% 0%, color-mix(in oklab, var(--foreground) 4%, transparent), transparent 38%)",
            }}
          />
          <div className="relative w-full p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
