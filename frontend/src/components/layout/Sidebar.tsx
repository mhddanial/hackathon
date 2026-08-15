"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Map, Ship, Compass, MessageSquare, X, LogOut } from "lucide-react";
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
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 px-2">
            <Avatar className="w-10 h-10 border border-sidebar-border bg-sidebar-accent">
              <AvatarFallback className="bg-slate-300 font-bold text-foreground">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col overflow-hidden">
              <p className="text-sm font-bold text-sidebar-foreground truncate" title={displayName}>
                {displayName}
              </p>
              <p className="text-[11px] text-sidebar-foreground/60 font-semibold tracking-wider uppercase truncate">
                Logistics User
              </p>
            </div>
          </div>
          
          <Button 
            variant="ghost" 
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
