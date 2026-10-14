"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import MapView from "@/components/MapView";
import { resultStatusLabels } from "@/lib/oracle-results";
import { roadName } from "@/lib/road-segments";
import type { DisplayMessage, OracleResult, ScheduleEntry } from "@/types/oracle";

const format = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(value);
const date = (value: string) => new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta",
}).format(new Date(value)) + " WIB";

function Facts({ values }: { values: [string, string | number | undefined][] }) {
  return <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
    {values.filter(([, value]) => value !== undefined).map(([label, value]) => <div key={label} className="min-w-0 rounded-lg border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words font-medium">{value}</dd>
    </div>)}
  </dl>;
}

function ScheduleDetails({ schedules }: { schedules: ScheduleEntry[] }) {
  if (!schedules.length) return <p>No departures were returned by this source. Availability has not been confirmed.</p>;
  const cutoff = schedules.some(row => row.cutoff_time !== undefined);
  const vessel = schedules.some(row => row.vessel_type !== undefined);
  const capacity = schedules.some(row => row.cargo_capacity_tons !== undefined);
  return <div>
    <p className="mb-3 text-xs text-muted-foreground">Recorded departures; service dates and the source time zone were not provided.</p>
    <div className="max-w-full overflow-x-auto rounded-lg border">
    <table className="w-full text-left text-sm">
      <caption className="sr-only">Recorded ferry schedules</caption>
      <thead className="bg-muted"><tr>
        {["Terminal", "Destination", "Departure", ...(cutoff ? ["Cutoff"] : []), ...(vessel ? ["Vessel"] : []), ...(capacity ? ["Capacity (tons)"] : [])].map(label => <th key={label} scope="col" className="p-3 font-medium">{label}</th>)}
      </tr></thead>
      <tbody>{schedules.map((row, index) => <tr key={index} className="border-t">
        <td className="p-3 break-words">{row.terminal}</td><td className="p-3 break-words">{row.destination}</td><td className="p-3 whitespace-nowrap">{row.departure_time}</td>
        {cutoff && <td className="p-3 whitespace-nowrap">{row.cutoff_time ?? "Not provided"}</td>}
        {vessel && <td className="p-3 break-words">{row.vessel_type ?? "Not provided"}</td>}
        {capacity && <td className="p-3">{row.cargo_capacity_tons !== undefined ? format(row.cargo_capacity_tons) : "Not provided"}</td>}
      </tr>)}</tbody>
    </table>
    </div>
  </div>;
}

function ResultDetails({ result }: { result: OracleResult }) {
  if (result.type === "congestion") {
    const data = result.data;
    return <Facts values={[["Road corridor", roadName(data.segment_id, data.segment_name)], ["Day type", data.day_type], ["Hour bucket", `${data.hour}:00`],
      ["Congestion level", data.congestion_level], ["Time multiplier", `${format(data.multiplier)}×`]]} />;
  }
  if (result.type === "schedule") return <ScheduleDetails schedules={result.data.schedules} />;
  if (result.type === "route") {
    const data = result.data;
    const absoluteOrClock = (absolute?: string, clock?: string) => absolute ? date(absolute) : clock ? `${clock}${data.planning_timezone ? " WIB" : ""}` : undefined;
    const approximate = data.routing_source === "Haversine Fallback";
    return <>
      {data.route_geometry && data.origin && data.destination ? <section aria-label="Saved route map" className="mb-4">
        <div className="relative h-[320px] overflow-hidden rounded-xl border sm:h-[380px]">
          <MapView routeCoordinates={data.route_geometry.coordinates.map(([lng, lat]) => [lat, lng])}
            originCoords={[data.origin.lat, data.origin.lng]} destCoords={[data.destination.lat, data.destination.lng]}
            originStr={data.origin_name || "Origin"} destStr={data.destination_name || "Destination"} approximate={approximate} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{approximate ? "Approximate straight-line connection; road routing was unavailable." : "Simplified saved route preview."} Location points may represent an area or access road.</p>
      </section> : <p className="mb-4 text-xs text-muted-foreground">Map unavailable for this saved result.</p>}
      {data.planning_warning && <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950">{data.planning_warning}</p>}
      <Facts values={[["Origin", data.origin_name], ["Destination", data.destination_name],
        ["Planned departure", absoluteOrClock(data.departure_datetime, data.departure_time)], ["Day type", data.day_type],
        ["Cargo type", data.cargo_type?.replaceAll("_", " ")], ["Vessel ETD", data.vessel_etd?.includes("T") ? date(data.vessel_etd) : absoluteOrClock(undefined, data.vessel_etd)],
        ["Distance", `${format(data.distance_km)} km`], ["Travel time", `${format(data.final_time_min)} min`],
        ["Routing source", data.routing_source], ["Base travel time", data.base_time_min !== undefined ? `${format(data.base_time_min)} min` : undefined],
        ["Congestion level", data.congestion_level], ["Time multiplier", data.congestion_multiplier !== undefined ? `${format(data.congestion_multiplier)}×` : undefined],
        ["Emission estimate", data.emission_kg !== undefined ? `${format(data.emission_kg)} kg` : undefined], ["Matched road corridor", roadName(data.matched_segment_id, data.matched_segment_name)],
        ["Latest gate-in", absoluteOrClock(data.latest_gate_in_datetime, data.latest_gate_in)], ["Suggested departure", absoluteOrClock(data.optimal_departure_datetime, data.optimal_departure)],
        ["Departure feasibility", data.departure_feasible === undefined ? undefined : data.departure_feasible ? "Within estimated cutoff" : "Too late for estimated cutoff"],
        ["Congestion estimate status", data.congestion_status?.replaceAll("_", " ")]]} />
      {(data.latest_gate_in !== undefined || data.optimal_departure !== undefined) && <p className="mt-3 text-xs text-muted-foreground">{data.planning_timezone ? "Times use Asia/Jakarta (WIB). Suggested departure is the latest safe departure for this estimate." : "Clock times come from this result. A service date and source time zone were not provided."}</p>}
    </>;
  }
  return <pre className="max-w-full overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-xs">{JSON.stringify(result.data, null, 2)}</pre>;
}

function Preview({ result }: { result: OracleResult }) {
  if (result.type === "congestion") return <p>{roadName(result.data.segment_id, result.data.segment_name)} · {result.data.congestion_level} · {format(result.data.multiplier)}× travel time</p>;
  if (result.type === "schedule") return <p>{result.data.schedules.length} recorded departure{result.data.schedules.length === 1 ? "" : "s"}</p>;
  if (result.type === "route") return <p>{format(result.data.distance_km)} km · {format(result.data.final_time_min)} min</p>;
  return <p>Additional structured data</p>;
}

function ResultModal({ result, incomplete }: { result: OracleResult; incomplete: boolean }) {
  return <Dialog.Portal>
    <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40" />
    <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border bg-background text-foreground shadow-xl">
      <div className="shrink-0 border-b p-4 pr-16 sm:p-6 sm:pr-16">
        <Dialog.Title className="break-words text-lg font-semibold">{result.title}</Dialog.Title>
        <Dialog.Description className="mt-1 text-sm text-muted-foreground">Saved {result.type} result · {resultStatusLabels[result.data_status]}</Dialog.Description>
        <Dialog.Close render={<Button variant="ghost" size="icon" className="absolute top-2 right-2" aria-label="Close result details" />}><X aria-hidden="true" /></Dialog.Close>
      </div>
      <div className="min-h-0 overflow-y-auto p-4 text-sm sm:p-6">
        {incomplete && <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950">This turn failed or was interrupted. These saved tool results are not a complete recommendation.</p>}
        <ResultDetails result={result} />
        <section aria-label="Source and limitations" className="mt-5 space-y-2 border-t pt-4">
          <p className="break-words"><strong>Source:</strong> {result.source}</p>
          <p><strong>Data status:</strong> {resultStatusLabels[result.data_status]}</p>
          {result.observed_at ? <p><strong>Observed:</strong> {date(result.observed_at)}</p> : <p>Observation time not provided; freshness unverified.</p>}
          {result.calculated_at && <p><strong>Calculated:</strong> {date(result.calculated_at)}</p>}
          <p className="break-words whitespace-pre-wrap"><strong>Limitations:</strong> {result.disclaimer}</p>
        </section>
      </div>
      <div className="shrink-0 border-t p-3 text-right"><Dialog.Close render={<Button variant="outline" />}>Close details</Dialog.Close></div>
    </Dialog.Popup>
  </Dialog.Portal>;
}

export function OracleResults({ results = [], unavailable = 0, outcome }: {
  results?: OracleResult[]; unavailable?: number; outcome: DisplayMessage["outcome"];
}) {
  const saved = outcome === "completed" || outcome === "failed" || outcome === "interrupted";
  if (!results.length && !unavailable) return null;
  return <div className="mt-3 min-w-0 space-y-3 whitespace-normal">
    {results.length > 0 && <p className="text-xs text-muted-foreground">{results.length} result record{results.length === 1 ? "" : "s"}</p>}
    {unavailable > 0 && <p className="text-xs text-muted-foreground">{unavailable} result{unavailable === 1 ? " is" : "s are"} unavailable because the data could not be validated.</p>}
    {!saved && results.length > 0 && <p className="text-xs text-muted-foreground">Result details will be available when the saved outcome is confirmed.</p>}
    {saved && results.map((result, index) => <Dialog.Root key={index}>
      <article aria-label={`${result.title} result`} className="min-w-0 space-y-2 rounded-lg border bg-background p-3 text-sm text-foreground">
        <h3 className="break-words font-medium">{result.title}</h3>
        <p className="text-xs text-muted-foreground">{resultStatusLabels[result.data_status]}</p>
        <Preview result={result} />
        <p className="break-words text-xs text-muted-foreground">Source: {result.source}</p>
        <Dialog.Trigger render={<Button variant="outline" size="sm" aria-label={`View details: ${result.title}`} />}>View details</Dialog.Trigger>
      </article>
      <ResultModal result={result} incomplete={outcome !== "completed"} />
    </Dialog.Root>)}
  </div>;
}
