import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import * as React from "react";

async function compile(path, dependencies = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function("require", "exports", code)(name => { assert.ok(name in dependencies, name); return dependencies[name]; }, exports);
  return exports;
}
const contract = await compile("../src/lib/route-contract.ts");
const draft = await compile("../src/lib/route-draft.ts", { "./route-contract": contract });
const api = await compile("../src/lib/route-api.ts", { "./route-contract": contract });
const locations = JSON.parse(await readFile(new URL("../../backend/data/batam-locations.json", import.meta.url)));
const planner = await compile("../src/hooks/use-route-planner.ts", { react: React, "@/lib/locations": { batamLocations: locations }, "@/lib/route-contract": contract, "@/lib/route-api": api, "@/lib/route-draft": draft });
const insights = await compile("../src/lib/route-insights.ts");
const input = { origin: { lat: 1.06048, lng: 104.030321 }, destination: { lat: 1.162951, lng: 104.002488 }, time: "10:00", day_type: "weekday" };
const route = { ...input, departure_time: "10:00", distance_km: 5, final_time_min: 15, routing_source: "OSRM API" };
const checks = [];
const check = async (name, run) => { await run(); checks.push(name); console.log(`PASS ${name}`); };
class Storage {
  map = new Map(); get length() { return this.map.size; } key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(key) { return this.map.get(key) ?? null; } setItem(key, value) { this.map.set(key, value); } removeItem(key) { this.map.delete(key); }
}
await check("historical route remains valid and zero slack survives", () => {
  assert.equal(contract.parseRoute(route).cutoff_slack_min, undefined);
  assert.equal(contract.parseRoute({ ...route, cutoff_slack_min: 0 }).cutoff_slack_min, 0);
  assert.equal(contract.parseRoute({ ...route, cutoff_slack_min: -5 }).cutoff_slack_min, -5);
  for (const value of [NaN, Infinity, "0", false]) assert.throws(() => contract.parseRoute({ ...route, cutoff_slack_min: value }));
});
await check("dates, clocks, cargo pairs and Batam bounds are validated", () => {
  assert.equal(contract.parseRouteInput(input).time, "10:00");
  for (const patch of [{ departure_date: "2024-02-30" }, { departure_date: "2024-01-06" }, { time: "25:00" }, { time: "10:00:00" }, { cargo_type: "CONTAINER" }, { vessel_etd: "18:00" }, { origin: { lat: -1, lng: 104 } }]) assert.throws(() => contract.parseRouteInput({ ...input, ...patch }));
  assert.equal(contract.parseRouteInput({ ...input, cargo_type: "FAST_FREIGHT", vessel_etd: "2024-01-01T12:00:00Z" }).vessel_etd, "2024-01-01T12:00:00Z");
  assert.throws(() => contract.parseRouteInput({ ...input, cargo_type: "FAST_FREIGHT", vessel_etd: "2024-01-05T22:00:00Z" }));
  assert.throws(() => contract.parseRouteInput({ ...input, cargo_type: "FAST_FREIGHT", vessel_etd: "18:00:00" }));
});
await check("names and aliases resolve without coordinate coercion", () => {
  assert.equal(planner.resolvePlannerLocation("Batamindo").name, "Batamindo Industrial Park");
  assert.throws(() => planner.resolvePlannerLocation("Terminal"));
  assert.throws(() => planner.resolvePlannerLocation(",104"));
  assert.throws(() => planner.resolvePlannerLocation("invalid,104"));
  assert.throws(() => planner.plannerInput({ origin: "-1,104", destination: "Batu Ampar Port", time: "10:00", dayType: "weekday", departureDate: "", vesselEtd: "", cargoType: "" }));
});
await check("handoff carries only validated inputs without mutating saved results", () => {
  const storage = new Storage(), original = structuredClone(route);
  const id = draft.saveRouteDraft(draft.routeInputFromResult(route), "a", storage, 1000);
  const copied = draft.loadRouteDraft(id, "a", storage, 2000);
  assert.equal(copied.time, "10:00"); assert.equal(copied.final_time_min, undefined);
  assert.deepEqual(route, original);
  assert.throws(() => draft.routeInputFromResult({ distance_km: 1, final_time_min: 1, routing_source: "old" }));
});
await check("draft expiry, cross-account reads and account cleanup are enforced", () => {
  const storage = new Storage(); let id = draft.saveRouteDraft(input, "a", storage, 1000);
  assert.throws(() => draft.loadRouteDraft(id, "b", storage, 1001));
  id = draft.saveRouteDraft(input, "a", storage, 1000);
  assert.throws(() => draft.loadRouteDraft(id, "a", storage, 1801000));
  assert.throws(() => draft.loadRouteDraft(id, "a", storage, 1801000), /invalid or expired/);
  draft.saveRouteDraft(input, "a", storage); draft.syncDraftAccount("b", storage);
  assert.equal([...storage.map.keys()].filter(k => k.startsWith("smartflow:route-draft:")).length, 0);
  draft.saveRouteDraft(input, "b", storage); draft.syncDraftAccount(null, storage);
  assert.equal(storage.length, 0);
});
await check("draft tampering, unknown IDs, unavailable storage and storage bound are covered", () => {
  const storage = new Storage(); const id = draft.saveRouteDraft(input, "a", storage, 1000);
  storage.setItem(`smartflow:route-draft:${id}`, JSON.stringify({ version: 1, account: "a", createdAt: 1000, input: { ...input, origin: { lat: 99, lng: 104 } } }));
  assert.throws(() => draft.loadRouteDraft(id, "a", storage, 1001));
  assert.throws(() => draft.loadRouteDraft("bad", "a", storage));
  assert.throws(() => draft.saveRouteDraft(input, "a", { getItem() { throw new Error("disabled"); } }));
  for (let n = 0; n < 20; n++) draft.saveRouteDraft(input, "a", storage);
  assert.equal([...storage.map.keys()].filter(k => k.startsWith("smartflow:route-draft:")).length, 10);
});
await check("API uses validated request, preserves fields and rejects errors or malformed responses", async () => {
  const original = globalThis.fetch;
  try {
    let sent, requestedUrl;
    globalThis.fetch = async (url, options) => { requestedUrl = url; sent = JSON.parse(options.body); return { ok: true, json: async () => route }; };
    assert.equal((await api.estimateRoute(input, new AbortController().signal)).distance_km, 5); assert.deepEqual(sent, input);
    assert.match(requestedUrl, /\/route$/);
    globalThis.fetch = async (url, options) => {
      requestedUrl = url; sent = JSON.parse(options.body);
      return { ok: true, json: async () => ({ ...route, route_options: [] }) };
    };
    assert.equal((await api.estimateRouteAlternatives(input, new AbortController().signal)).distance_km, 5);
    assert.match(requestedUrl, /\/route\/alternatives$/); assert.deepEqual(sent, input);
    const called = [];
    globalThis.fetch = async url => {
      called.push(url);
      return url.endsWith("/route/alternatives")
        ? { ok: false, status: 404, json: async () => ({}) }
        : { ok: true, json: async () => route };
    };
    const legacy = await api.estimateRouteAlternatives(input, new AbortController().signal);
    assert.deepEqual(called.map(url => url.slice(url.lastIndexOf("/route"))), ["/route/alternatives", "/route"]);
    assert.deepEqual(legacy.route_options, []);
    globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({ detail: "private diagnostic" }) });
    await assert.rejects(api.estimateRoute(input, new AbortController().signal), /temporarily unavailable/);
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ ...route, final_time_min: -1 }) });
    await assert.rejects(api.estimateRoute(input, new AbortController().signal));
  } finally { globalThis.fetch = original; }
});
await check("route alternatives validate independently and selection keeps geometry and metrics together", () => {
  const first = {
    route_id: "route-1", display_label: "Route 1", routing_source: "OSRM API",
    distance_km: 5, base_time_min: 10, final_time_min: 15, emission_kg: 1.5,
    congestion_status: "synthetic_estimate", congestion_level: "HIGH",
    congestion_multiplier: 1.5,
    route_geometry: { type: "LineString", coordinates: [[104, 1], [104.1, 1.1]] },
  };
  const second = {
    ...first, route_id: "route-2", display_label: "Route 2", distance_km: 7,
    base_time_min: 12, final_time_min: 14, emission_kg: 1.4,
    congestion_level: "LOW", congestion_multiplier: 1.17,
    route_geometry: { type: "LineString", coordinates: [[104, 1], [104.05, 1.04], [104.1, 1.1]] },
  };
  const parsed = contract.parseRouteAlternatives({
    ...first, default_route_id: "route-1", route_options: [first, second],
  });
  const selected = contract.selectRouteOption(parsed, "route-2");
  assert.equal(selected.distance_km, second.distance_km);
  assert.equal(selected.final_time_min, second.final_time_min);
  assert.deepEqual(selected.route_geometry, second.route_geometry);
  assert.equal(contract.selectRouteOption(parsed, "unknown").distance_km, first.distance_km);
  assert.equal(contract.parseRoute(route).route_options, undefined);
  assert.deepEqual(contract.parseRouteAlternatives(route).route_options, []);
  assert.throws(() => contract.parseRouteAlternatives({
    ...first, default_route_id: "route-3", route_options: [first, second],
  }));
});
await check("shared insights do not make incomplete results actionable", () => {
  assert.equal(insights.routeInsights({ ...route, departure_feasible: true }).status, "Within estimated cutoff");
  assert.equal(insights.routeInsights({ ...route, departure_feasible: false }).late, true);
  assert.equal(insights.routeInsights({ ...route, departure_feasible: true }, true).feasible, false);
});
console.log(JSON.stringify({ checks_passed: checks.length, checks, scope: "Pure helper and mocked HTTP checks; no live services" }));
