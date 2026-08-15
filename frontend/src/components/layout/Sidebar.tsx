"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Map, Ship, Compass, MessageSquare, X, LogOut, Layers, Settings, CheckSquare } from "lucide-react";
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
import { useAuth } from "@/components/providers/AuthProvider";
import { createClient } from "@/utils/supabase/client";

// Used original icons and links for the sidebar items
const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Route Planner", url: "/planner", icon: Map },
  { title: "Ferry Schedules", url: "/schedules", icon: Ship },
  { title: "Logistics Oracle", url: "/oracle", icon: MessageSquare },
];

export function AppSidebar() {
  const supabase = createClient();
  const pathname = usePathname();
  const router = useRouter();
  const { setOpenMobile, isMobile } = useSidebar();
  const { user } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Get initials from user's full name or email
  const getInitials = () => {
    if (user?.user_metadata?.full_name) {
      const names = user.user_metadata.full_name.split(" ");
      return names.length > 1 
        ? `${names[0][0]}${names[1][0]}`.toUpperCase() 
        : names[0].substring(0, 2).toUpperCase();
    }
    return user?.email ? user.email.substring(0, 2).toUpperCase() : "US";
  };

  const displayName = user?.user_metadata?.full_name || user?.email || "User";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-[#EFF6FF] group">
      <SidebarHeader className="h-20 flex flex-row items-center px-6 border-b border-sidebar-border/50 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center">
        <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
          <img src="/logo-icon.png" alt="Logo" className="h-10 w-10 object-contain" />
          <span className="text-xl font-bold text-[#155EEF] group-data-[collapsible=icon]:hidden">
            SmartFlow
          </span>
        </Link>
        {isMobile && (
          <Button variant="ghost" size="icon" className="md:hidden ml-auto text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => setOpenMobile(false)}>
            <X className="w-5 h-5" />
          </Button>
        )}
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="pt-4">
            <SidebarMenu className="gap-4 px-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
              {items.map((item) => {
                const isActive = pathname === item.url;
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      render={<Link href={item.url} />}
                      isActive={isActive}
                      tooltip={item.title}
                      className="h-11 px-4 font-semibold transition-colors text-slate-500 hover:text-slate-900 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-lg"
                      onClick={() => {
                        if (isMobile) setOpenMobile(false);
                      }}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

    </Sidebar>
  );
}
