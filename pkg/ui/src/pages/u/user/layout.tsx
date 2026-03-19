import { useAuth, useClerk, useUser } from "@clerk/react-router";
import { useQuery } from "convex/react";
import {
  IconArrowLeft,
  IconChevronRight,
  IconChevronUp,
  IconHome2,
  IconLogout2,
  IconSettings,
  IconSettingsCog,
} from "@tabler/icons-react";
import { useState } from "react";
import { NavLink, Navigate, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";

import { Logo } from "@/components/custom/logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonPlaceholder } from "@/components/ui/skeleton-placeholder";
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
import { generateGradientDataUrl } from "@/lib/generate-gradient";
import { initials } from "@/lib/org-utils";
import { api } from "@convex/_generated/api";
import { useTheme } from "theme-watcher";

const profileCardLinks = [
  { label: "Profile Information", sectionId: "profile-information" },
  { label: "Free Workspace Credit", sectionId: "free-workspace-credit" },
  { label: "Appearance Defaults", sectionId: "appearance-defaults" },
] as const;

const securityCardLinks = [
  { label: "Linked Accounts", sectionId: "linked-accounts" },
  { label: "Sessions", sectionId: "sessions" },
  { label: "Danger Zone", sectionId: "danger-zone" },
] as const;

function SidebarUserMenu({
  dashboardPath,
  userPath,
  currentUserSlug,
}: {
  dashboardPath: string;
  userPath: string;
  currentUserSlug: string;
}) {
  const navigate = useNavigate();
  const { user } = useUser();
  const clerk = useClerk();
  const { resolvedTheme, toggleMode } = useTheme();

  const displayName =
    user?.fullName?.trim() || user?.username?.trim() || user?.firstName?.trim() || "Account";
  const email =
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? null;
  const avatarSeed = user?.id ?? currentUserSlug ?? "user";
  const avatarSrc = user?.imageUrl ?? generateGradientDataUrl(avatarSeed, { size: 96 });

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
              void navigate(userPath);
            }}
          >
            <IconSettingsCog />
            <span>Profile settings</span>
            <DropdownMenuShortcut>U</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              void navigate(dashboardPath);
            }}
          >
            <IconHome2 />
            <span>Go to Dashboard</span>
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
  const { userSlug = "user" } = useParams();
  const { pathname, hash } = useLocation();
  const { isLoaded, isSignedIn, orgSlug: activeOrgSlug } = useAuth();
  const currentUser = useQuery(api.users.getCurrentUser, {});
  useEnsureCurrentUserRecord();

  const userBasePath = `/u/${userSlug}`;
  const relativePath = pathname.startsWith(userBasePath)
    ? pathname.slice(userBasePath.length).replace(/^\/+/, "")
    : "";
  const activeLegacySegment = relativePath.split("/").filter(Boolean)[0] ?? "";
  const requestedSectionIdFromPath = (() => {
    if (activeLegacySegment === "profile" || activeLegacySegment === "overview") {
      return "profile-information";
    }
    if (activeLegacySegment === "security") {
      return "linked-accounts";
    }
    return "";
  })();
  const requestedSectionId = hash.replace(/^#/, "") || requestedSectionIdFromPath;
  const activeSectionId = [...profileCardLinks, ...securityCardLinks].some(
    (item) => item.sectionId === requestedSectionId,
  )
    ? requestedSectionId
    : "profile-information";
  const isProfileSectionActive = profileCardLinks.some(
    (item) => item.sectionId === activeSectionId,
  );
  const isSecuritySectionActive = securityCardLinks.some(
    (item) => item.sectionId === activeSectionId,
  );
  const [isProfileOpen, setIsProfileOpen] = useState(isProfileSectionActive);
  const [isSecurityOpen, setIsSecurityOpen] = useState(isSecuritySectionActive);

  if (isProfileSectionActive && !isProfileOpen) {
    setIsProfileOpen(true);
  }

  if (isSecuritySectionActive && !isSecurityOpen) {
    setIsSecurityOpen(true);
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen gap-4 p-4">
        <Skeleton className="hidden w-16 shrink-0 rounded-2xl md:block" />
        <div className="flex-1 space-y-4">
          <div className="flex h-14 items-center gap-3 rounded-2xl border px-4">
            <Skeleton className="size-8 rounded-full" />
            <SkeletonPlaceholder
              className="w-32 rounded-md"
              content={<p className="text-sm text-muted-foreground">Loading account...</p>}
            />
          </div>
          <div className="space-y-4 rounded-2xl border p-6">
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/auth/sso" replace />;
  }

  if (currentUser === undefined || currentUser === null) {
    return (
      <div className="flex min-h-screen gap-4 p-4">
        <Skeleton className="hidden w-16 shrink-0 rounded-2xl md:block" />
        <div className="flex-1 space-y-4">
          <div className="flex h-14 items-center gap-3 rounded-2xl border px-4">
            <Skeleton className="size-8 rounded-full" />
            <SkeletonPlaceholder
              className="w-36 rounded-md"
              content={<p className="text-sm text-muted-foreground">Preparing account...</p>}
            />
          </div>
          <div className="space-y-4 rounded-2xl border p-6">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-36 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (currentUser.slug !== userSlug) {
    return <Navigate to={`/u/${currentUser.slug}#${activeSectionId}`} replace />;
  }

  const userPath = `/u/${currentUser.slug}#profile-information`;
  const dashboardPath = activeOrgSlug ? `/o/${activeOrgSlug}/overview` : "/o/select";

  return (
    <SidebarProvider>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader className="flex items-center justify-center">
          <Logo className="w-5" />
        </SidebarHeader>

        <SidebarContent>
          <Collapsible
            open={isProfileOpen}
            onOpenChange={(nextOpen) => {
              setIsProfileOpen(nextOpen);
            }}
            className="group/collapsible"
          >
            <SidebarGroup>
              <SidebarGroupLabel
                render={<CollapsibleTrigger />}
                className={`group/label text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${isProfileSectionActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""}`}
              >
                Profile
                <IconChevronRight
                  className={`ml-auto transition-transform ${isProfileOpen ? "rotate-90" : ""}`}
                />
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-1">
                    {profileCardLinks.map((item) => {
                      const href = `/u/${currentUser.slug}#${item.sectionId}`;
                      const isActive = activeSectionId === item.sectionId;

                      return (
                        <SidebarMenuItem key={item.sectionId}>
                          <SidebarMenuButton
                            className="pl-5 text-muted-foreground"
                            isActive={isActive}
                            render={<a href={href} />}
                          >
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>

          <Collapsible
            open={isSecurityOpen}
            onOpenChange={(nextOpen) => {
              setIsSecurityOpen(nextOpen);
            }}
            className="group/collapsible"
          >
            <SidebarGroup>
              <SidebarGroupLabel
                render={<CollapsibleTrigger />}
                className={`group/label text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${isSecuritySectionActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""}`}
              >
                Security
                <IconChevronRight
                  className={`ml-auto transition-transform ${isSecurityOpen ? "rotate-90" : ""}`}
                />
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-1">
                    {securityCardLinks.map((item) => {
                      const href = `/u/${currentUser.slug}#${item.sectionId}`;
                      const isActive = activeSectionId === item.sectionId;

                      return (
                        <SidebarMenuItem key={item.sectionId}>
                          <SidebarMenuButton
                            className="pl-5 text-muted-foreground"
                            isActive={isActive}
                            render={<a href={href} />}
                          >
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        </SidebarContent>

        <SidebarFooter className="gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="justify-start group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1"
            nativeButton={false}
            render={<NavLink to={dashboardPath} />}
          >
            <IconArrowLeft />
            <span className="group-data-[collapsible=icon]:hidden">Go back</span>
          </Button>
          <SidebarUserMenu
            dashboardPath={dashboardPath}
            userPath={userPath}
            currentUserSlug={currentUser.slug}
          />
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="border-b px-4 py-3 lg:px-6">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>{currentUser.slug}</BreadcrumbPage>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Profile</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="p-6 lg:p-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
