"use client";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { signedBuffer, wib } from "@/lib/departure-form";
import type { DepartureResult as Result, ScheduleView } from "@/types/departure";
const wording = { SAFE: "Estimated buffer meets the configured simulation threshold.", RISKY: "Estimated arrival leaves less than the configured safety buffer.", MISSED: "Estimated arrival is after this recorded cutoff.", UNAVAILABLE: "Required data could not establish a recommendation." };
const colors = { SAFE: "border-emerald-600 bg-emerald-50 text-emerald-950", RISKY: "border-amber-600 bg-amber-50 text-amber-950", MISSED: "border-red-600 bg-red-50 text-red-950", UNAVAILABLE: "border-slate-400 bg-slate-50 text-slate-950" };
function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return <dl className="grid min-w-0 gap-4 text-sm sm:grid-cols-2">{rows.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}</dl>;
}
function Sailing({ schedule }: { schedule: ScheduleView | null }) {
  return <Facts rows={[["Sailing UUID", schedule?.schedule_id || "Not verified"], ["Terminal / destination", `${schedule?.terminal || "Not verified"} / ${schedule?.destination || "Not verified"}`], ["Ferry departure", wib(schedule?.departure_at ?? null)], ["Recorded cutoff", wib(schedule?.cutoff_at ?? null)]]} />;
}
export function DepartureResult({ result, onUseRoadTime, choose, revise }: { result: Result; onUseRoadTime: (at: string) => void; choose: (id: string) => void; revise: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [result]);
  return <section aria-label="Departure recommendation" className="min-w-0 space-y-5">
    <Card className="gap-5 p-4 sm:p-6">
      <div className={`rounded-xl border-l-4 p-4 ${colors[result.status]}`}>
        <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold outline-offset-4">{result.status}</h2>
        <p className="mt-1 font-medium">{wording[result.status]}</p><p className="mt-2 text-sm">{result.reason}</p><p className="mt-1 text-xs">{result.reason_code}</p>
      </div>
      <p className="text-sm font-medium">{result.data_status === "simulation" ? "Planning simulation · synthetic congestion · no boarding guarantee" : "Data unavailable · no calculated safety claim"}{result.sources.schedule === "synthetic_fixture" ? " · Synthetic sailing scenario" : ""}</p>
      <p className="break-words text-sm text-muted-foreground">{result.selection.mode === "selected" ? "Explicit target retained" : "Automatic selection among evaluated candidates"} · {result.plan.terminal} → {result.plan.ferry_destination} · {result.plan.service_kind} · sailing date {result.plan.service_date} WIB</p>
      <Sailing schedule={result.selected_schedule} />
      <Facts rows={[["Road departure", wib(result.planned_departure_at)], ["Decision terminal ETA", result.estimated_arrival_at === null ? "Unavailable" : wib(result.estimated_arrival_at)], ["Travel duration", result.travel_time_min === null ? "Unavailable" : `${result.travel_time_min} min`], ["Signed cutoff buffer", signedBuffer(result.buffer_min)], ["Configured simulation safety buffer", `${result.safety_buffer_min} min`], ["Fixed-duration latest departure estimate", result.latest_departure_estimate_at === null ? "Unavailable" : wib(result.latest_departure_estimate_at)]]} />
      {result.buffer_min !== null && <p className="text-xs text-muted-foreground">Status is supplied by the backend before display rounding. Buffer display uses two decimals; subminute boundaries can round to zero or the threshold without changing status.</p>}
      {result.latest_departure_estimate_at && <div className="space-y-2"><p className="text-sm text-muted-foreground">Fixed-duration estimate; recalculate for its traffic period. This estimate can be in the past.</p><Button className="min-h-11" variant="outline" onClick={() => onUseRoadTime(result.latest_departure_estimate_at!)}>Use this road time</Button></div>}
      {result.status === "UNAVAILABLE" && result.route_estimate && <div className="space-y-2 rounded-xl border border-dashed p-4"><h3 className="font-medium">Route-only estimate · unavailable for decisions</h3><p className="text-sm">{result.route_estimate.final_time_min} min · approximate arrival {wib(result.route_estimate.estimated_arrival_at)}</p><p className="text-xs text-muted-foreground">{result.route_estimate.routing_source} / {result.route_estimate.congestion_status || "congestion unverified"} / context {result.route_estimate.context_verified ? "verified" : "unverified"}. This does not establish a cutoff buffer or safety status.</p></div>}
      <details className="min-w-0 rounded-lg border p-4 text-sm"><summary className="min-h-11 cursor-pointer font-medium">Sources, verification and limitations</summary>
        <div className="mt-4 space-y-4 break-words"><Facts rows={[["Schedule source", result.sources.schedule || "Not verified"], ["Cutoff source", result.sources.cutoff || "Not verified"], ["Route source", result.sources.route || "Not verified"], ["Congestion source", result.sources.congestion || "Not verified"], ["Source timezone", result.selected_schedule?.source_timezone || "Not verified"], ["Schedule verification", wib(result.selected_schedule?.verified_at ?? null)], ["Original departure / cutoff", `${result.selected_schedule?.source_departure_at || "Not verified"} / ${result.selected_schedule?.source_cutoff_at || "Not verified"}`], ["Calculated at", wib(result.calculated_at)]]} />
          {result.assumptions.length > 0 && <ul className="list-inside list-disc space-y-2">{result.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>}
          {result.warnings.map((w, i) => <p key={i}>{w.code}: {w.message}</p>)}
          <p>{result.selection.examined_count} examined; {result.selection.excluded_count} excluded; candidate limit {result.selection.candidate_limit}. Counts describe the bounded set, not all records.</p>
          {result.exclusions.length > 0 && <ul className="space-y-1">{result.exclusions.map((e, i) => <li key={i}>{e.schedule_id || "Unidentified record"}: {e.reason_code}</li>)}</ul>}
          <p>{result.disclaimer}</p>
        </div>
      </details>
      <Button className="min-h-11 self-start" variant="outline" onClick={revise}>Revise plan</Button>
    </Card>
    {result.selection.truncated && <p role="status" className="rounded-lg border p-4 text-sm">Candidate limit reached. Comparison is incomplete; alternatives are withheld. No exhaustive earliest-sailing claim is available.</p>}
    {result.status !== "UNAVAILABLE" && <section aria-label="Other evaluated sailings" className="space-y-3">
      <h2 className="text-lg font-semibold">Other evaluated sailings</h2>
      <p className="text-sm text-muted-foreground">Service date {result.plan.service_date} WIB only · at most 3 · {result.selection.excluded_count} candidates excluded. Road departure stays unchanged when choosing another sailing.</p>
      {result.alternatives.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm">No evaluated feasible alternatives on this service date.{result.selection.excluded_count > 0 ? " Unknown or incompatible records were excluded; review the source limitations." : ""}</p> : <div className="grid min-w-0 gap-4 xl:grid-cols-3">{result.alternatives.map(a => <Card key={a.schedule.schedule_id} className="min-w-0 gap-4 p-4">
        <h3 className="font-semibold">{a.status} · {wib(a.schedule.departure_at)}</h3><p className="text-sm">{a.reason}</p><Sailing schedule={a.schedule} />
        <Facts rows={[["Terminal ETA", wib(a.estimated_arrival_at)], ["Signed buffer", signedBuffer(a.buffer_min)], ["Fixed-duration latest estimate", wib(a.latest_departure_estimate_at)], ["Verification / source", `${wib(a.schedule.verified_at)} / ${a.schedule.source}`]]} />
        <p className="text-xs text-muted-foreground">{a.schedule.source === "synthetic_fixture" ? "Simulation sailing · " : ""}Fixed-duration estimate; recalculate for another traffic period.</p>
        <Button className="min-h-11 w-full whitespace-normal" variant="outline" onClick={() => choose(a.schedule.schedule_id!)}>Choose and recalculate</Button>
      </Card>)}</div>}
    </section>}
  </section>;
}
