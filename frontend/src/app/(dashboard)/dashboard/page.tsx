"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Anchor, ArrowRight, Leaf, Map, MessageSquare, RefreshCw, Ship } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { roadName } from "@/lib/road-segments";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080";

interface Schedule {
  id: string;
  terminal_name: string;
  destination: string;
  departure_time?: string;
  departure_times?: string[];
}

type CongestionLevel = "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
interface Congestion { segment_id: string; segment_name?: string; congestion_level: CongestionLevel; multiplier: number }
interface DashboardData {
  schedules: Schedule[];
  congestion: Congestion | null;
  schedulesUnavailable: boolean;
  congestionUnavailable: boolean;
}

const congestionStyles: Record<CongestionLevel, { label: string; className: string; percent: number }> = {
  LOW: { label: "Clear", className: "border-[#A7F3D0] bg-[#ECFDF5] text-[#10B981]", percent: 30 },
  MEDIUM: { label: "Moderate", className: "border-[#FDE68A] bg-[#FEF3C7] text-[#F59E0B]", percent: 60 },
  HIGH: { label: "Heavy traffic", className: "border-[#FECACA] bg-[#FEF2F2] text-[#EF4444]", percent: 82 },
  VERY_HIGH: { label: "Severe", className: "border-[#FECACA] bg-[#FEE2E2] text-[#DC2626]", percent: 95 },
};

async function loadDashboard(signal?: AbortSignal): Promise<DashboardData> {
  async function get<T>(path: string): Promise<T> {
    const response = await fetch(API_URL + path, { signal });
    if (!response.ok) throw new Error("Dashboard data unavailable");
    return response.json();
  }
  // Keep the two sources independent so one unavailable endpoint doesn't hide the other.
  const [schedules, congestion] = await Promise.allSettled([
    get<{ schedules: Schedule[] }>("/schedules"),
    get<Congestion>("/congestion?segment_id=SEG001&day_type=weekday&hour=" + new Date().getHours()),
  ]);
  return {
    schedules: schedules.status === "fulfilled" ? schedules.value.schedules || [] : [],
    congestion: congestion.status === "fulfilled" ? congestion.value : null,
    schedulesUnavailable: schedules.status === "rejected",
    congestionUnavailable: congestion.status === "rejected",
  };
}

const cardClass = "gap-0 rounded-xl border border-border bg-card py-0 shadow-sm ring-0";
const quickActions = [
  { title: "Plan a route", description: "Compare time, cost, and emissions", href: "/planner", icon: Map },
  { title: "Ferry schedules", description: "Explore recorded departure times", href: "/schedules", icon: Ship },
  { title: "Ask Oracle", description: "Get help with logistics decisions", href: "/oracle", icon: MessageSquare },
];
const carbonBars = [
  { day: "Mon", height: 30 }, { day: "Tue", height: 40 }, { day: "Wed", height: 35 },
  { day: "Thu", height: 60 }, { day: "Today", height: 90 },
];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({
    schedules: [], congestion: null, schedulesUnavailable: false, congestionUnavailable: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    void loadDashboard(controller.signal).then((result) => {
      if (!controller.signal.aborted) {
        setData(result);
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, []);

  const refresh = async () => {
    setLoading(true);
    setData(await loadDashboard());
    setLoading(false);
  };

  const upcomingDepartures = data.schedules.flatMap((schedule) =>
    (schedule.departure_times ?? (schedule.departure_time ? [schedule.departure_time.slice(0, 5)] : [])).map((time) => ({
      route: schedule.terminal_name + " → " + (schedule.destination === "Singapore" ? "SGP" : schedule.destination),
      time,
    }))
  ).sort((a, b) => a.time.localeCompare(b.time)).slice(0, 3);
  const status = data.congestion ? congestionStyles[data.congestion.congestion_level] : undefined;
  const isHighCongestion = status ? status.percent > 55 : false;
  const corridorName = roadName(data.congestion?.segment_id ?? "SEG001", data.congestion?.segment_name);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Logistics Overview</h1>
          <p className="text-sm text-muted-foreground">Your network performance and sustainability at a glance.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={() => { void refresh(); }} disabled={loading} className="h-9 rounded-lg border px-3 font-medium">
            <RefreshCw className={loading ? "animate-spin" : ""} />Refresh
          </Button>
          <Button asChild className="h-9 rounded-lg px-3 font-medium">
            <Link href="/planner"><Map />Plan a route</Link>
          </Button>
        </div>
      </div>

      <section aria-label="Network summary" aria-busy={loading} className="grid grid-cols-1 gap-4 @3xl/main:grid-cols-3">
        <Card className={cardClass}>
          <CardHeader className="gap-2 p-5">
            <div className="flex items-center justify-between gap-2">
              <CardDescription>Primary corridors</CardDescription><Map className="size-4 text-primary" />
            </div>
            <CardTitle className="text-lg">Traffic conditions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-5 pb-5">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 break-words text-sm font-medium">{corridorName}</span>
              {loading ? <Skeleton className="h-6 w-24 rounded-md" /> : (
                <Badge variant="outline" className={"rounded-md font-medium " + (status?.className || "text-muted-foreground")}>
                  {status?.label || "Unavailable"}
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Sudirman</span>
              <Badge variant="outline" className="rounded-md border-[#A7F3D0] bg-[#ECFDF5] font-medium text-[#10B981]">Clear · demo</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Estimate for {corridorName}; Sudirman is illustrative.</p>
          </CardContent>
        </Card>

        <Card className={cardClass}>
          <CardHeader className="gap-2 p-5">
            <div className="flex items-center justify-between gap-2">
              <CardDescription>Ferry departures</CardDescription><Ship className="size-4 text-primary" />
            </div>
            <CardTitle className="text-lg">Recorded schedules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-5 pb-5">
            {loading ? (
              <><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-4/5" /><Skeleton className="h-5 w-3/4" /></>
            ) : upcomingDepartures.length ? upcomingDepartures.map((departure, index) => (
              <div key={departure.route + departure.time + index} className="flex items-center justify-between gap-3">
                <span className="truncate text-sm" title={departure.route}>{departure.route}</span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{departure.time}</span>
              </div>
            )) : (
              <p className="py-2 text-sm text-muted-foreground">{data.schedulesUnavailable ? "Schedules are unavailable. Try refreshing." : "No recorded departures."}</p>
            )}
          </CardContent>
        </Card>

        <Card className={cardClass}>
          <CardHeader className="gap-2 p-5">
            <div className="flex items-center justify-between gap-2">
              <CardDescription>Total emissions saved</CardDescription><Leaf className="size-4 text-[#10B981]" />
            </div>
            <div className="flex items-baseline gap-2">
              <CardTitle className="text-3xl font-semibold tracking-tight text-[#10B981]">42.8</CardTitle>
              <span className="text-sm text-muted-foreground">tCO₂e</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 px-5 pb-5">
            <Badge variant="outline" className="rounded-md border-[#A7F3D0] bg-[#ECFDF5] font-medium text-[#10B981]">+12% vs. last month</Badge>
            <p className="text-xs text-muted-foreground">Illustrative estimate based on route optimization.</p>
          </CardContent>
        </Card>
      </section>

      <section aria-label="Operational details" className="grid grid-cols-1 gap-4 @3xl/main:grid-cols-2">
        <Card className={cardClass}>
          <CardHeader className="border-b p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-primary"><Anchor className="size-5" /></div>
                <div className="space-y-1">
                  <CardTitle>Batu Ampar Port</CardTitle>
                  <CardDescription>Terminal status estimate</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="rounded-md font-normal text-muted-foreground">Illustrative</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 p-5">
            <div className="space-y-3">
              {loading ? <Skeleton className="h-12 w-28" /> : (
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-semibold tracking-tight tabular-nums">{status ? status.percent + "%" : "—"}</span>
                  {status && <Badge variant="outline" className={"rounded-md " + status.className}>{status.label}</Badge>}
                </div>
              )}
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                {!status ? (loading ? "Loading the corridor congestion estimate…" : "The congestion estimate is currently unavailable.")
                  : isHighCongestion ? "Elevated congestion on the port approach. Allow extra time when planning your route."
                  : "The port approach is operating at normal congestion levels."}
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">Berth availability · demo</span>
                <span className="text-muted-foreground">{status ? (isHighCongestion ? "2 / 12 open" : "8 / 12 open") : "—"}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className={"h-full rounded-full transition-[width] motion-reduce:transition-none " + (isHighCongestion ? "bg-[#EF4444]" : "bg-[#10B981]")} style={{ width: (status?.percent ?? 0) + "%" }} />
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">Based on the {corridorName} estimate. Berth availability is demo data.</p>
            </div>
          </CardContent>
        </Card>

        <Card className={cardClass}>
          <CardHeader className="border-b p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#ECFDF5] text-[#10B981]"><Leaf className="size-5" /></div>
                <div className="space-y-1">
                  <CardTitle>Carbon savings</CardTitle>
                  <CardDescription>Daily route optimization</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="rounded-md font-normal text-muted-foreground">Estimate</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-5">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold tracking-tight text-[#10B981]">1.4</span>
                <span className="text-sm text-muted-foreground">tCO₂e today</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Illustrative savings from bypassing Yos Sudarso congestion.</p>
            </div>
            <div role="img" aria-label="Illustrative carbon savings trend from Monday to today, with today estimated at 1.4 tonnes CO2 equivalent." className="flex h-32 items-end gap-4">
              {carbonBars.map((bar) => (
                <div key={bar.day} className="flex h-full min-w-0 flex-1 flex-col items-center gap-2">
                  <div className="flex w-full flex-1 items-end">
                    <div className={"w-full rounded-t-md " + (bar.day === "Today" ? "bg-[#10B981]" : "bg-muted")} style={{ height: bar.height + "%" }} />
                  </div>
                  <span className={"text-xs " + (bar.day === "Today" ? "font-medium text-[#10B981]" : "text-muted-foreground")}>{bar.day}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="quick-actions-title" className="space-y-3">
        <div className="space-y-1">
          <h2 id="quick-actions-title" className="text-base font-semibold">Quick actions</h2>
          <p className="text-sm text-muted-foreground">Continue with your next logistics task.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 @3xl/main:grid-cols-3">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href} className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <Card className={cardClass + " h-full transition-colors group-hover:border-primary/40 group-hover:bg-primary/5"}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-primary"><action.icon className="size-4" /></div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-medium">{action.title}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{action.description}</p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
