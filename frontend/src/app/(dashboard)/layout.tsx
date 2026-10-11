import type { CSSProperties } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <TooltipProvider>
      <SidebarProvider
        className="[--dashboard-inset:0rem] [--dashboard-padding:1rem] md:[--dashboard-inset:1rem] lg:[--dashboard-padding:1.5rem]"
        style={{ "--sidebar-width": "16rem", "--header-height": "3.5rem" } as CSSProperties}
      >
        <AppSidebar />
        <SidebarInset className="min-w-0 bg-background md:ring-1 md:ring-border md:shadow-none">
          <Topbar />
          <div id="dashboard-content" className="@container/main mx-auto flex w-full max-w-[1600px] flex-1 flex-col p-(--dashboard-padding)">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
