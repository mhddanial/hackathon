"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  Loader2,
  MapPin,
  RefreshCw,
  Route,
  Ship,
  Square,
  Timer,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RouteEstimateDetails } from "@/components/oracle/RouteEstimateDetails";
import { batamLocations } from "@/lib/locations";
import { selectRouteOption } from "@/lib/route-contract";
import { useRoutePlanner } from "@/hooks/use-route-planner";
import type { RouteData } from "@/types/route";
import { RecordedSailingPicker } from "./RecordedSailingPicker";

const customCoordinatesOption = "__custom_coordinates__";

function FormLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return <label htmlFor={htmlFor} className="text-sm font-medium leading-none">{children}</label>;
}
function FormHint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}
function FormField({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}

function LocationSelect({ id, label, value, onChange }: { id: "origin" | "destination"; label: string; value: string; onChange: (value: string) => void }) {
  const [customCoordinatesSelected, setCustomCoordinatesSelected] = useState(value.includes(","));
  const isSupportedLocation = batamLocations.some((location) => [location.id, location.name, ...location.aliases].includes(value));
  const customCoordinates = !isSupportedLocation && (customCoordinatesSelected || Boolean(value));
  return (
    <FormField>
      <FormLabel htmlFor={id}>{label}</FormLabel>
      <Select value={customCoordinates ? customCoordinatesOption : value} onValueChange={(val) => { if (!val) return; if (val === customCoordinatesOption) { setCustomCoordinatesSelected(true); onChange(""); return; } setCustomCoordinatesSelected(false); onChange(val); }}>
        <SelectTrigger id={id} className="w-full" aria-describedby={`${id}-location-hint`}>
          <SelectValue placeholder={`Select ${label.toLowerCase()}`}>
            {(val: string | null) => {
              if (!val) return null;
              if (val === customCoordinatesOption) return "Custom coordinates";
              return val;
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {batamLocations.map((location) => (<SelectItem key={location.id} value={location.name}>{location.name}</SelectItem>))}
          <SelectItem value={customCoordinatesOption}>Custom coordinates</SelectItem>
        </SelectContent>
      </Select>
      {customCoordinates && (<Input id={`${id}-coordinates`} value={value} onChange={(event) => onChange(event.target.value)} placeholder="Latitude, longitude" inputMode="decimal" autoComplete="off" maxLength={80} required aria-label={`${label} coordinates`} />)}
      <FormHint>{customCoordinates ? "Enter latitude, longitude within the supported Batam planning area." : "Choose a supported Batam location or select Custom coordinates."}</FormHint>
    </FormField>
  );
}

function PlannerEmptyState() {
  return (
    <div className="flex min-h-[28rem] flex-col items-center justify-center gap-5 rounded-2xl border border-dashed p-10 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
        <Route aria-hidden="true" className="size-8 text-primary" />
      </div>
      <div className="space-y-2">
        <p className="text-base font-semibold">Ready to plan your route</p>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">Fill in origin, destination, and departure time, then hit <span className="font-medium text-foreground">Calculate estimate</span> to see travel time, congestion, and cutoff insights.</p>
      </div>
      <div className="hidden items-center gap-2 text-xs text-muted-foreground lg:flex">
        <ArrowRight aria-hidden="true" className="size-4 rotate-180" />
        Start with the form on the left
      </div>
    </div>
  );
}

function PlannerLoadingSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
      <Skeleton className="h-9 w-56 rounded-lg" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

function RouteOptionCard({ option, selected, fastestTimeMin, onSelect, metric }: { option: { route_id: string; display_label: string; distance_km: number; base_time_min: number; final_time_min: number; congestion_level?: string; congestion_multiplier?: number; congestion_status: string; emission_kg: number }; selected: boolean; fastestTimeMin: number; onSelect: () => void; metric: (v: number) => string }) {
  const diffMin = option.final_time_min - fastestTimeMin;
  const isSlower = diffMin > 0.5;
  return (
    <label className={`group block cursor-pointer rounded-xl border p-4 transition-all duration-150 ${selected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/40 hover:bg-muted/30"}`}>
      <input type="radio" name="planner-route-option" value={option.route_id} checked={selected} onChange={onSelect} className="peer sr-only" aria-label={`Select ${option.display_label}`} />
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="text-sm font-semibold">{option.display_label}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          {isSlower && (<Badge variant="outline" className="border-amber-400 text-[10px] text-amber-700">+{metric(diffMin)} min</Badge>)}
          {selected && (<CheckCircle2 className="size-4 shrink-0 text-primary" aria-label="Selected" />)}
        </div>
      </div>
      <p className="mb-3 text-2xl font-bold tabular-nums">{metric(option.final_time_min)} <span className="text-sm font-normal text-muted-foreground">min</span></p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        <div><dt className="text-muted-foreground">Distance</dt><dd className="font-medium">{metric(option.distance_km)} km</dd></div>
        <div><dt className="text-muted-foreground">Base time</dt><dd className="font-medium">{metric(option.base_time_min)} min</dd></div>
        <div><dt className="text-muted-foreground">Congestion</dt><dd className="font-medium">{option.congestion_level ? `${option.congestion_level}${option.congestion_multiplier ? ` · ${metric(option.congestion_multiplier)}x` : ""}` : option.congestion_status.replaceAll("_", " ")}</dd></div>
        <div><dt className="text-muted-foreground">Est. CO2</dt><dd className="font-medium">{metric(option.emission_kg)} kg</dd></div>
      </dl>
    </label>
  );
}

function ResultHeader({
  origin,
  destination,
  dayType,
  time,
  congestionLevel,
  congestionMultiplier,
  onRecalculate,
  loading,
}: {
  origin: string;
  destination: string;
  dayType: string;
  time: string;
  congestionLevel?: string;
  congestionMultiplier?: number;
  onRecalculate: () => void;
  loading: boolean;
}) {
  const levelBadge = () => {
    const lvl = congestionLevel?.toUpperCase();
    if (lvl === "LOW") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/30 bg-emerald-600/10 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
          <span className="size-1.5 rounded-full bg-emerald-600 animate-pulse" />
          Low Congestion {congestionMultiplier ? `· ${congestionMultiplier}×` : "· Free flow"}
        </span>
      );
    }
    if (lvl === "HIGH") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-600/30 bg-rose-600/10 px-2 py-0.5 text-xs font-semibold text-rose-800 dark:text-rose-300">
          <span className="size-1.5 rounded-full bg-rose-600 animate-pulse" />
          High Congestion {congestionMultiplier ? `· ${congestionMultiplier}×` : "· Peak rush"}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-600/30 bg-amber-600/10 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
        <span className="size-1.5 rounded-full bg-amber-600 animate-pulse" />
        {lvl || "Medium"} Congestion {congestionMultiplier ? `· ${congestionMultiplier}×` : "· Normal daytime"}
      </span>
    );
  };

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-700/20 bg-emerald-700/5 px-4 py-3">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
            <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-emerald-700" />
            Estimate ready
          </p>
          {levelBadge()}
        </div>
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{origin}</span>
          <ArrowRight className="size-3 shrink-0" aria-hidden="true" />
          <span className="font-medium text-foreground">{destination}</span>
          <span>·</span>
          <span className="capitalize">{dayType}</span>
          <span>·</span>
          <span>{time} WIB departure</span>
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRecalculate}
        disabled={loading}
        className="shrink-0 border-emerald-700/20 bg-white/70 text-emerald-900 hover:bg-white dark:bg-card dark:text-foreground"
      >
        <RefreshCw className="size-3.5" />
        Recalculate
      </Button>
    </div>
  );
}

function CongestionScenariosCard({
  result,
  metric,
}: {
  result: NonNullable<RouteData>;
  metric: (v: number) => string;
}) {
  const currentLevel = (result.congestion_level || "MEDIUM").toUpperCase();
  const currentMultiplier =
    result.congestion_multiplier && result.congestion_multiplier > 0
      ? result.congestion_multiplier
      : 1.25;
  const currentFinal = result.final_time_min;

  const baseTimeMin =
    result.base_time_min && result.base_time_min > 0
      ? result.base_time_min
      : currentMultiplier > 0
      ? currentFinal / currentMultiplier
      : currentFinal;

  const scenarios = [
    {
      level: "LOW" as const,
      label: "Low congestion",
      sublabel: "Off-peak free-flow (night / early morning)",
      multiplier:
        currentLevel === "LOW" && currentMultiplier > 0
          ? currentMultiplier
          : 1.05,
      borderClass: "border-emerald-500/30 hover:border-emerald-500/50",
      bgClass: "bg-emerald-500/5",
      badgeClass:
        "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30",
      activeRingClass: "ring-2 ring-emerald-600/50 border-emerald-600",
      indicatorColor: "bg-emerald-600",
    },
    {
      level: "MEDIUM" as const,
      label: "Medium congestion",
      sublabel: "Typical daytime traffic (09:00 - 16:00)",
      multiplier:
        currentLevel === "MEDIUM" && currentMultiplier > 0
          ? currentMultiplier
          : 1.25,
      borderClass: "border-amber-500/30 hover:border-amber-500/50",
      bgClass: "bg-amber-500/5",
      badgeClass:
        "bg-amber-500/15 text-amber-900 dark:text-amber-300 border-amber-500/30",
      activeRingClass: "ring-2 ring-amber-600/50 border-amber-600",
      indicatorColor: "bg-amber-600",
    },
    {
      level: "HIGH" as const,
      label: "High congestion",
      sublabel: "Peak rush hour (07:00-09:00, 16:00-19:00)",
      multiplier:
        currentLevel === "HIGH" && currentMultiplier > 0
          ? currentMultiplier
          : 1.65,
      borderClass: "border-rose-500/30 hover:border-rose-500/50",
      bgClass: "bg-rose-500/5",
      badgeClass:
        "bg-rose-500/15 text-rose-900 dark:text-rose-300 border-rose-500/30",
      activeRingClass: "ring-2 ring-rose-600/50 border-rose-600",
      indicatorColor: "bg-rose-600",
    },
  ];

  const calculatedScenarios = scenarios.map((s) => {
    const isCurrent = currentLevel === s.level;
    const finalTime = isCurrent
      ? Math.round(currentFinal)
      : Math.round(baseTimeMin * s.multiplier);
    const diff = finalTime - Math.round(currentFinal);

    let arrivalTime: string | undefined;
    if (
      result.estimated_arrival_time &&
      result.estimated_arrival_time.includes(":")
    ) {
      const [hStr, mStr] = result.estimated_arrival_time.split(":");
      const origH = parseInt(hStr, 10);
      const origM = parseInt(mStr, 10);
      if (!isNaN(origH) && !isNaN(origM)) {
        const totalM = origH * 60 + origM + diff;
        const normM = ((totalM % 1440) + 1440) % 1440;
        const arrH = Math.floor(normM / 60);
        const arrM = normM % 60;
        arrivalTime = `${String(arrH).padStart(2, "0")}:${String(arrM).padStart(
          2,
          "0"
        )}`;
      }
    }

    let slackMin: number | undefined;
    if (result.cutoff_slack_min !== undefined) {
      slackMin = Math.round(result.cutoff_slack_min - diff);
    }

    return {
      ...s,
      isCurrent,
      finalTime,
      diff,
      arrivalTime,
      slackMin,
    };
  });

  const lowTime = calculatedScenarios[0].finalTime;
  const highTime = calculatedScenarios[2].finalTime;
  const timeSpread = Math.max(0, highTime - lowTime);

  return (
    <Card className="border p-4 shadow-none ring-0 gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <TrendingUp className="size-3.5 text-primary" aria-hidden="true" />
            Congestion scenario forecast
          </p>
          <p className="text-xs text-muted-foreground">
            Expected duration &amp; arrival timing across low, medium, and high traffic scenarios.
          </p>
        </div>
        <Badge variant="outline" className="text-[11px] font-normal">
          Corridor: {result.matched_segment_name || "Batam arterial road"}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {calculatedScenarios.map((s) => (
          <div
            key={s.level}
            className={`relative flex flex-col justify-between rounded-xl border p-3 transition-all ${
              s.borderClass
            } ${s.bgClass} ${s.isCurrent ? s.activeRingClass : "shadow-none"}`}
          >
            <div>
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span
                  className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${s.badgeClass}`}
                >
                  <span className={`size-1.5 rounded-full ${s.indicatorColor}`} />
                  {s.level} · {metric(s.multiplier)}×
                </span>
                {s.isCurrent && (
                  <Badge variant="default" className="text-[10px] h-4 px-1.5 font-medium">
                    Calculated
                  </Badge>
                )}
              </div>
              <p className="text-xs font-medium text-foreground">{s.label}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{s.sublabel}</p>
            </div>

            <div className="my-2.5">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight tabular-nums">
                  {s.finalTime}
                </span>
                <span className="text-xs text-muted-foreground">min</span>
                {s.isCurrent ? (
                  <span className="ml-auto text-[11px] font-medium text-primary">
                    Calculated
                  </span>
                ) : s.diff < 0 ? (
                  <span className="ml-auto text-[11px] font-medium text-emerald-600">
                    -{Math.abs(s.diff)} min
                  </span>
                ) : (
                  <span className="ml-auto text-[11px] font-medium text-rose-600">
                    +{s.diff} min
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-1 border-t pt-2 text-[11px]">
              {s.arrivalTime && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Est. arrival:</span>
                  <span className="font-semibold tabular-nums">{s.arrivalTime} WIB</span>
                </div>
              )}
              {s.slackMin !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cutoff slack:</span>
                  {s.slackMin >= 0 ? (
                    <span className="font-semibold text-emerald-600 tabular-nums">
                      +{s.slackMin} min
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 font-semibold text-rose-600 tabular-nums">
                      <AlertTriangle className="size-3" />
                      {Math.abs(s.slackMin)} min late
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <Clock className="size-3.5 shrink-0" aria-hidden="true" />
          <span>
            Traffic sensitivity spread: <strong className="text-foreground">{timeSpread} min</strong> difference between free-flow and peak rush hour.
          </span>
        </p>
      </div>
    </Card>
  );
}

function PlannerWorkspace({ account }: { account: string }) {
  const { form, result, loading, error, notice, update, calculate, cancel } = useRoutePlanner(account);
  const [routeSelection, setRouteSelection] = useState<{ result: NonNullable<typeof result>; routeId: string }>();
  const routeOptions = result?.route_options || [];
  const selectedRouteId = routeSelection?.result === result ? routeSelection.routeId : undefined;
  const selectedRoute = routeOptions.find((o) => o.route_id === selectedRouteId) || routeOptions.find((o) => o.route_id === result?.default_route_id);
  const selectedResult = result ? selectRouteOption(result, selectedRoute?.route_id) : null;
  const resultRef = useRef<HTMLElement | null>(null);
  const metric = (value: number) => new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);
  const fastestTimeMin = routeOptions.length ? Math.min(...routeOptions.map((o) => o.final_time_min)) : 0;

  useEffect(() => {
    if (result && window.matchMedia("(max-width: 1023px)").matches) {
      resultRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    }
  }, [result]);

  const activeResult = selectedResult || result;

  return (
    <div className="min-w-0 space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Route Planner</h1>
        <p className="mt-1 text-sm text-muted-foreground">Estimate a Batam route and check a vessel cutoff with the same planning tools used by Oracle.</p>
      </header>
      {notice && (<Alert role="status"><AlertTitle>Review your planning inputs</AlertTitle><AlertDescription>{notice}</AlertDescription></Alert>)}
      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.2fr)]">

        {/* ══ Left: Form (sticky) ══ */}
        <div className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pb-4">

          {/* Step 1 — Route & departure */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                <div><CardTitle>Route &amp; departure</CardTitle><CardDescription className="mt-0.5">All times use Asia/Jakarta (WIB).</CardDescription></div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid min-w-0 gap-4 md:grid-cols-2">
                <LocationSelect id="origin" label="Origin" value={form.origin} onChange={(value) => update("origin", value)} />
                <LocationSelect id="destination" label="Destination" value={form.destination} onChange={(value) => update("destination", value)} />
                <FormField>
                  <FormLabel htmlFor="departure-date">Departure date <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                  <Input id="departure-date" type="date" value={form.departureDate} onChange={(e) => update("departureDate", e.target.value)} />
                  <FormHint>Choosing a date sets its day type. Required for overnight planning.</FormHint>
                </FormField>
                <FormField>
                  <FormLabel htmlFor="departure-time">Road departure time · WIB</FormLabel>
                  <Input id="departure-time" type="time" required value={form.time} onChange={(e) => update("time", e.target.value)} />
                </FormField>
                <FormField>
                  <FormLabel htmlFor="day-type">Day type</FormLabel>
                  <Select value={form.dayType} onValueChange={(val) => { if (!val) return; update("dayType", val as "weekday" | "weekend"); }}>
                    <SelectTrigger id="day-type" className="w-full">
                      <SelectValue>
                        {(val: string | null) => (val === "weekend" ? "Weekend" : "Weekday")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekday">Weekday</SelectItem>
                      <SelectItem value="weekend">Weekend</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            </CardContent>
          </Card>

          {/* Step 2 — Vessel cutoff (collapsible) */}
          <Card>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-t-[32px] px-6 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold text-muted-foreground group-open:border-primary group-open:bg-primary group-open:text-primary-foreground">2</span>
                <div className="flex-1">
                  <p className="text-sm font-medium leading-none">Vessel cutoff check <Badge variant="outline" className="ml-1.5 align-middle">optional</Badge></p>
                  <p className="mt-1 text-xs text-muted-foreground">Check if you can make a vessel departure.</p>
                </div>
                <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-6 pb-6 pt-2 space-y-4">
                <FormHint>Provide cargo category and ETD, or leave both empty for travel time only. Times without offsets use Asia/Jakarta (UTC+07:00).</FormHint>
                <RecordedSailingPicker onChoose={(etd) => update("vesselEtd", etd)} />
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField>
                    <FormLabel htmlFor="cargo-type">Cargo planning category</FormLabel>
                    <Select value={form.cargoType || "NO_CUTOFF"} onValueChange={(val) => { if (!val) return; update("cargoType", (val === "NO_CUTOFF" ? "" : val) as "" | "CONTAINER" | "FAST_FREIGHT"); }}>
                      <SelectTrigger id="cargo-type" className="w-full">
                        <SelectValue>
                          {(val: string | null) => {
                            if (val === "FAST_FREIGHT") return "Fast freight · 1 hour cutoff";
                            if (val === "CONTAINER") return "Container · 2 hour cutoff";
                            return "No cutoff check";
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NO_CUTOFF">No cutoff check</SelectItem>
                        <SelectItem value="FAST_FREIGHT">Fast freight · 1 hour cutoff</SelectItem>
                        <SelectItem value="CONTAINER">Container · 2 hour cutoff</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField>
                    <FormLabel htmlFor="vessel-etd">Vessel ETD</FormLabel>
                    <Input id="vessel-etd" value={form.vesselEtd} maxLength={80} placeholder="18:00 or 2024-01-01T12:00:00Z" onChange={(e) => update("vesselEtd", e.target.value)} />
                    <FormHint>ISO timestamps retain their date and UTC offset.</FormHint>
                  </FormField>
                </div>
                <FormHint>Cargo category is a planning assumption; vessel compatibility and capacity are unverified.</FormHint>
              </div>
            </details>
          </Card>

          {error && (<Alert variant="destructive" role="alert"><AlertTitle>Review the route request</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>)}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" disabled={loading} onClick={() => void calculate()}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Route className="size-4" />}
              {loading ? "Calculating route..." : "Calculate estimate"}
            </Button>
            {loading && (<Button type="button" variant="outline" onClick={cancel}><Square className="size-3" />Stop</Button>)}
            <FormHint>Review the selected inputs before calculating.</FormHint>
          </div>
        </div>

        {/* ══ Right: Results ══ */}
        <section ref={resultRef} aria-label="Route estimate" aria-live="polite" aria-busy={loading} className="@container/route min-w-0 scroll-mt-4">
          {loading && !result && <PlannerLoadingSkeleton />}

          {result && (
            <>
              <ResultHeader
                origin={activeResult?.origin_name || result.origin_name || form.origin}
                destination={activeResult?.destination_name || result.destination_name || form.destination}
                dayType={form.dayType}
                time={form.time}
                congestionLevel={activeResult?.congestion_level}
                congestionMultiplier={activeResult?.congestion_multiplier}
                onRecalculate={() => void calculate()}
                loading={loading}
              />

              {routeOptions.length > 0 && (
                <div className="mb-5">
                  <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                    {result.routing_source === "Synthetic UI fixture" ? "Synthetic route options from local UI fixture. Estimates are not verified live traffic." : "Distinct routes from the routing service. Estimates are not verified live traffic."}
                    {routeOptions.length > 1 && " Select a route to update the details below."}
                  </p>
                  <fieldset className="min-w-0">
                    <legend className="sr-only">Available routes</legend>
                    <div className="grid min-w-0 gap-3 md:grid-cols-2">
                      {routeOptions.map((option) => (
                        <RouteOptionCard
                          key={option.route_id}
                          option={option}
                          selected={option.route_id === selectedRoute?.route_id}
                          fastestTimeMin={fastestTimeMin}
                          onSelect={() => { if (result) setRouteSelection({ result, routeId: option.route_id }); }}
                          metric={metric}
                        />
                      ))}
                    </div>
                  </fieldset>
                </div>
              )}

              <Tabs defaultValue="overview" className="min-w-0">
                <TabsList className="mb-4">
                  <TabsTrigger value="overview"><Timer className="size-3.5" />Overview</TabsTrigger>
                  <TabsTrigger value="details"><Ship className="size-3.5" />Full details &amp; map</TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <Card className="border bg-primary/5 p-4 shadow-none ring-0 gap-1">
                        <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                          <Timer className="size-3.5" aria-hidden="true" />Travel time
                        </p>
                        <p className="text-3xl font-semibold tracking-tight tabular-nums text-primary">
                          {metric(activeResult?.final_time_min ?? result.final_time_min)}{" "}
                          <span className="text-sm font-normal">min</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activeResult?.congestion_level
                            ? `${activeResult.congestion_level} congestion (${activeResult.congestion_multiplier ? `${metric(activeResult.congestion_multiplier)}×` : "adjusted"})`
                            : "Adjusted for congestion."}
                        </p>
                      </Card>

                      <Card className="border bg-card p-4 shadow-none ring-0 gap-1">
                        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <MapPin className="size-3.5" aria-hidden="true" />Distance
                        </p>
                        <p className="text-3xl font-semibold tracking-tight tabular-nums">
                          {metric(activeResult?.distance_km ?? result.distance_km)}{" "}
                          <span className="text-sm font-normal text-muted-foreground">km</span>
                        </p>
                        <p className="text-xs text-muted-foreground">From routing source.</p>
                      </Card>

                      {activeResult?.cutoff_slack_min !== undefined ? (
                        <Card className={`border p-4 shadow-none ring-0 gap-1 ${activeResult.cutoff_slack_min >= 0 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20"}`}>
                          <p className={`flex items-center gap-1.5 text-xs font-medium ${activeResult.cutoff_slack_min >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
                            <Ship className="size-3.5" aria-hidden="true" />Cutoff slack
                          </p>
                          <p className={`text-3xl font-semibold tracking-tight tabular-nums ${activeResult.cutoff_slack_min >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
                            {metric(Math.abs(activeResult.cutoff_slack_min))}{" "}
                            <span className="text-sm font-normal">min</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {activeResult.cutoff_slack_min >= 0 ? "Remaining before vessel gate-in." : "Late for scheduled gate-in."}
                          </p>
                        </Card>
                      ) : (
                        <Card className="border bg-card p-4 shadow-none ring-0 gap-1">
                          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <Clock className="size-3.5" aria-hidden="true" />Free-flow base
                          </p>
                          <p className="text-3xl font-semibold tracking-tight tabular-nums">
                            {metric(activeResult?.base_time_min ?? (activeResult?.final_time_min ? activeResult.final_time_min / (activeResult.congestion_multiplier || 1.0) : 0))}{" "}
                            <span className="text-sm font-normal text-muted-foreground">min</span>
                          </p>
                          <p className="text-xs text-muted-foreground">Without traffic delays.</p>
                        </Card>
                      )}
                    </div>

                    {/* Congestion Scenarios Breakdown */}
                    {activeResult && (
                      <CongestionScenariosCard result={activeResult} metric={metric} />
                    )}

                    {/* Departure plan */}
                    {activeResult?.departure_time && (
                      <Card className="border p-4 shadow-none ring-0 gap-2">
                        <p className="flex items-center gap-1.5 text-xs font-semibold">
                          <Ship className="size-3.5 text-primary" aria-hidden="true" />Departure plan
                        </p>
                        <Separator />
                        <dl className="space-y-2 pt-1">
                          {([
                            ["Planned departure", activeResult.departure_time],
                            ["Estimated arrival", activeResult.estimated_arrival_time],
                            ["Cutoff slack", activeResult.cutoff_slack_min !== undefined ? `${metric(activeResult.cutoff_slack_min)} min${activeResult.cutoff_slack_min < 0 ? " late" : " remaining"}` : undefined],
                            ["Vessel ETD", activeResult.vessel_etd],
                          ] as [string, string | undefined][]).filter(([, v]) => v !== undefined).map(([label, value]) => (
                            <div key={label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b pb-2 text-xs last:border-0 last:pb-0">
                              <dt className="text-muted-foreground">{label}</dt>
                              <dd className="font-semibold tabular-nums">{value}</dd>
                            </div>
                          ))}
                        </dl>
                      </Card>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="details">
                  <Card className="shadow-none">
                    <CardHeader>
                      <CardTitle>Estimate details</CardTitle>
                      <CardDescription>Route map, departure plan, and estimate breakdown.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <RouteEstimateDetails
                        data={activeResult || result}
                        incomplete={false}
                        allowHandoff={false}
                        saved={false}
                        selectedRouteId={selectedRoute?.route_id}
                        routeOptions={routeOptions}
                        emissionFormulaProvenance="current"
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <details className="mt-4">
                <summary className="cursor-pointer text-xs text-muted-foreground underline-offset-2 hover:underline">Calculation notes &amp; data freshness</summary>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {activeResult?.routing_source === "Synthetic UI fixture" ? "Sample fixture timestamp: " : "Calculated: "}
                  {activeResult?.calculation_time ? new Date(activeResult.calculation_time).toLocaleString("en-GB", { timeZone: "Asia/Jakarta" }) + " WIB" : "not supplied"}
                  {activeResult?.routing_source === "Synthetic UI fixture" ? (activeResult.calculation_time ? ". Sample timestamp follows the requested departure date; no live routing request was made." : ". No departure date was supplied, so the fixture did not provide a timestamp; no live routing request was made.") : ". Observation freshness is unverified. Congestion uses synthetic project data or an explicit default. Emissions are simplified estimates; no measured savings claim."}
                </p>
              </details>
            </>
          )}

          {!result && !loading && <PlannerEmptyState />}
        </section>
      </div>
    </div>
  );
}

export function RoutePlanner() {
  const { user, loading } = useAuth();
  if (loading)
    return (<p role="status" className="p-6 text-sm text-muted-foreground">Loading planner...</p>);
  return (<PlannerWorkspace key={user?.id || "anonymous"} account={user?.id || ""} />);
}
