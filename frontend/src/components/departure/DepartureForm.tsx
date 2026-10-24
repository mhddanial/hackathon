"use client";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { batamLocations } from "@/lib/locations";
import { createDepartureApi } from "@/lib/departure-api";
import { createClient } from "@/utils/supabase/client";
import { dayType } from "@/lib/departure-contract";
import type { DepartureFormValues } from "@/lib/departure-form";
import type { RecordedSailing } from "@/types/departure";

const labels: Record<keyof DepartureFormValues, string> = { origin: "Origin · supported name or latitude, longitude", terminal: "Terminal", ferry_destination: "Ferry destination", service_kind: "Required service", departure_date: "Road departure date · WIB", departure_time: "Road departure time · WIB", service_date: "Ferry service date · WIB", schedule_id: "Target sailing" };
const selectClass = "min-h-11 w-full min-w-0 rounded-md border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring";
export function DepartureForm({ form, fields, loading, expired, account, update, calculate, stop }: {
  form: DepartureFormValues; fields: Record<string, string>; loading: boolean; expired: boolean; account: string;
  update: (key: keyof DepartureFormValues, value: string) => void; calculate: () => void; stop: () => void;
}) {
  const [rows, setRows] = useState<RecordedSailing[]>([]), [reference, setReference] = useState("Loading recorded sailings…"), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => { controller.abort(); setReference("Recorded sailings timed out. Retry the catalog or use automatic selection."); }, 10000);
    void (async () => {
      try {
        const data = await createDepartureApi(account, createClient().auth).sailings(controller.signal);
        if (!controller.signal.aborted) { setRows(data); setReference(data.length ? "First 100 catalog rows inspected. Unknown metadata stays unverified; the backend validates applicability and freshness." : "No selectable recorded sailings. Automatic selection can still explain missing data."); }
      } catch { if (!controller.signal.aborted) setReference("Recorded sailings are unavailable. Retry the catalog or use automatic selection."); }
      finally { window.clearTimeout(timer); }
    })();
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [account, retry]);
  const normalized = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  const options = rows.filter(r => r.terminal === form.terminal && (!form.ferry_destination.trim() || normalized(r.destination) === normalized(form.ferry_destination)) && (!r.serviceDate || r.serviceDate === form.service_date));
  const selected = rows.find(r => r.id === form.schedule_id);
  let day = "Choose a road date to derive day type.";
  try { day = `Day type: ${dayType(form.departure_date)} · Asia/Jakarta (UTC+07:00)`; } catch { /* Incomplete form. */ }
  const field = (key: keyof DepartureFormValues, control: React.ReactNode, hint?: string) => <div className="min-w-0 space-y-2" key={key}>
    <label htmlFor={`dep-${key}`} className="block text-sm font-medium">{labels[key]}</label>{control}
    {hint && <p id={`dep-${key}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
    {fields[key] && <p id={`dep-${key}-error`} className="text-sm text-destructive">{fields[key]}</p>}
  </div>;
  const attrs = (key: keyof DepartureFormValues) => ({ id: `dep-${key}`, value: form[key], "aria-invalid": !!fields[key], "aria-describedby": [fields[key] ? `dep-${key}-error` : "", ["origin", "service_kind", "departure_time", "service_date", "schedule_id"].includes(key) ? `dep-${key}-hint` : ""].filter(Boolean).join(" ") || undefined, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => update(key, e.target.value) });
  return <form noValidate aria-label="Departure planning inputs" onSubmit={e => { e.preventDefault(); calculate(); }} className="space-y-5">
    {Object.keys(fields).length > 0 && <div role="alert" className="rounded-lg border border-destructive p-3 text-sm"><p className="font-medium">Review the planning fields</p><ul className="mt-2 space-y-1">{Object.entries(fields).map(([key, value]) => <li key={key}><a className="underline" href={`#dep-${key}`} onClick={() => document.getElementById(`dep-${key}`)?.focus()}>{labels[key as keyof DepartureFormValues] || key}: {value}</a></li>)}</ul></div>}
    <div className="grid min-w-0 gap-5 md:grid-cols-2">
      {field("origin", <Input {...attrs("origin")} className="min-h-11" list="departure-origins" maxLength={256} autoComplete="off" />, "Choose a catalog name, or enter latitude, longitude within Batam.")}
      <datalist id="departure-origins">{batamLocations.map(r => <option key={r.id} value={r.name} />)}</datalist>
      {field("terminal", <select {...attrs("terminal")} className={selectClass}><option value="batu_ampar">Batu Ampar</option><option value="batam_center">Batam Center</option><option value="sekupang">Sekupang</option></select>)}
      {field("ferry_destination", <Input {...attrs("ferry_destination")} className="min-h-11" list="departure-destinations" maxLength={80} autoComplete="off" />)}
      <datalist id="departure-destinations">{[...new Set(rows.filter(r => r.terminal === form.terminal).map(r => r.destination))].map(v => <option key={v} value={v} />)}</datalist>
      {field("service_kind", <select {...attrs("service_kind")} className={selectClass}><option value="">Choose service</option><option value="cargo">Cargo</option><option value="passenger_hand_carry">Passenger / hand carry</option></select>, "Sailing permission must be recorded. Vessel labels do not establish eligibility or capacity.")}
      {field("departure_date", <Input {...attrs("departure_date")} className="min-h-11" type="date" />)}
      {field("departure_time", <Input {...attrs("departure_time")} className="min-h-11" type="time" step={60} />, day)}
      {field("service_date", <Input {...attrs("service_date")} className="min-h-11" type="date" />, "The ferry’s departure date in WIB. Choose the road date or following date explicitly; no recurrence is assumed.")}
      {field("schedule_id", <select {...attrs("schedule_id")} className={selectClass}>
        <option value="">Automatic selection</option>
        {form.schedule_id && !options.some(r => r.id === form.schedule_id) && <option value={form.schedule_id}>Retained target {form.schedule_id} · review constraints</option>}
        {options.map(r => <option key={r.id} value={r.id}>{r.synthetic ? "Simulation · " : ""}{r.id} · {r.destination} · {r.serviceDate || "date unverified"}</option>)}
      </select>, "Automatic: earliest SAFE, then earliest RISKY, otherwise latest missed cutoff among evaluated sailings. A chosen UUID is never replaced silently.")}
    </div>
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
      <p role="status">{reference}</p>
      {selected && <dl className="grid gap-1 break-words sm:grid-cols-2"><div><dt>Recorded target / terminal</dt><dd>{selected.id} / {selected.terminal}</dd></div><div><dt>Destination / service date</dt><dd>{selected.destination} / {selected.serviceDate || "Not verified"}</dd></div><div><dt>Recorded source departure / cutoff</dt><dd>{selected.departure || "Not verified"} / {selected.cutoff || "Not verified"}</dd></div><div><dt>Source timezone / verification</dt><dd>{selected.zone || "Not verified"} / {selected.verified || "Not verified"}</dd></div></dl>}
      <p>Source clocks are not assigned a WIB date. Unknown date, cutoff, timezone or freshness can make the result UNAVAILABLE.</p>
    </div>
    <div className="flex flex-wrap gap-3">
      <Button className="min-h-11" type="submit" disabled={loading || expired}>{loading ? "Calculating…" : "Calculate recommendation"}</Button>
      {loading && <Button className="min-h-11" variant="outline" type="button" onClick={stop}>Stop</Button>}
      <Button className="min-h-11" variant="ghost" type="button" onClick={() => { setRows([]); setReference("Loading recorded sailings…"); setRetry(n => n + 1); }}>Reload recorded sailings</Button>
    </div>
  </form>;
}
