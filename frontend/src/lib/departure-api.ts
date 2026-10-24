import { parseDeparture, parseDeparturePlan, parseRecordedSailings, record, samePlan } from "./departure-contract";
import type { DeparturePlan } from "../types/departure";

type Auth = { getSession: () => Promise<{ data: { session: { access_token: string; user: { id: string } } | null }; error: unknown }> };
export class DepartureApiError extends Error {
  constructor(public status: number, message: string, public fields: string[] = []) { super(message); }
}
const unavailable = () => new DepartureApiError(503, "The planning service is temporarily unavailable. Please retry.");
export async function boundedJson(response: Response, max = 65536): Promise<unknown> {
  if (!response.body) throw unavailable();
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let size = 0, text = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) throw unavailable();
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally { await reader.cancel(); reader.releaseLock(); }
}
const fields = ["origin", "origin_name", "terminal", "ferry_destination", "departure_date", "departure_time", "service_date", "service_kind", "day_type", "schedule_id"];
export function parseDepartureError(status: number, body: unknown): DepartureApiError {
  if (status === 401) return new DepartureApiError(401, "Your session expired. Sign in again.");
  let detail: unknown;
  try { detail = record(body).detail; } catch { return unavailable(); }
  if (typeof detail === "string") {
    // Existing authentication strings are recognized, never echo arbitrary diagnostics.
    if (status === 503 && detail === "Authentication service is temporarily unavailable") return new DepartureApiError(503, "The authentication service is temporarily unavailable. Please retry.");
    return unavailable();
  }
  if (Array.isArray(detail) && status === 422 && detail.length <= 20) {
    const affected = new Set<string>();
    for (const value of detail) {
      try {
        const row = record(value);
        if (!Array.isArray(row.loc) || row.loc.length > 10 || typeof row.msg !== "string" || row.msg.length > 500 || typeof row.type !== "string" || row.type.length > 80) return unavailable();
        for (const part of row.loc) if (typeof part === "string" && fields.includes(part)) affected.add(part);
      } catch { return unavailable(); }
    }
    return new DepartureApiError(422, "Check the highlighted planning fields and try again.", [...affected]);
  }
  try {
    const row = record(detail);
    if (Object.keys(row).sort().join() !== "code,fields,message" || typeof row.code !== "string" || row.code.length > 80 || typeof row.message !== "string" || row.message.length < 1 || row.message.length > 500 || !Array.isArray(row.fields) || row.fields.length > 10 || row.fields.some(v => typeof v !== "string" || !fields.includes(v))) return unavailable();
    const messages: Record<string, string> = {
      SCHEDULE_NOT_FOUND: "Selected sailing was not found. Revise the target sailing.",
      SCHEDULE_MISMATCH: "The target conflicts with the terminal, destination or sailing date. Correct the plan or choose another target.",
      SERVICE_MISMATCH: "The target does not permit the selected service. Correct the service or target.",
      REQUEST_TOO_LARGE: "The planning request is too large. Shorten the input values.",
    };
    return new DepartureApiError(status, messages[row.code] || unavailable().message, row.fields as string[]);
  } catch { return unavailable(); }
}
export function createDepartureApi(account: string, auth: Auth, base = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080", fetcher: typeof fetch = fetch) {
  async function token(signal: AbortSignal) {
    signal.throwIfAborted();
    let response: Awaited<ReturnType<Auth["getSession"]>>;
    try {
      response = await new Promise((resolve, reject) => {
        const aborted = () => reject(signal.reason);
        signal.addEventListener("abort", aborted, { once: true });
        auth.getSession().then(resolve, reject).finally(() => signal.removeEventListener("abort", aborted));
      });
    } catch { signal.throwIfAborted(); throw unavailable(); }
    const { data, error } = response;
    signal.throwIfAborted();
    if (error || !data.session?.access_token || data.session.user.id !== account) throw new DepartureApiError(401, "Your session expired. Sign in again.");
    return data.session.access_token;
  }
  return {
    async calculate(input: DeparturePlan, signal: AbortSignal) {
      const plan = parseDeparturePlan(input), accessToken = await token(signal), body = JSON.stringify(plan);
      if (new TextEncoder().encode(body).length > 8192) throw new DepartureApiError(413, "The planning request is too large.");
      let response: Response;
      try { response = await fetcher(`${base.replace(/\/$/, "")}/departure-recommendation`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body, signal }); }
      catch { signal.throwIfAborted(); throw unavailable(); }
      let data: unknown;
      try { data = await boundedJson(response); } catch { signal.throwIfAborted(); if (response.status === 401) throw parseDepartureError(401, null); throw unavailable(); }
      signal.throwIfAborted();
      if (!response.ok) throw parseDepartureError(response.status, data);
      const result = parseDeparture(data);
      if (!samePlan(result.plan, plan)) throw unavailable();
      // Recheck identity after I/O, including logout or account changes during a request.
      await token(signal);
      return result;
    },
    async sailings(signal: AbortSignal) {
      const response = await fetcher(`${base.replace(/\/$/, "")}/schedules`, { signal });
      if (!response.ok) throw unavailable();
      const rows = parseRecordedSailings(await boundedJson(response, 1048576));
      signal.throwIfAborted();
      return rows;
    },
  };
}
