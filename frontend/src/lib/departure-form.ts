import { batamLocations } from "./locations";
import { calendarDate, dayType, parseDeparturePlan, uuid } from "./departure-contract";
import type { DeparturePlan } from "../types/departure";
export type DepartureFormValues = { origin: string; terminal: string; ferry_destination: string; service_kind: string; departure_date: string; departure_time: string; service_date: string; schedule_id: string };
export const initialDepartureForm: DepartureFormValues = { origin: "Batamindo Industrial Park", terminal: "batu_ampar", ferry_destination: "", service_kind: "", departure_date: "", departure_time: "", service_date: "", schedule_id: "" };
export class DepartureValidationError extends Error {
  constructor(public errors: Record<string, string>) { super("Review the highlighted planning fields."); }
}
export function departureInput(form: DepartureFormValues): DeparturePlan {
  const errors: Record<string, string> = {};
  let origin = { lat: 0, lng: 0 };
  const key = form.origin.toLowerCase().trim();
  if (!key || form.origin.trim().length > 256) errors.origin = "Enter an origin label with 1–256 characters.";
  const matches = batamLocations.filter(r => [r.id, r.name, ...r.aliases].some(v => v.toLowerCase() === key));
  if (matches.length === 1) origin = { lat: matches[0].lat, lng: matches[0].lng };
  else {
    const parts = form.origin.split(",");
    if (parts.length === 2 && parts.every(p => p.trim() && Number.isFinite(Number(p)))) origin = { lat: Number(parts[0]), lng: Number(parts[1]) };
    else errors.origin = "Choose a supported origin or enter latitude, longitude.";
  }
  if (origin.lat < .7 || origin.lat > 1.25 || origin.lng < 103.8 || origin.lng > 104.3) errors.origin = "Choose coordinates inside Batam: latitude 0.7–1.25, longitude 103.8–104.3.";
  if (!["batu_ampar", "batam_center", "sekupang"].includes(form.terminal)) errors.terminal = "Choose a supported terminal.";
  if (!form.ferry_destination.trim() || form.ferry_destination.trim().replace(/\s+/g, " ").length > 80) errors.ferry_destination = "Enter the recorded ferry destination (1–80 characters).";
  if (!["cargo", "passenger_hand_carry"].includes(form.service_kind)) errors.service_kind = "Choose the required service; permission must be recorded.";
  for (const field of ["departure_date", "service_date"] as const) {
    try { calendarDate(form[field]); } catch { errors[field] = "Enter a valid calendar date."; }
  }
  if (!errors.departure_date && !errors.service_date) {
    const diff = (Date.parse(`${form.service_date}T00:00:00Z`) - Date.parse(`${form.departure_date}T00:00:00Z`)) / 86400000;
    if (diff !== 0 && diff !== 1) errors.service_date = "Choose the road date or the following date explicitly.";
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.departure_time)) errors.departure_time = "Enter road departure as HH:MM WIB.";
  if (form.schedule_id) try { uuid(form.schedule_id); } catch { errors.schedule_id = "Choose a recorded sailing UUID."; }
  if (Object.keys(errors).length) throw new DepartureValidationError(errors);
  return parseDeparturePlan({ ...form, ferry_destination: form.ferry_destination.trim().replace(/\s+/g, " "), origin, origin_name: form.origin.trim(), schedule_id: form.schedule_id || null, day_type: dayType(form.departure_date) });
}
export function roadTimeFromEstimate(value: string) {
  // API parser guarantees a Jakarta timestamp; preserve the calendar date across midnight.
  return { departure_date: value.slice(0, 10), departure_time: value.slice(11, 16) };
}
export function signedBuffer(value: number | null): string {
  if (value === null) return "Unavailable";
  if (value < 0 && value > -.005) return "− less than 0.01 min late";
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)} min`;
}
export function wib(value: string | null): string {
  return value === null ? "Not verified" : new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(new Date(value)) + " WIB";
}
