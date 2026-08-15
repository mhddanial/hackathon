import { Search, Bell, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";

export default function Topbar() {
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

      <div className="flex items-center gap-2 md:gap-4">
        <Button variant="ghost" size="icon" className="rounded-full text-foreground hover:text-primary">
          <Search className="w-5 h-5 md:hidden" />
        </Button>
        <Button variant="ghost" size="icon" className="rounded-full text-foreground hover:text-primary">
          <Bell className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" className="rounded-full text-foreground hover:text-primary">
          <Settings className="w-5 h-5" />
        </Button>
        <Button className="hidden md:flex items-center justify-center rounded-full h-10 px-6 bg-foreground text-background font-bold text-sm hover:bg-foreground/90 transition-colors shadow-none ml-2">
          NEW PLAN
        </Button>
      </div>
    </header>
  );
}
