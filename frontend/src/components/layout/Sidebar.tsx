"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Map, Ship, MessageSquare, X } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarRail, SidebarSeparator, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { NavUser } from "@/components/layout/NavUser";

const navigation = [
  { label: "Overview", items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard }] },
  {
    label: "Operations", items: [
      { title: "Route Planner", url: "/planner", icon: Map },
      { title: "Ferry Schedules", url: "/schedules", icon: Ship },
    ]
  },
  { label: "Intelligence", items: [{ title: "Logistics Oracle", url: "/oracle", icon: MessageSquare }] },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();
  const closeMobile = () => { if (isMobile) setOpenMobile(false); };

  return (
    <Sidebar variant="inset" collapsible="icon" role="navigation" aria-label="Main navigation">
      <SidebarHeader className="h-(--header-height) justify-center">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-1">
            <SidebarMenuButton
              size="lg"
              render={<Link href="/" />}
              tooltip="SmartFlow dashboard"
              onClick={closeMobile}
              className="h-10 rounded-lg hover:bg-sidebar-accent"
            >
              <Image src="/logo-icon.png" alt="" width={32} height={32} className="size-6 shrink-0 object-contain" />
              <span className="text-lg font-semibold tracking-tight text-primary">SmartFlow</span>
            </SidebarMenuButton>
            {isMobile && (
              <Button variant="ghost" size="icon" className="size-9 shrink-0 rounded-lg" aria-label="Close navigation" onClick={() => setOpenMobile(false)}>
                <X />
              </Button>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent className="gap-2 py-2">
        {navigation.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel className="text-[11px] font-medium tracking-wide">{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.url || pathname.startsWith(item.url + "/");
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        render={<Link href={item.url} aria-current={isActive ? "page" : undefined} />}
                        isActive={isActive}
                        tooltip={item.title}
                        onClick={closeMobile}
                        className="h-10 rounded-lg px-3 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground data-active:text-sidebar-primary-foreground data-active:hover:text-sidebar-primary-foreground"
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter><NavUser /></SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
