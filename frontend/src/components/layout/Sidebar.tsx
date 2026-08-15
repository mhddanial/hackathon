"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Map, Ship, Bot } from "lucide-react";
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
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const items = [
  { title: "Dashboard", url: "#dashboard", icon: LayoutDashboard },
  { title: "Route Planner", url: "/", icon: Map },
  { title: "Ferry Schedules", url: "#schedules", icon: Ship },
  { title: "Smart Agent", url: "#agent", icon: Bot },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="h-20 flex items-center justify-center px-6 border-b border-sidebar-border/50">
        <h1 className="text-sidebar-primary font-bold text-xl tracking-tight w-full text-center md:text-left">
          SmartFlow
        </h1>
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
                      asChild 
                      isActive={isActive}
                      className="h-11 px-4 font-semibold transition-colors"
                    >
                      <Link href={item.url} className="flex items-center gap-3 text-sm">
                        <item.icon className="w-5 h-5" />
                        <span>{item.title}</span>
                      </Link>
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
