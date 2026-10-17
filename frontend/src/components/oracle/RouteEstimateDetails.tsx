"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Gauge,
  Info,
  Leaf,
  MapPin,
  Route,
  Ship,
} from "lucide-react";
import { RoutePlannerHandoff } from "./RoutePlannerHandoff";
import { routeInsights } from "@/lib/route-insights";
import MapView from "@/components/MapView";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  formatOracleDate as date,
  formatOracleNumber as format,
} from "@/lib/oracle-format";
import { roadName } from "@/lib/road-segments";
import type { RouteData } from "@/types/oracle";

function Metric({
  label,
  value,
  detail,
  primary = false,
}: {
  label: string;
  value: string;
  detail: string;
  primary?: boolean;
}) {
  return (
    <Card
      className={`min-w-0 gap-0 rounded-xl p-4 shadow-none ring-0 ${primary ? "border border-primary/20 bg-primary/5" : "border bg-card"}`}
    >
      <dl>
        <dt
          className={`mb-2 flex items-center gap-2 text-xs font-medium ${primary ? "text-primary" : "text-muted-foreground"}`}
        >
          {primary ? (
            <Clock3 aria-hidden="true" className="size-4" />
          ) : (
            <Route aria-hidden="true" className="size-4" />
          )}
          {label}
        </dt>
        <dd
          className={`text-3xl font-semibold tracking-tight tabular-nums [overflow-wrap:anywhere] ${primary ? "text-primary" : "text-foreground"}`}
        >
          {value}
        </dd>
      </dl>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {detail}
      </p>
    </Card>
  );
}

export function RouteEstimateDetails({
  data,
  incomplete,
  allowHandoff = true,
  saved = true,
}: {
  data: RouteData;
  incomplete: boolean;
  allowHandoff?: boolean;
  saved?: boolean;
}) {
  const time = (absolute?: string, clock?: string) =>
    absolute
      ? date(absolute)
      : clock
        ? `${clock}${data.planning_timezone ? " WIB" : ""}`
        : undefined;
  const approximate = data.routing_source === "Haversine Fallback";
  const savedMap =
    data.route_geometry && data.origin && data.destination
      ? {
          geometry: data.route_geometry,
          origin: data.origin,
          destination: data.destination,
        }
      : null;
  const suggested = time(
    data.optimal_departure_datetime,
    data.optimal_departure,
  );
  const planned = time(data.departure_datetime, data.departure_time);
  const gateIn = time(data.latest_gate_in_datetime, data.latest_gate_in);
  const vessel = data.vessel_etd?.includes("T")
    ? date(data.vessel_etd)
    : time(undefined, data.vessel_etd);
  const delta =
    data.base_time_min === undefined
      ? undefined
      : data.final_time_min - data.base_time_min;
  const travelDetail =
    delta === undefined
      ? saved
        ? "Based on the saved routing estimate."
        : "Based on the routing estimate."
      : Math.abs(delta) < 0.001
        ? "Matches the base travel estimate."
        : `${format(Math.abs(delta))} min ${delta > 0 ? "above" : "below"} the base travel estimate.`;
  const { late, feasible, status, action } = routeInsights(data, incomplete);
  const StatusIcon =
    incomplete || late ? AlertTriangle : feasible ? CheckCircle2 : Info;
  const tone = incomplete
    ? "border-amber-500/25 bg-amber-500/5 text-amber-900"
    : late
      ? "border-destructive/25 bg-destructive/5 text-destructive"
      : feasible
        ? "border-emerald-600/20 bg-emerald-600/5 text-emerald-800"
        : "border-border bg-muted/30 text-muted-foreground";
  const facts: [string, string | undefined][] = [
    ["Routing source", data.routing_source],
    [
      "Matched road corridor",
      roadName(data.matched_segment_id, data.matched_segment_name),
    ],
    [
      "Base travel time",
      data.base_time_min === undefined
        ? undefined
        : `${format(data.base_time_min)} min`,
    ],
    ["Congestion level", data.congestion_level],
    [
      "Time multiplier",
      data.congestion_multiplier === undefined
        ? undefined
        : `${format(data.congestion_multiplier)}×`,
    ],
    [
      "Congestion estimate status",
      data.congestion_status?.replaceAll("_", " "),
    ],
    [
      "Emission estimate",
      data.emission_kg === undefined
        ? undefined
        : `${format(data.emission_kg)} kg`,
    ],
  ];

  return (
    <div className="space-y-5">
      {allowHandoff && (
        <RoutePlannerHandoff data={data} incomplete={incomplete} />
      )}
      {data.departure_date_inferred && (
        <p className="text-xs text-muted-foreground">
          Departure date inferred from the vessel local date. Review it before
          dispatch.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Resolved inputs: {data.origin_name || "Origin coordinates"} to{" "}
        {data.destination_name || "Destination coordinates"}.{" "}
        {data.departure_date || "No explicit service date"}{" "}
        {data.departure_time || ""} {data.planning_timezone || ""}. Review
        inherited values when updating a plan.
      </p>
      {data.planning_warning && (
        <Alert
          role="note"
          className={`rounded-xl ${late ? "border-destructive/25 bg-destructive/5" : "border-amber-500/25 bg-amber-500/5"}`}
        >
          <AlertTriangle
            aria-hidden="true"
            className={late ? "text-destructive" : "text-amber-700"}
          />
          <AlertTitle className={late ? "text-destructive" : "text-amber-900"}>
            Review before dispatch
          </AlertTitle>
          <AlertDescription className="break-words text-foreground/80">
            {data.planning_warning}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid min-w-0 gap-5 @4xl/route:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="order-2 min-w-0 space-y-5 @4xl/route:order-1">
          <section
            aria-label={saved ? "Saved route map" : "Route map"}
            className="min-w-0"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <MapPin aria-hidden="true" className="size-4 text-primary" />
                Route overview
              </h3>
              <div className="flex flex-wrap gap-2">
                {data.day_type && (
                  <Badge
                    variant="secondary"
                    title="Day type"
                    className="font-normal capitalize"
                  >
                    {data.day_type}
                  </Badge>
                )}
                {data.cargo_type && (
                  <Badge
                    variant="outline"
                    title="Cargo type"
                    className="font-normal"
                  >
                    {data.cargo_type.replaceAll("_", " ")}
                  </Badge>
                )}
              </div>
            </div>
            {savedMap ? (
              <>
                <div className="relative h-[300px] overflow-hidden rounded-xl border sm:h-[360px] @4xl/route:h-[420px]">
                  <MapView
                    routeCoordinates={savedMap.geometry.coordinates.map(
                      ([lng, lat]) => [lat, lng],
                    )}
                    originCoords={[savedMap.origin.lat, savedMap.origin.lng]}
                    destCoords={[
                      savedMap.destination.lat,
                      savedMap.destination.lng,
                    ]}
                    originStr={data.origin_name || "Origin"}
                    destStr={data.destination_name || "Destination"}
                    approximate={approximate}
                  />
                </div>
                <p
                  className={`mt-2 text-xs leading-relaxed ${approximate ? "text-amber-800" : "text-muted-foreground"}`}
                >
                  {approximate
                    ? "Approximate straight-line connection; road routing was unavailable."
                    : saved
                      ? "Simplified saved route preview."
                      : "Simplified route preview."}{" "}
                  Location points may represent an area or access road.
                </p>
              </>
            ) : (
              <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/25 p-5 text-center">
                <MapPin
                  aria-hidden="true"
                  className="size-7 text-muted-foreground"
                />
                <p className="text-sm font-medium">
                  {saved
                    ? "Map unavailable for this saved result."
                    : "Map unavailable for this result."}
                </p>
                <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                  Saved endpoints and route geometry are needed to display a
                  route.
                </p>
                {(data.origin_name || data.destination_name) && (
                  <dl className="w-full space-y-2 text-left text-xs">
                    {[
                      ["Origin", data.origin_name],
                      ["Destination", data.destination_name],
                    ]
                      .filter(([, value]) => value)
                      .map(([label, value]) => (
                        <div key={label}>
                          <dt className="text-muted-foreground">{label}</dt>
                          <dd className="break-words font-medium">{value}</dd>
                        </div>
                      ))}
                  </dl>
                )}
              </div>
            )}
          </section>

          <section
            aria-label="Route assumptions"
            className="rounded-xl border bg-muted/15 p-4"
          >
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Gauge
                aria-hidden="true"
                className="size-4 text-muted-foreground"
              />
              Estimate breakdown
            </h3>
            <p className="mb-4 text-xs leading-relaxed text-muted-foreground">Congestion uses a reference corridor near the origin. It does not establish traffic on every road along this route.</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
              {facts
                .filter(([, value]) => value !== undefined)
                .map(([label, value]) => (
                  <div
                    key={label}
                    className={`min-w-0 ${label === "Matched road corridor" ? "col-span-2" : ""}`}
                  >
                    <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                      {label === "Emission estimate" && (
                        <Leaf aria-hidden="true" className="size-3" />
                      )}
                      {label}
                    </dt>
                    <dd
                      className={`mt-1 break-words text-sm font-medium ${label === "Congestion level" && data.congestion_level === "HIGH" ? "text-destructive" : label === "Congestion level" && data.congestion_level === "MEDIUM" ? "text-amber-800" : ""}`}
                    >
                      {value}
                    </dd>
                  </div>
                ))}
            </dl>
          </section>
        </div>

        <section
          aria-label="Route planning summary"
          className="order-1 min-w-0 space-y-4 @4xl/route:order-2"
        >
          <div className="grid grid-cols-2 gap-3">
            <Metric
              label="Travel time"
              value={`${format(data.final_time_min)} min`}
              detail={travelDetail}
              primary
            />
            <Metric
              label="Distance"
              value={`${format(data.distance_km)} km`}
              detail={
                approximate
                  ? "Approximate straight-line distance."
                  : "Distance returned by the routing source."
              }
            />
          </div>

          <Card className="gap-0 rounded-xl border py-0 shadow-none ring-0">
            <div className="border-b px-4 py-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Ship aria-hidden="true" className="size-4 text-primary" />
                Departure plan
              </h3>
            </div>
            <div className="space-y-4 p-4">
              <div className={`rounded-lg border p-3 ${tone}`}>
                <p className="mb-1 text-[11px] font-medium">
                  Departure feasibility
                </p>
                <p className="flex items-start gap-2 text-sm font-semibold">
                  <StatusIcon
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0"
                  />
                  {status}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-foreground/75">
                  {action}
                </p>
              </div>
              <dl className="space-y-3">
                {suggested && (
                  <div className="rounded-lg border border-primary/15 bg-primary/5 p-3">
                    <dt className="mb-1 text-xs font-medium text-primary">
                      Suggested departure
                    </dt>
                    <dd>
                      <span className="block break-words text-xl font-semibold tracking-tight tabular-nums text-primary">
                        {suggested}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                        Back-calculated using congestion at the requested
                        departure time.
                      </span>
                    </dd>
                  </div>
                )}
                {[
                  ["Planned departure", planned],
                  [
                    "Estimated arrival",
                    time(
                      data.estimated_arrival_datetime,
                      data.estimated_arrival_time,
                    ),
                  ],
                  [
                    "Cutoff slack",
                    data.cutoff_slack_min === undefined
                      ? undefined
                      : `${format(data.cutoff_slack_min)} min${data.cutoff_slack_min < 0 ? " late" : " remaining"}`,
                  ],
                  ["Latest gate-in", gateIn],
                  ["Vessel ETD", vessel],
                ]
                  .filter(([, value]) => value !== undefined)
                  .map(([label, value]) => (
                    <div
                      key={label}
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b pb-3 last:border-0 last:pb-0"
                    >
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="break-words text-sm font-semibold tabular-nums">
                        {value}
                      </dd>
                    </div>
                  ))}
              </dl>
              {(suggested || gateIn) && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {data.planning_timezone
                    ? "Times use Asia/Jakarta (WIB). Suggested departure depends on this estimate and its assumptions."
                    : "Clock times come from this result. A service date and source time zone were not provided."}
                </p>
              )}
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
