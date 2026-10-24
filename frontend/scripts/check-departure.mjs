// Offline synthetic contract, HTTP and actual-hook checks; no live sailings.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
async function compile(path, deps = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { fileName: path, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function("require", "exports", code)(name => { assert.ok(name in deps, name); return deps[name]; }, exports);
  return exports;
}
const c = await compile("../src/lib/departure-contract.ts");
const api = await compile("../src/lib/departure-api.ts", { "./departure-contract": c });
const locations = JSON.parse(await readFile(new URL("../../backend/data/batam-locations.json", import.meta.url)));
const f = await compile("../src/lib/departure-form.ts", { "./locations": { batamLocations: locations }, "./departure-contract": c });
const examples = JSON.parse(await readFile(new URL("../../docs/departure/contracts/DEPARTURE_API_EXAMPLES.json", import.meta.url))).examples;
const safe = examples.find(e => e.id === "selected-safe").response;
const checks = [];
const check = async (name, run) => { await run(); checks.push(name); console.log(`PASS ${name}`); };
for (const e of examples.filter(e => e.http_status === 200)) await check(`Frozen synthetic example ${e.id}`, () => assert.deepEqual(c.parseDeparture(e.response), e.response));
const reject = patch => assert.throws(() => c.parseDeparture({ ...structuredClone(safe), ...patch }));
await check("Strict fields, status, nulls, array bounds and numeric types", () => {
  for (const patch of [{ extra: 1 }, { status: "GOOD" }, { safety_buffer_min: 0 }, { safety_buffer_min: false }, { buffer_min: "30" }, { travel_time_min: NaN }, { travel_time_min: 1441 }, { alternatives: null }, { assumptions: Array(21).fill("test") }, { sources: { ...safe.sources, secret: "x" } }]) reject(patch);
  const r = structuredClone(safe); delete r.disclaimer; assert.throws(() => c.parseDeparture(r));
});
await check("Real dates, aware zones, source-zone conversions and occurrence identity", () => {
  for (const patch of [{ calculated_at: "2026-02-30T10:00:00+07:00" }, { calculated_at: "2026-10-23T10:00:00" }, { calculated_at: "2026-10-23T10:00:00Z" }, { selected_schedule: { ...safe.selected_schedule, occurrence_id: "different" } }, { selected_schedule: { ...safe.selected_schedule, source_timezone: "Asia/Singapore" } }, { selected_schedule: { ...safe.selected_schedule, verified_at: "2099-01-01T10:00:00+07:00" } }]) reject(patch);
  const r = structuredClone(safe); Object.assign(r.selected_schedule, { source_timezone: "Asia/Singapore", source_departure_at: "2026-10-23T10:30:00+08:00", source_cutoff_at: "2026-10-23T10:00:00+08:00" }); assert.equal(c.parseDeparture(r).status, "SAFE");
});
function withBuffer(buffer) {
  const r = structuredClone(safe), cutoff = Date.parse(r.selected_schedule.cutoff_at), duration = (cutoff - Date.parse(r.planned_departure_at)) / 60000 - buffer;
  const stamp = ms => new Date(ms + 7 * 3600000).toISOString().replace("Z", "+07:00");
  Object.assign(r, { travel_time_min: duration, buffer_min: buffer, estimated_arrival_at: stamp(cutoff - buffer * 60000), latest_departure_estimate_at: stamp(cutoff - (duration + 15) * 60000), status: buffer < 0 ? "MISSED" : buffer < 15 ? "RISKY" : "SAFE" });
  r.reason_code = { MISSED: "CUTOFF_MISSED", RISKY: "BELOW_SAFETY_BUFFER", SAFE: "BUFFER_SUFFICIENT" }[r.status];
  Object.assign(r.route_estimate, { final_time_min: duration, estimated_arrival_at: r.estimated_arrival_at }); return r;
}
await check("Zero, negative and unrounded threshold decisions survive display", () => {
  for (const buffer of [0, -.001, -5, 14.999, 15]) assert.equal(c.parseDeparture(withBuffer(buffer)).buffer_min, buffer);
  assert.match(f.signedBuffer(0), /^\+0.00/); assert.match(f.signedBuffer(-.001), /less than 0.01 min late/); assert.match(f.signedBuffer(-5), /−5.00/);
  assert.throws(() => c.parseDeparture({ ...withBuffer(14.999), status: "SAFE", reason_code: "BUFFER_SUFFICIENT" }));
});
await check("Missing data cannot retain decisions; fallback cannot establish SAFE", () => {
  const r = examples.find(e => e.response?.status === "UNAVAILABLE").response;
  assert.throws(() => c.parseDeparture({ ...r, buffer_min: 0 })); assert.throws(() => c.parseDeparture({ ...r, estimated_arrival_at: safe.estimated_arrival_at }));
  reject({ route_estimate: { ...safe.route_estimate, context_verified: false } }); reject({ selected_schedule: null }); reject({ selected_schedule: { ...safe.selected_schedule, cutoff_at: null } });
});
await check("Candidate bounds, exclusions, binding, alternative cap and truncation", () => {
  for (const selection of [{ ...safe.selection, examined_count: 102 }, { ...safe.selection, excluded_count: 2 }, { ...safe.selection, mode: "automatic" }, { ...safe.selection, service_date: "2026-10-24" }]) reject({ selection });
  reject({ selected_schedule: { ...safe.selected_schedule, terminal: "sekupang" } });
  const auto = examples.find(e => e.response?.selection?.mode === "automatic" && e.response?.status === "SAFE").response;
  assert.throws(() => c.parseDeparture({ ...auto, selection: { ...auto.selection, truncated: true } }));
  if (auto.alternatives.length) assert.throws(() => c.parseDeparture({ ...auto, alternatives: Array(4).fill(auto.alternatives[0]) }));
});
const validForm = { origin: "Batamindo", terminal: "batu_ampar", ferry_destination: "Fixture Singapore", service_kind: "cargo", departure_date: "2026-10-23", departure_time: "08:00", service_date: "2026-10-23", schedule_id: "" };
await check("Form validates origins, coordinates, dates, service, UUID and midnight copy", () => {
  assert.equal(f.departureInput(validForm).origin.lat, safe.plan.origin.lat);
  for (const patch of [{ origin: ",104" }, { origin: "Unknown" }, { origin: "9,104" }, { service_kind: "" }, { departure_date: "2026-02-30" }, { service_date: "2026-10-25" }, { departure_time: "8:00" }, { schedule_id: "clock" }, { terminal: "harbour_bay" }]) assert.throws(() => f.departureInput({ ...validForm, ...patch }), f.DepartureValidationError);
  assert.equal(f.departureInput({ ...validForm, departure_date: "2026-10-24", service_date: "2026-10-25" }).day_type, "weekend");
  assert.deepEqual(f.roadTimeFromEstimate("2026-10-22T23:59:00+07:00"), { departure_date: "2026-10-22", departure_time: "23:59" });
});
await check("Catalog keeps UUID/cutoff/terminal and unverified dates; rejects conflicting joins", () => {
  const row = { id: safe.plan.schedule_id, terminal: "batu_ampar", terminal_id: "TM001", destination: "Fixture Singapore", cutoff_time: "09:00", departure_time: "09:30" };
  const parsed = c.parseRecordedSailings({ schedules: [row] })[0]; assert.equal(parsed.id, row.id); assert.equal(parsed.cutoff, "09:00"); assert.equal(parsed.serviceDate, null); assert.equal(parsed.zone, null);
  assert.equal(c.parseRecordedSailings({ schedules: [{ ...row, terminal_id: "TM003" }, { ...row, id: "clock" }] }).length, 0);
});
const auth = owner => ({ getSession: async () => ({ data: { session: owner ? { access_token: "synthetic-token", user: { id: owner } } : null }, error: null }) });
await check("Client sends current bearer, validated plan and cancellation signal", async () => {
  const controller = new AbortController();
  const client = api.createDepartureApi("a", auth("a"), "http://synthetic.invalid", async (url, o) => {
    assert.equal(url, "http://synthetic.invalid/departure-recommendation"); assert.equal(o.headers.Authorization, "Bearer synthetic-token"); assert.equal(o.signal, controller.signal); assert.deepEqual(JSON.parse(o.body), safe.plan); return Response.json(safe);
  });
  assert.equal((await client.calculate(safe.plan, controller.signal)).status, "SAFE");
});
await check("Three error envelopes have safe bounded messages and fields", () => {
  assert.equal(api.parseDepartureError(401, { detail: "Invalid or expired authentication credentials" }).status, 401);
  assert.match(api.parseDepartureError(503, { detail: "Authentication service is temporarily unavailable" }).message, /authentication service/);
  assert.deepEqual(api.parseDepartureError(422, { detail: [{ loc: ["body", "service_date"], msg: "wrong", type: "value_error" }] }).fields, ["service_date"]);
  assert.match(api.parseDepartureError(404, { detail: { code: "SCHEDULE_NOT_FOUND", message: "missing", fields: ["schedule_id"] } }).message, /not found/);
  assert.match(api.parseDepartureError(422, { detail: { code: "SERVICE_MISMATCH", message: "mismatch", fields: ["service_kind"] } }).message, /does not permit/);
  for (const status of [422, 503]) assert.doesNotMatch(api.parseDepartureError(status, { detail: "SQL private" }).message, /SQL/);
});
await check("Outages, oversized/malformed responses and mismatched plans fail closed", async () => {
  for (const response of [() => Response.json({ detail: "SQL private" }, { status: 503 }), () => new Response("invalid"), () => new Response("x".repeat(65537)), () => Response.json({ ...safe, buffer_min: "30" }), () => Response.json({ ...safe, plan: { ...safe.plan, origin_name: "another" } })]) await assert.rejects(api.createDepartureApi("a", auth("a"), "", async () => response()).calculate(safe.plan, new AbortController().signal));
});
await check("Logout/account changes and pre-aborted I/O cannot yield a result", async () => {
  for (const owner of [null, "b"]) await assert.rejects(api.createDepartureApi("a", auth(owner), "", async () => { throw new Error("must not fetch"); }).calculate(safe.plan, new AbortController().signal), /session expired/);
  let account = "a";
  await assert.rejects(api.createDepartureApi("a", { getSession: async () => auth(account).getSession() }, "", async () => { account = "b"; return Response.json(safe); }).calculate(safe.plan, new AbortController().signal), /session expired/);
  const controller = new AbortController(); controller.abort(); await assert.rejects(api.createDepartureApi("a", auth("a"), "", async () => Response.json(safe)).calculate(safe.plan, controller.signal), /abort/i);
});
await check("Actual hook discards delayed responses after edits, stop, newer requests and unmount", async () => {
  let slots = [], cursor = 0, effects = [], output, pending = [];
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial }; },
    useCallback(fn) { cursor++; return fn; },
    useEffect(fn) { const i = cursor++; if (!(i in slots)) { slots[i] = true; effects.push(fn); } },
  };
  const fakeApi = { ...api, createDepartureApi: () => ({ calculate: input => new Promise((resolve, reject) => pending.push({ input, resolve, reject })) }) };
  const hook = await compile("../src/hooks/use-departure-recommendation.ts", { react, "@/utils/supabase/client": { createClient: () => ({ auth: {} }) }, "@/lib/departure-api": fakeApi, "@/lib/departure-form": f });
  const originalWindow = globalThis.window, originalDocument = globalThis.document;
  globalThis.window = { setTimeout, clearTimeout }; globalThis.document = { getElementById: () => ({ focus() {} }) };
  const render = () => { cursor = 0; output = hook.useDepartureRecommendation("a"); return output; };
  try {
    render(); const cleanup = effects.map(fn => fn());
    for (const [k, v] of Object.entries(validForm)) { output.update(k, v); render(); }
    const old = output.calculate(); render(); assert.equal(output.loading, true); output.update("departure_time", "09:00"); render(); pending.shift().resolve(safe); await old; render(); assert.equal(output.result, null);
    const stopped = output.calculate(); render(); output.stop(); render(); pending.shift().resolve(safe); await stopped; render(); assert.equal(output.result, null); assert.match(output.notice, /stopped/);
    const earlier = output.calculate(), newer = output.calculate(); const one = pending.shift(), two = pending.shift(); two.resolve({ ...safe, reason: "new response" }); await newer; render(); assert.equal(output.result.reason, "new response"); one.resolve(safe); await earlier; render(); assert.equal(output.result.reason, "new response");
    output.useRoadTime("2026-10-22T23:59:00+07:00"); render(); assert.equal(output.result, null); assert.equal(output.form.departure_date, "2026-10-22"); assert.equal(output.form.departure_time, "23:59"); assert.equal(pending.length, 0);
    for (const [k, v] of Object.entries(validForm)) { output.update(k, v); render(); }
    const alternative = output.calculate("00000000-0000-4000-8000-000000000002"); render(); assert.equal(pending[0].input.departure_time, "08:00"); assert.equal(pending[0].input.schedule_id.endsWith("0002"), true); pending.shift().resolve(safe); await alternative;
    const failed = output.calculate(); render(); pending.shift().reject(new api.DepartureApiError(503, "Synthetic outage")); await failed; render(); assert.equal(output.result, null); assert.equal(output.loading, false);
    const validation = output.calculate(); render(); pending.shift().reject(new api.DepartureApiError(422, "Synthetic mismatch", ["schedule_id", "terminal"])); await validation; render(); assert.deepEqual(Object.keys(output.fields), ["terminal", "schedule_id"]);
    const expired = output.calculate(); render(); pending.shift().reject(new api.DepartureApiError(401, "Session expired")); await expired; render(); assert.equal(output.expired, true); assert.equal(output.form.ferry_destination, ""); assert.equal(output.result, null);
    for (const [k, v] of Object.entries(validForm)) { output.update(k, v); render(); }
    const unmounted = output.calculate(); render(); cleanup.forEach(fn => fn?.()); pending.shift().resolve(safe); await unmounted; render(); assert.equal(output.result, null);
    slots = []; effects = []; render(); assert.equal(output.form.ferry_destination, ""); assert.equal(output.result, null);
  } finally { globalThis.window = originalWindow; globalThis.document = originalDocument; }
});
await check("Result renders all status wording, signed values, sources and separate unavailable estimate", async () => {
  const primitive = tag => function Primitive(props) { return React.createElement(tag, props, props.children); };
  const ui = await compile("../src/components/departure/DepartureResult.tsx", { react: React, "react/jsx-runtime": jsx, "@/components/ui/button": { Button: primitive("button") }, "@/components/ui/card": { Card: primitive("div") }, "@/lib/departure-form": f });
  const render = result => renderToStaticMarkup(React.createElement(ui.DepartureResult, { result, onUseRoadTime() {}, choose() {}, revise() {} }));
  for (const [buffer, word] of [[30, "SAFE"], [0, "RISKY"], [-.001, "MISSED"]]) {
    const html = render(c.parseDeparture(withBuffer(buffer))); assert.match(html, new RegExp(word)); assert.ok(html.includes(f.signedBuffer(buffer))); assert.ok(html.includes("Recorded cutoff")); assert.ok(html.includes("Sources, verification and limitations")); assert.ok(html.includes("Use this road time")); assert.ok(html.includes("synthetic_fixture"));
  }
  const unavailable = examples.find(e => e.response?.status === "UNAVAILABLE").response;
  const html = render(c.parseDeparture(unavailable)); assert.ok(html.includes("UNAVAILABLE")); assert.ok(html.includes("Route-only estimate")); assert.ok(!html.includes("Choose and recalculate")); assert.ok(!html.includes("Use this road time"));
  const auto = examples.find(e => e.response?.selection?.mode === "automatic" && e.response?.status === "SAFE").response; assert.ok(render(c.parseDeparture(auto)).includes("Choose and recalculate"));
});
await check("Form reading order, labeled controls and linked field errors render", async () => {
  const primitive = tag => function Primitive(props) { return React.createElement(tag, props, props.children); };
  const ui = await compile("../src/components/departure/DepartureForm.tsx", { react: React, "react/jsx-runtime": jsx, "@/components/ui/input": { Input: primitive("input") }, "@/components/ui/button": { Button: primitive("button") }, "@/lib/locations": { batamLocations: locations }, "@/lib/departure-api": api, "@/utils/supabase/client": { createClient() {} }, "@/lib/departure-contract": c });
  const html = renderToStaticMarkup(React.createElement(ui.DepartureForm, { form: validForm, fields: { origin: "Choose a supported origin" }, loading: false, expired: false, account: "synthetic", update() {}, calculate() {}, stop() {} }));
  const controls = [...html.matchAll(/<(?:input|select)[^>]*id="dep-([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(controls, ["origin", "terminal", "ferry_destination", "service_kind", "departure_date", "departure_time", "service_date", "schedule_id"]);
  assert.ok(html.includes('href="#dep-origin"')); assert.ok(html.includes('aria-invalid="true"')); assert.ok(html.includes('id="dep-origin-error"')); assert.ok(html.includes("WIB")); assert.ok(!html.includes("00000000-0000-4000"));
});
await check("Shared navigation/protection contain exactly one departure entry each", async () => {
  for (const path of ["../src/components/layout/Sidebar.tsx", "../src/utils/supabase/middleware.ts"]) assert.equal(((await readFile(new URL(path, import.meta.url), "utf8")).match(/["']\/departure["']/g) || []).length, 1);
});
console.log(JSON.stringify({ checks_passed: checks.length, checks, scope: "Offline synthetic parser/client/form, actual-hook dispatcher and component SSR with primitive stubs; no browser/live acceptance" }));
