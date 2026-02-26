import { useAuth } from "@clerk/react-router";
import { useQuery } from "convex/react";
import { IconUserCircle } from "@tabler/icons-react";
import { NavLink, Navigate, Outlet, useLocation, useParams } from "react-router-dom";

import { Logo } from "@/components/custom/logo";
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
import { api } from "@convex/_generated/api";

const navItems = [
  { label: "Overview", icon: IconUserCircle, segment: "overview" },
] as const;

export function Layout() {
  const { userSlug = "user" } = useParams();
  const { pathname } = useLocation();
  const { isLoaded, isSignedIn } = useAuth();
  const currentUser = useQuery(api.users.getCurrentUser, {});
  useEnsureCurrentUserRecord();

  const userBasePath = `/u/${userSlug}`;
  const relativePath = pathname.startsWith(userBasePath)
    ? pathname.slice(userBasePath.length).replace(/^\/+/, "")
    : "";
  const activeSegment = relativePath.split("/").filter(Boolean)[0] ?? "overview";
  const activeTitle = navItems.find((item) => item.segment === activeSegment)?.label ?? "Account";

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

  if (currentUser === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Preparing account...
      </div>
    );
  }

  if (currentUser !== null && currentUser.slug !== userSlug) {
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
                  const href = `/u/${currentUser?.slug ?? userSlug}/${item.segment}`;
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

        <SidebarFooter className="text-xs text-muted-foreground">
          <p className="truncate">@{currentUser?.slug ?? userSlug}</p>
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

        <div className="p-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
