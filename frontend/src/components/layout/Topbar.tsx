"use client";

import { Search, LogOut, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/components/providers/AuthProvider";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Topbar() {
  const { user } = useAuth();
  const supabase = createClient();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const getInitials = () => {
    if (user?.user_metadata?.full_name) {
      const names = user.user_metadata.full_name.split(" ");
      return names.length > 1 
        ? `${names[0][0]}${names[1][0]}`.toUpperCase() 
        : names[0].substring(0, 2).toUpperCase();
    }
    return user?.email ? user.email.substring(0, 2).toUpperCase() : "US";
  };

  const displayName = user?.user_metadata?.full_name || user?.email || "Joko Siyanto";

  return (
    <header className="h-20 bg-background/80 backdrop-blur-md border-b border-sidebar-border flex items-center justify-between px-8 sticky top-0 z-50">
      <div className="flex items-center gap-2 md:gap-4">
        <SidebarTrigger className="text-sidebar-foreground" />
        <div className="hidden md:block w-[480px]">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input 
              type="text" 
              placeholder="Search shipments or agents..." 
              className="w-full h-11 bg-accent/50 rounded-full pl-12 pr-4 text-sm border-transparent focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary shadow-none"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full text-foreground hover:text-primary md:hidden">
          <Search className="w-5 h-5" />
        </Button>
        
        {/* User Profile & Sign Out */}
        <div className="flex items-center gap-3">
          <span className="text-[#1A1D27] text-sm font-medium hidden md:block">
            {displayName} - Driver
          </span>
          <Avatar className="w-10 h-10 border border-sidebar-border bg-sidebar-accent">
            {user?.user_metadata?.avatar_url ? (
               <AvatarImage src={user.user_metadata.avatar_url} />
            ) : (
               <AvatarFallback className="bg-slate-300 font-bold text-foreground">{getInitials()}</AvatarFallback>
            )}
          </Avatar>
          
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-[#5E6470] hover:text-[#1A1D27] hover:bg-slate-100 ml-2" title="Sign Out">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
