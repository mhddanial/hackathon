"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Map, Ship, Compass, MessageSquare, X } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Route Planner", url: "/planner", icon: Map },
  { title: "Ferry Schedules", url: "/schedules", icon: Ship },
  { title: "Logistics Oracle", url: "/oracle", icon: MessageSquare },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="h-20 flex flex-row items-center justify-between px-6 border-b border-sidebar-border/50">
        <Link href="/" className="text-sidebar-primary font-bold text-xl tracking-tight md:w-full md:text-left hover:opacity-80 transition-opacity">
          SmartFlow
        </Link>
        {isMobile && (
          <Button variant="ghost" size="icon" className="md:hidden text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => setOpenMobile(false)}>
            <X className="w-5 h-5" />
          </Button>
        )}
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="pt-4">
            <SidebarMenu className="gap-2 px-2">
              {items.map((item) => {
                const isActive = pathname === item.url;
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      render={<Link href={item.url} />}
                      isActive={isActive}
                      className="h-11 px-4 font-semibold transition-colors"
                      onClick={() => {
                        if (isMobile) setOpenMobile(false);
                      }}
                    >
                      <item.icon className="w-5 h-5" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border/50">
        <div className="flex items-center gap-3 px-2">
          <Avatar className="w-10 h-10 border border-sidebar-border bg-sidebar-accent">
            <AvatarFallback className="bg-slate-300 font-bold text-foreground">AR</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <p className="text-sm font-bold text-sidebar-foreground">Alex Rivera</p>
            <p className="text-[11px] text-sidebar-foreground/60 font-semibold tracking-wider uppercase">Logistics Lead</p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
