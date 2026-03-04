import { useAuth, useOrganizationList } from "@clerk/react-router";
import { useQuery } from "convex/react";
import {
  IconActivity,
  IconBriefcase,
  IconShieldLock,
  IconSettingsCog,
  IconUserCircle,
} from "@tabler/icons-react";
import { useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";

import { Logo } from "@/components/custom/logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { api } from "@convex/_generated/api";

const CREATE_WORKSPACE_SELECT_VALUE = "__create_workspace__";
const NO_WORKSPACE_SELECT_VALUE = "__no_workspace__";

const navItems = [
  { label: "Overview", icon: IconUserCircle, segment: "overview" },
  { label: "Profile", icon: IconSettingsCog, segment: "profile" },
  { label: "Security", icon: IconShieldLock, segment: "security" },
  { label: "Workspaces", icon: IconBriefcase, segment: "workspaces" },
  { label: "Activity", icon: IconActivity, segment: "activity" },
] as const;

export function Layout() {
  const navigate = useNavigate();
  const { userSlug = "user" } = useParams();
  const { pathname } = useLocation();
  const { isLoaded, isSignedIn, orgSlug: activeOrgSlug } = useAuth();
  const {
    isLoaded: isOrgListLoaded,
    setActive,
    userMemberships,
  } = useOrganizationList({
    userMemberships: true,
  });
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [isSwitchingWorkspace, setIsSwitchingWorkspace] = useState(false);
  const currentUser = useQuery(api.users.getCurrentUser, {});
  useEnsureCurrentUserRecord();

  const userBasePath = `/u/${userSlug}`;
  const relativePath = pathname.startsWith(userBasePath)
    ? pathname.slice(userBasePath.length).replace(/^\/+/, "")
    : "";
  const activeSegment = relativePath.split("/").filter(Boolean)[0] ?? "overview";
  const activeTitle = navItems.find((item) => item.segment === activeSegment)?.label ?? "Account";

  const memberships = userMemberships.data ?? [];
  const selectableMemberships = memberships.filter((membership) =>
    Boolean(membership.organization.slug),
  );
  const activeWorkspaceMembership =
    selectableMemberships.find((membership) => membership.organization.slug === activeOrgSlug) ?? null;
  const workspaceSelectValue =
    activeWorkspaceMembership?.organization.slug ?? NO_WORKSPACE_SELECT_VALUE;

  async function handleWorkspaceSwitch(nextOrgSlug: string) {
    if (
      nextOrgSlug === NO_WORKSPACE_SELECT_VALUE ||
      nextOrgSlug === CREATE_WORKSPACE_SELECT_VALUE ||
      isSwitchingWorkspace
    ) {
      if (nextOrgSlug === CREATE_WORKSPACE_SELECT_VALUE) {
        void navigate("/new?type=organization");
      }
      return;
    }

    const nextMembership = selectableMemberships.find(
      (membership) => membership.organization.slug === nextOrgSlug,
    );
    if (!nextMembership) {
      return;
    }

    setIsSwitchingWorkspace(true);
    setSwitchError(null);

    try {
      if (!setActive) {
        throw new Error("Workspace switching is unavailable right now.");
      }
      await setActive({ organization: nextMembership.organization.id });
      void navigate(`/o/${nextOrgSlug}/overview`);
    } catch (error: unknown) {
      setSwitchError(error instanceof Error ? error.message : "Failed to switch workspace.");
    } finally {
      setIsSwitchingWorkspace(false);
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading account...
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/auth/sso" replace />;
  }

  if (currentUser === undefined || currentUser === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Preparing account...
      </div>
    );
  }

  if (currentUser.slug !== userSlug) {
    return <Navigate to={`/u/${currentUser.slug}/${activeSegment}`} replace />;
  }

  return (
    <SidebarProvider>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader className="flex items-center justify-center">
          <Logo className="w-5" />
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Account</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const href = `/u/${currentUser.slug}/${item.segment}`;
                  const isActive =
                    item.segment === "overview"
                      ? pathname === `/u/${userSlug}` || pathname === href
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

        <SidebarFooter className="gap-2 text-xs text-muted-foreground">
          <p className="truncate group-data-[collapsible=icon]:hidden">@{currentUser.slug}</p>
          <Select
            value={workspaceSelectValue}
            onValueChange={(value) => {
              if (value === null) {
                return;
              }
              void handleWorkspaceSwitch(value);
            }}
          >
            <SelectTrigger className="w-full group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-lg group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-1 group-data-[collapsible=icon]:[&>svg:last-child]:hidden">
              <SelectValue>
                {activeWorkspaceMembership ? (
                  <span className="truncate">{activeWorkspaceMembership.organization.name}</span>
                ) : (
                  <span className="truncate text-muted-foreground">No workspace selected</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="start">
              {selectableMemberships.length > 0 ? (
                selectableMemberships.map((membership) => (
                  <SelectItem
                    key={membership.organization.id}
                    value={membership.organization.slug ?? NO_WORKSPACE_SELECT_VALUE}
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">{membership.organization.name}</span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        @{membership.organization.slug}
                      </span>
                    </div>
                  </SelectItem>
                ))
              ) : (
                <SelectItem value={NO_WORKSPACE_SELECT_VALUE} disabled={true}>
                  No workspaces available
                </SelectItem>
              )}
              <SelectSeparator />
              <SelectItem value={CREATE_WORKSPACE_SELECT_VALUE}>Create workspace</SelectItem>
            </SelectContent>
          </Select>
          {switchError ? <p className="text-xs text-destructive">{switchError}</p> : null}
          {!isOrgListLoaded ? <p className="text-xs">Loading workspaces...</p> : null}
          <Button
            size="sm"
            variant="outline"
            className="justify-start group-data-[collapsible=icon]:hidden"
            nativeButton={false}
            render={<Link to="/o/select" />}
          >
            Organization selector
          </Button>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="border-b px-4 py-3 lg:px-6">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" />
            <p className="text-sm font-medium">{activeTitle}</p>
          </div>
        </header>

        <div className="p-6 lg:p-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
