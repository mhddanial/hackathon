"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

const routeLabels: Record<string, string> = {
  dashboard: "Dashboard", planner: "Route Planner",
  schedules: "Ferry Schedules", oracle: "Logistics Oracle",
  departure: "Departure Recommendation",
};

export default function Topbar() {
  const segments = usePathname().split("/").filter(Boolean);

  return (
    <header className="sticky top-0 z-30 flex h-(--header-height) shrink-0 items-center gap-3 border-b bg-card px-4 md:rounded-t-xl lg:px-6">
      <SidebarTrigger className="-ml-2 size-9 rounded-lg" />
      <Separator orientation="vertical" className="h-4!" />
      <Breadcrumb className="min-w-0">
        <BreadcrumbList className="flex-nowrap">
          {segments[0] !== "dashboard" && (
            <>
              <BreadcrumbItem className="hidden sm:inline-flex">
                <BreadcrumbLink render={<Link href="/dashboard" />}>Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:block" />
            </>
          )}
          {segments.map((segment, index) => {
            const href = "/" + segments.slice(0, index + 1).join("/");
            const label = routeLabels[segment] ?? segment.replace(/-/g, " ");
            const isLast = index === segments.length - 1;
            return (
              <Fragment key={href}>
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem className="min-w-0">
                  {isLast ? (
                    <BreadcrumbPage className="truncate font-medium">{label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink render={<Link href={href} />}>{label}</BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}
