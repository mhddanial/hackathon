"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, LogOut, Loader2 } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { createClient } from "@/utils/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";

export function NavUser() {
  const { user, loading } = useAuth();
  const { isMobile } = useSidebar();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const displayName = user?.user_metadata?.full_name?.trim() || user?.email || "Your account";
  const initials = displayName.split(/\s+/).map((part: string) => part[0]).join("").slice(0, 2).toUpperCase();

  const handleLogout = async () => {
    setSigningOut(true);
    setError("");
    try {
      const { error: signOutError } = await createClient().auth.signOut();
      if (signOutError) throw signOutError;
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Could not sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<SidebarMenuButton size="lg" tooltip="Your account" />}
              disabled={loading || signingOut}
              aria-label="Open account menu"
              className="rounded-lg hover:bg-sidebar-accent data-open:bg-sidebar-accent"
            >
              <Avatar className="size-8 shrink-0 rounded-lg">
                <AvatarImage src={user?.user_metadata?.avatar_url} alt={displayName} />
                <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-semibold text-primary">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 gap-0.5 text-left group-data-[collapsible=icon]:hidden">
                {loading ? <Skeleton className="h-4 w-24" /> : <span className="truncate text-sm font-medium">{displayName}</span>}
                <span className="truncate text-xs text-muted-foreground">{user?.email || "SmartFlow workspace"}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side={isMobile ? "top" : "right"} align="end" sideOffset={8} className="min-w-60 rounded-xl">
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  <div className="grid gap-1 py-1">
                    <span className="truncate font-medium">{displayName}</span>
                    <span className="truncate text-xs font-normal text-muted-foreground">{user?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={signingOut} onClick={() => { void handleLogout(); }}>
                  {signingOut ? <Loader2 className="animate-spin" /> : <LogOut />}
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
      {error && <p role="alert" className="px-2 text-xs text-destructive">{error}</p>}
    </>
  );
}
