// Loopback-only SYNTHETIC Auth/API fixture. Never reads env files or live services.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
const port = Number(process.env.DEPARTURE_FIXTURE_PORT || 9011), base = `http://127.0.0.1:${port}`;
const examples = JSON.parse(await readFile(new URL("../../docs/departure/contracts/DEPARTURE_API_EXAMPLES.json", import.meta.url))).examples;
const sample = examples.find(e => e.id === "selected-safe").response;
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const user = owner => ({ id: owner, aud: "authenticated", role: "authenticated", email: `${owner === id(101) ? "a" : "b"}@departure.example.invalid`, app_metadata: { provider: "email", providers: ["email"] }, user_metadata: { full_name: "Simulation user" }, created_at: "2026-10-23T00:00:00Z", identities: [] });
const session = owner => ({ access_token: `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: owner, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.c3ludGhldGlj`, refresh_token: `synthetic-${owner}`, token_type: "bearer", expires_in: 3600, user: user(owner) });
const ownerOf = req => { try { return JSON.parse(Buffer.from(req.headers.authorization.replace("Bearer ", "").split(".")[1], "base64url")).sub; } catch { return null; } };
let mode = "safe", delay = 0, requests = [], catalog = "normal";
const stamp = ms => new Date(ms + 7 * 3600000).toISOString().replace("Z", "+07:00");
const send = (res, data, status = 200) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
function result(plan, selectedMode) {
  const r = structuredClone(sample), road = Date.parse(`${plan.departure_date}T${plan.departure_time}:00+07:00`), eta = road + 30 * 60000;
  const buffer = plan.schedule_id === id(2) ? 60 : selectedMode === "missed" ? -5 : selectedMode === "risky" ? 0 : selectedMode === "fraction" ? -.001 : 30;
  const occurrence = (uuid, cutoff) => ({ ...r.selected_schedule, schedule_id: uuid, occurrence_id: `${uuid}@${plan.service_date}`, terminal: plan.terminal, destination: plan.ferry_destination, service_date: plan.service_date, allowed_service_kinds: [plan.service_kind], departure_at: stamp(cutoff + 30 * 60000), cutoff_at: stamp(cutoff), source_departure_at: stamp(cutoff + 30 * 60000), source_cutoff_at: stamp(cutoff), verified_at: stamp(road - 60 * 60000) });
  Object.assign(r, { plan, planned_departure_at: stamp(road).replace(".000", ""), selected_schedule: occurrence(plan.schedule_id || id(1), eta + buffer * 60000), travel_time_min: 30, estimated_arrival_at: stamp(eta), buffer_min: buffer, latest_departure_estimate_at: stamp(road + (buffer - 15) * 60000), status: buffer < 0 ? "MISSED" : buffer < 15 ? "RISKY" : "SAFE", calculated_at: stamp(road), disclaimer: "Synthetic UI simulation only; these are not real sailings or observed traffic." });
  r.reason_code = { SAFE: "BUFFER_SUFFICIENT", RISKY: "BELOW_SAFETY_BUFFER", MISSED: "CUTOFF_MISSED" }[r.status]; r.reason = `Synthetic scenario: signed buffer ${buffer} min, simulation threshold 15 min.`;
  Object.assign(r.route_estimate, { estimated_arrival_at: r.estimated_arrival_at }); Object.assign(r.selection, { mode: plan.schedule_id ? "selected" : "automatic", service_date: plan.service_date, examined_count: 2 });
  r.alternatives = [{ schedule: occurrence(plan.schedule_id === id(2) ? id(3) : id(2), eta + 60 * 60000), status: "SAFE", reason_code: "BUFFER_SUFFICIENT", reason: "Synthetic alternative: 60-minute buffer.", estimated_arrival_at: stamp(eta), travel_time_min: 30, buffer_min: 60, latest_departure_estimate_at: stamp(road + 45 * 60000) }];
  if (["unavailable", "empty", "stale", "fallback", "truncated"].includes(selectedMode)) {
    Object.assign(r, { status: "UNAVAILABLE", reason_code: { unavailable: "MISSING_CUTOFF", empty: "NO_SCHEDULES", stale: "STALE_SCHEDULE", fallback: "ROUTE_FALLBACK", truncated: "CANDIDATE_LIMIT" }[selectedMode], reason: { unavailable: "Recorded cutoff is not verified.", empty: "No recorded schedules match this lookup.", stale: "Schedule verification is older than the allowed age.", fallback: "Only a fallback route estimate is available.", truncated: "Candidate limit reached; comparison is incomplete." }[selectedMode], data_status: "unavailable", travel_time_min: null, estimated_arrival_at: null, buffer_min: null, latest_departure_estimate_at: null, alternatives: [] });
    if (selectedMode === "unavailable") { r.selected_schedule.cutoff_at = null; r.selected_schedule.source_cutoff_at = null; }
    if (selectedMode === "empty" && !plan.schedule_id) { r.selected_schedule = null; r.selection.examined_count = 0; }
    if (selectedMode === "stale") r.selected_schedule.verified_at = stamp(road - 1441 * 60000);
    if (selectedMode === "unavailable") r.sources.cutoff = null;
    if (selectedMode === "fallback") { r.route_estimate.routing_source = "Haversine fallback"; r.sources.route = "Haversine fallback"; }
    if (selectedMode === "truncated") r.selection.truncated = true;
  }
  if (selectedMode === "malformed") r.buffer_min = "30";
  return r;
}
const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); res.setHeader("Access-Control-Allow-Headers", "authorization,content-type,apikey,x-client-info,x-supabase-api-version"); res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  let body = {}; try { const chunks = []; for await (const part of req) chunks.push(part); if (chunks.length) body = JSON.parse(Buffer.concat(chunks).toString()); } catch { send(res, {}, 422); return; }
  const path = new URL(req.url, base).pathname, owner = ownerOf(req);
  if (path === "/__control") { if (body.mode) mode = body.mode; if (typeof body.delay === "number") delay = Math.max(0, Math.min(5000, body.delay)); if (body.catalog) catalog = body.catalog; send(res, { mode, delay, catalog }); return; }
  if (path === "/__stats") { send(res, { requests, mode, delay, simulation: true }); return; }
  if (path === "/auth/v1/token") { send(res, session(body.email?.startsWith("b@") || body.refresh_token?.endsWith(id(102)) ? id(102) : id(101))); return; }
  if (path === "/auth/v1/user") { send(res, owner ? user(owner) : {}, owner ? 200 : 401); return; }
  if (path === "/auth/v1/logout") { res.writeHead(204); res.end(); return; }
  if (path.startsWith("/rest/v1/")) { send(res, []); return; }
  if (path === "/schedules") {
    if (catalog === "failure") { send(res, {}, 503); return; }
    send(res, { schedules: catalog === "empty" ? [] : [1, 2].map(n => ({ id: id(n), terminal: "batu_ampar", terminal_id: "TM001", destination: "Fixture Singapore", departure_time: "09:30:00", cutoff_time: n === 1 ? "09:00:00" : null, source: "synthetic_fixture" })) }); return;
  }
  if (path === "/departure-recommendation") {
    requests.push({ path, body, owner }); const captured = mode; await new Promise(resolve => setTimeout(resolve, delay));
    if (!owner || captured === "expired") { send(res, { detail: "Invalid or expired authentication credentials" }, 401); return; }
    if (captured === "outage") { send(res, { detail: { code: "DEPENDENCY_TIMEOUT", message: "Synthetic timeout", fields: [] } }, 503); return; }
    if (captured === "validation") { send(res, { detail: [{ loc: ["body", "service_date"], msg: "Synthetic invalid date", type: "value_error" }] }, 422); return; }
    if (captured === "mismatch") { send(res, { detail: { code: "SCHEDULE_MISMATCH", message: "Synthetic mismatch", fields: ["schedule_id", "terminal"] } }, 422); return; }
    if (captured === "missing") { send(res, { detail: { code: "SCHEDULE_NOT_FOUND", message: "Synthetic absent target", fields: ["schedule_id"] } }, 404); return; }
    if (body.service_date !== body.departure_date || body.departure_time > "21:00") { send(res, { detail: { code: "SCHEDULE_MISMATCH", message: "Fixture supports same-date daytime only", fields: ["service_date"] } }, 422); return; }
    send(res, result(body, captured)); return;
  }
  send(res, {}, 404);
});
server.listen(port, "127.0.0.1", () => console.log(`Synthetic departure fixture: ${base}; login a@departure.example.invalid / synthetic-password; modes via POST /__control. No real sailings.`));
