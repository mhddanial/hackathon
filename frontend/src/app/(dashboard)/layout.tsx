import { AppSidebar } from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-surface-soft w-full">
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="bg-surface-soft flex-1 flex flex-col">
            <Topbar />
            <main className="flex-1 overflow-auto pt-20 p-8 max-w-[1600px] w-full mx-auto">
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </div>
  );
}
