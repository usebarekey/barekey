import {
  useAuth,
  useClerk,
  useOrganizationList,
  OrganizationSwitcher,
  SignedIn,
  useUser,
} from "@clerk/react-router";
import { useQuery } from "convex/react";
import {
  IconChevronUp,
  IconBriefcase,
  IconChartBar,
  IconCoin,
  IconCreditCard,
  IconLogout2,
  IconPlus,
  IconSettings,
  IconSettingsCog,
  IconUserCircle,
  IconUsers,
} from "@tabler/icons-react";
import { capitalCase } from "change-case";
import { useEffect, useRef, useState } from "react";
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
import { api } from "@convex/_generated/api";

const navItems = [
  { label: "Overview", icon: IconChartBar, segment: "overview" },
  { label: "Projects", icon: IconBriefcase, segment: "projects" },
  { label: "Members", icon: IconUsers, segment: "members" },
  { label: "Settings", icon: IconSettings, segment: "settings" },
] as const;

const CREATE_NEW_ORG_SELECT_VALUE = "__create_new_org__";

function OrgSwitcherControl() {
  return (
    <OrganizationSwitcher
      hidePersonal={true}
      afterCreateOrganizationUrl={(organization) =>
        organization.slug ? `/o/${organization.slug}/overview` : "/o/select"
      }
      afterSelectOrganizationUrl={(organization) =>
        organization.slug ? `/o/${organization.slug}/overview` : "/o/select"
      }
    />
  );
}

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
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <Avatar size="sm" className="mr-1">
        <AvatarImage src={avatarSrc} />
        <AvatarFallback>{initials(name) || "OR"}</AvatarFallback>
      </Avatar>
      <span className="truncate text-sm">{name}</span>
    </div>
  );
}

function SidebarUserMenu() {
  const navigate = useNavigate();
  const { user } = useUser();
  const clerk = useClerk();
  const currentUser = useQuery(api.users.getCurrentUser, {});

  const displayName =
    user?.fullName?.trim() || user?.username?.trim() || user?.firstName?.trim() || "Account";
  const email =
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? null;
  const avatarSeed = user?.id ?? currentUser?.slug ?? "user";
  const avatarSrc = user?.imageUrl ?? generateGradientDataUrl(avatarSeed, { size: 96 });
  const userPath = currentUser?.slug ? `/u/${currentUser.slug}/overview` : null;

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
          <p className="truncate text-xs text-sidebar-foreground/70">{email ?? "No email"}</p>
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
                void navigate(`${userPath}?panel=settings`);
              }
            }}
            disabled={userPath === null}
          >
            <IconSettingsCog />
            <span>User settings</span>
            <Badge variant="outline" className="ml-auto h-4 px-1 text-[10px]">
              Soon
            </Badge>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => {
              if (userPath) {
                void navigate(`${userPath}?panel=billing`);
              }
            }}
            disabled={userPath === null}
          >
            <IconCreditCard />
            <span>Billing</span>
            <Badge variant="outline" className="ml-auto h-4 px-1 text-[10px]">
              Soon
            </Badge>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => {
              void navigate("/o/select");
            }}
          >
            <IconCoin />
            <span>Switch workspace</span>
            <DropdownMenuShortcut>O</DropdownMenuShortcut>
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
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isLoaded: isAuthLoaded, isSignedIn, orgSlug: activeOrgSlug } = useAuth();
  const {
    isLoaded: isOrgListLoaded,
    setActive,
    userMemberships,
  } = useOrganizationList({
    userMemberships: true,
  });
  const [switchError, setSwitchError] = useState<string | null>(null);
  const lastRequestedOrgIdRef = useRef<string | null>(null);
  useEnsureCurrentUserRecord();

  const orgBasePath = `/o/${orgSlug}`;
  const relativePath = pathname.startsWith(orgBasePath)
    ? pathname.slice(orgBasePath.length).replace(/^\/+/, "")
    : "";
  const activeSegment = relativePath.split("/").filter(Boolean)[0] ?? "overview";
  const activeTitle =
    navItems.find((item) => item.segment === activeSegment)?.label ?? capitalCase(activeSegment);

  const memberships = userMemberships.data ?? [];
  const selectableMemberships = memberships.filter((membership) =>
    Boolean(membership.organization.slug),
  );
  const matchingMembership =
    memberships.find((membership) => membership.organization.slug === orgSlug) ?? null;
  const routeMatchesActiveOrg = activeOrgSlug === orgSlug;

  useEffect(() => {
    if (!isAuthLoaded || !isSignedIn || !isOrgListLoaded) {
      return;
    }

    if (routeMatchesActiveOrg) {
      lastRequestedOrgIdRef.current = null;
      setSwitchError(null);
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
    setSwitchError(null);
    void setActive({ organization: targetOrgId }).catch((error: unknown) => {
      lastRequestedOrgIdRef.current = null;
      setSwitchError(error instanceof Error ? error.message : "Failed to switch organization.");
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
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading organization workspace...
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
          <div className="w-full max-w-md rounded-xl border p-5">
            <p className="text-sm font-medium">Switching organization...</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Setting <span className="font-mono">{orgSlug}</span> as your active workspace.
            </p>
            {switchError ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <p className="text-sm text-destructive">{switchError}</p>
                <Button size="sm" variant="outline" nativeButton={false} render={<Link to="/o/select" />}>
                  Go to org selector
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-lg space-y-4 rounded-xl border p-5">
          <div>
            <p className="text-sm font-medium">Organization not available</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You do not have access to <span className="font-mono">{orgSlug}</span>, or the
              organization is missing a slug.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" nativeButton={false} render={<Link to="/o/select" />}>
              Select org
            </Button>
            <Button variant="outline" nativeButton={false} render={<Link to="/o/new" />}>
              Create org
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
                  void navigate("/o/new");
                  return;
                }

                void navigate(`/o/${nextOrgSlug}/${activeSegment}`);
              }}
            >
              <SelectTrigger className="w-full">
                {matchingMembership ? (
                  <OrgSelectTriggerContent
                    name={matchingMembership.organization.name}
                    imageUrl={matchingMembership.organization.imageUrl}
                    seed={matchingMembership.organization.id}
                  />
                ) : (
                  <SelectValue placeholder="Select organization" />
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
                    <span>Create new organization</span>
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Organization</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const href = `/o/${orgSlug}/${item.segment}`;
                  const isActive =
                    item.segment === "overview"
                      ? pathname === `/o/${orgSlug}` || pathname === href
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
        </SidebarContent>

        <SidebarFooter>
          <SidebarUserMenu />
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-20 border-b bg-background/85 px-4 py-3 backdrop-blur-sm lg:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <Separator orientation="vertical" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{activeTitle}</p>
                <p className="truncate text-xs text-muted-foreground">@{orgSlug}</p>
              </div>
            </div>
            <SignedIn>
              <div className="hidden sm:block">
                <OrgSwitcherControl />
              </div>
            </SignedIn>
          </div>
        </header>

        <div className="relative min-h-[calc(100svh-57px)]">
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(circle at 12% 8%, color-mix(in oklab, var(--primary) 9%, transparent), transparent 45%), radial-gradient(circle at 88% 0%, color-mix(in oklab, var(--foreground) 4%, transparent), transparent 38%)",
            }}
          />
          <div className="relative mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
