import { Logo } from "@/components/custom/logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  IconBriefcase,
  IconChartBar,
} from "@tabler/icons-react";
import type { CSSProperties } from "react";
import { NavLink, Outlet, useLocation, useParams } from "react-router-dom";

const navItems = [
  { label: "Overview", icon: IconChartBar, segment: "overview" },
  { label: "Projects", icon: IconBriefcase, segment: "projects" },
] as const;

export function Layout() {
  const { userId = "user" } = useParams();
  const { pathname } = useLocation();
  const userBasePath = `/@/${userId}`;
  const relativePath = pathname.startsWith(userBasePath)
    ? pathname.slice(userBasePath.length).replace(/^\/+/, "")
    : "";
  const activeSegment = relativePath.split("/").filter(Boolean)[0] ?? "overview";
  const activeTitle =
    navItems.find((item) => item.segment === activeSegment)?.label ??
    activeSegment
      .split("-")
      .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
      .join(" ");

  return (
    <SidebarProvider>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader className="flex justify-center items-center">
          <Logo className="w-5" />
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const href = `/@/${userId}/${item.segment}`;
                  const isActive =
                    item.segment === "overview"
                      ? pathname === `/@/${userId}` || pathname === href
                      : pathname.startsWith(href);

                  return (
                    <SidebarMenuItem key={item.segment}>
                      <SidebarMenuButton
                        isActive={isActive}
                        render={<NavLink to={href} />}
                      >
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

        <SidebarFooter>123</SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="border-b px-4 py-3 lg:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <Separator orientation="vertical" />
              <p className="text-sm font-medium">{activeTitle}</p>
            </div>
          </div>
        </header>

        <div className="p-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
