import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

async function compile(path, dependencies = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function("require", "exports", code)(name => { assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name]; }, exports);
  return exports;
}
const resultModule = await compile("../src/lib/oracle-results.ts");
const { parseResults } = resultModule;
const stream = await compile("../src/lib/oracle-stream.ts", { "./oracle-results": resultModule });
const { createOracleApi } = await compile("../src/lib/oracle-api.ts", { "./oracle-stream": stream, "./oracle-results": resultModule });
const { restoreMessages } = await compile("../src/lib/oracle-history.ts", { "./oracle-stream": stream });
const { roadName, segmentNames } = await compile("../src/lib/road-segments.ts");
const meta = { title: "Tool result", source: "test_fixture", data_status: "synthetic_estimate", disclaimer: "Synthetic test; no live data" };
const congestion = { ...meta, type: "congestion", data: { segment_id: "SEG001", day_type: "weekday", hour: 0, congestion_level: "LOW", multiplier: 1.1 } };
const schedule = { ...meta, type: "schedule", data: { schedules: [{ terminal: "A", destination: "B", departure_time: "00:00", cargo_capacity_tons: 0 }] } };
const route = { ...meta, type: "route", data: { distance_km: 0, final_time_min: 0, routing_source: "default", emission_kg: 0, latest_gate_in: "23:59:59" } };
const mappedRoute = { ...route, data: { ...route.data, routing_source: "OSRM API", origin: {lat:1.06,lng:104.03}, destination: {lat:1.16,lng:104},
  origin_name:"Batamindo Industrial Park", destination_name:"Batu Ampar Port",
  route_geometry:{type:"LineString",coordinates:[[104.03,1.06],[104,1.16]]}, departure_time:"10:00", departure_date:"2024-01-01",
  day_type:"weekday",planning_timezone:"Asia/Jakarta",cargo_type:"FAST_FREIGHT",vessel_etd:"2024-01-01T19:00:00+07:00",
  latest_gate_in_datetime:"2024-01-01T18:00:00+07:00",optimal_departure_datetime:"2024-01-01T17:30:00+07:00",
  departure_feasible:false,congestion_status:"unavailable",planning_warning:"Test cutoff warning" } };
const generic = { ...meta, type: "generic", data: { text: '<img src=x onerror="alert(1)">', values: [true, null, 1] } };
const valid = [congestion, schedule, route, generic];
const rejected = value => assert.deepEqual(parseResults([value]), { results: [], unavailable: 1 });
let count = 0;
async function check(name, fn) { await fn(); count++; console.log(`PASS ${name}`); }

await check("four validated variants and multiple results retain zero values", () => assert.deepEqual(parseResults(valid), { results: valid, unavailable: 0 }));
await check("saved map endpoints, geometry and dated planning metadata survive without coercion", () => {
  assert.deepEqual(parseResults([mappedRoute]).results[0], mappedRoute);
  for (const patch of [
    {origin:{lat:NaN,lng:104}}, {origin:{lat:91,lng:104}}, {destination:{lat:1,lng:true}},
    {route_geometry:{type:"Polygon",coordinates:[[104,1],[104,1.1]]}},
    {route_geometry:{type:"LineString",coordinates:[[104,1]]}},
    {route_geometry:{type:"LineString",coordinates:Array(161).fill([104,1])}},
    {route_geometry:{type:"LineString",coordinates:[[104,1],[104,"1.1"]]}},
    {route_geometry:{type:"LineString",coordinates:[[104,1],[104,1,0]]}},
    {departure_date:"2024-02-30"}, {vessel_etd:"2024-01-01T19:00:00"}, {planning_timezone:"UTC"},
    {departure_feasible:0}, {cargo_type:"truck"}, {congestion_status:"live"}, {departure_datetime:"2024-01-01T10:00:00"},
  ]) rejected({...mappedRoute,data:{...mappedRoute.data,...patch}});
  const value = parseResults([{...mappedRoute,data:{...mappedRoute.data,route_geometry:null,origin:null}}]).results[0];
  assert.equal(value.data.route_geometry,undefined); assert.equal(value.data.origin,undefined);
});
await check("road names survive validation and legacy IDs resolve without guessing unknown roads", async () => {
  const backendCatalog = await readFile(new URL("../../backend/road_segments.py", import.meta.url), "utf8");
  const catalog = Object.fromEntries([...backendCatalog.matchAll(/"(SEG00[1-6])": "([^"]+)"/g)].map(match => [match[1], match[2]]));
  assert.deepEqual(segmentNames, catalog);
  assert.equal(Object.keys(catalog).length, 6);
  for (const [segment_id, name] of Object.entries(catalog)) {
    const result = parseResults([{ ...congestion, data: { ...congestion.data, segment_id, segment_name: name } }]).results[0];
    assert.equal(result.data.segment_id, segment_id); assert.equal(result.data.segment_name, name);
    assert.equal(roadName(segment_id), name);
  }
  const result = parseResults([{ ...route, data: { ...route.data, matched_segment_id: "SEG002", matched_segment_name: "Updated Sudirman corridor" } }]).results[0];
  assert.equal(result.data.matched_segment_name, "Updated Sudirman corridor");
  assert.equal(roadName("SEG002", result.data.matched_segment_name), "Updated Sudirman corridor");
  assert.equal(roadName("UNKNOWN"), "UNKNOWN"); assert.equal(roadName("__proto__"), "__proto__");
  assert.equal(roadName(), undefined);
  for (const bad of ["", " ", 123, "x".repeat(257)]) {
    rejected({ ...congestion, data: { ...congestion.data, segment_name: bad } });
    rejected({ ...route, data: { ...route.data, matched_segment_name: bad } });
  }
  assert.equal(parseResults([{ ...congestion, data: { ...congestion.data, segment_name: null } }]).results[0].data.segment_name, undefined);
});
await check("one malformed item preserves the answer's other results", () => assert.deepEqual(parseResults([route, { type: "departure" }, congestion]), { results: [route, congestion], unavailable: 1 }));
await check("required metadata, object data and known variant/status are enforced", () => {
  for (const value of [null, [], 4, { ...route, title: " " }, { ...route, source: undefined }, { ...route, disclaimer: "" }, { ...route, data_status: "live" }, { ...route, type: "departure" }, { ...route, data: [] }]) rejected(value);
});
await check("all actual status labels are accepted without claiming live traffic", () => {
  for (const data_status of Object.keys(resultModule.resultStatusLabels)) assert.equal(parseResults([{ ...route, data_status }]).results[0].data_status, data_status);
});
await check("invalid congestion IDs, coerced values, hour/level and multiplier reject", () => {
  for (const data of [{ segment_id: "SEG007" }, { day_type: ["weekday"] }, { hour: "8" }, { hour: -1 }, { hour: 24 }, { hour: 1.5 }, { congestion_level: "LIVE" }, { multiplier: 0 }, { multiplier: Infinity }]) rejected({ ...congestion, data: { ...congestion.data, ...data } });
});
await check("schedule empty and optional nulls remain valid without fabricated fields", () => {
  assert.deepEqual(parseResults([{ ...schedule, data: { schedules: [] } }]).results[0].data.schedules, []);
  const value = parseResults([{ ...schedule, data: { schedules: [{ terminal: "A", destination: "B", departure_time: "12:34:56", cutoff_time: null, vessel_type: null, cargo_capacity_tons: null }] } }]).results[0];
  assert.deepEqual(value.data.schedules[0], { terminal: "A", destination: "B", departure_time: "12:34:56" });
});
await check("schedule malformed row/clock/negative capacity and row limit reject", () => {
  for (const row of [null, {}, { ...schedule.data.schedules[0], departure_time: "24:00" }, { ...schedule.data.schedules[0], cutoff_time: "12:60" }, { ...schedule.data.schedules[0], cargo_capacity_tons: -1 }]) rejected({ ...schedule, data: { schedules: [row] } });
  rejected({ ...schedule, data: { schedules: Array(101).fill(schedule.data.schedules[0]) } });
});
await check("route missing, negative, nonfinite and clock values reject", () => {
  for (const data of [{ final_time_min: undefined }, { distance_km: -1 }, { final_time_min: NaN }, { emission_kg: "0" }, { base_time_min: -1 }, { congestion_multiplier: 0 }, { routing_source: "" }, { optimal_departure: "25:00" }]) rejected({ ...route, data: { ...route.data, ...data } });
});
await check("route unknown keys dropped; optional null fields are absent", () => {
  const value = parseResults([{ ...route, ignored: "private", data: { ...route.data, emission_kg: null, capacity: 100, optimal_departure: null } }]).results[0];
  assert.equal(value.ignored, undefined); assert.equal(value.data.capacity, undefined); assert.equal(value.data.emission_kg, undefined); assert.equal(value.data.optimal_departure, undefined);
});
await check("valid timezone timestamps and leap day retained; null times omitted", () => {
  for (const observed_at of ["2024-02-29T01:02:03Z", "2026-10-10T01:02:03.123456+07:00"]) assert.equal(parseResults([{ ...route, observed_at }]).results[0].observed_at, observed_at);
  assert.equal(parseResults([{ ...route, observed_at: null }]).results[0].observed_at, undefined);
});
await check("impossible dates, invalid clock/timezone and date-only timestamps reject", () => {
  for (const observed_at of ["2026-02-29T01:02:03Z", "2026-04-31T01:02:03Z", "2026-10-10", "2026-10-10T24:00:00Z", "2026-10-10T01:02:03", "2026-10-10T01:02:03+24:00"]) rejected({ ...route, observed_at });
});
await check("metadata length and UTF-8 rendering budget are bounded", () => {
  rejected({ ...route, title: "x".repeat(161) }); rejected({ ...route, disclaimer: "x".repeat(2001) });
  rejected({ ...generic, data: { text: "🌏".repeat(4000) } });
});
await check("generic rejects nested non-JSON, excessive depth/nodes, and circular data", () => {
  for (const data of [{ x: NaN }, { x: new Date() }, { x: undefined }, { x: 1n }, { x: Array(1001).fill(0) }, { a: { b: { c: { d: { e: { f: { g: 1 } } } } } } }]) rejected({ ...generic, data });
  const data = {}; data.self = data; rejected({ ...generic, data });
});
await check("untrusted generic HTML and special object keys are plain data", () => {
  assert.equal(parseResults([generic]).results[0].data.text, generic.data.text);
  const value = parseResults([{ ...generic, data: JSON.parse('{"__proto__":{"polluted":true}}') }]).results[0];
  assert.equal({}.polluted, undefined); assert.equal(Object.hasOwn(value.data, "__proto__"), true);
});
await check("empty collection accepted; invalid outer collection/count rejected", () => {
  assert.deepEqual(parseResults([]), { results: [], unavailable: 0 });
  for (const value of [null, {}, Array(13).fill(route)]) assert.throws(() => parseResults(value));
});
await check("history and SSE apply identical per-item validation and restore counts", async () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const items = [{ ...route, data: { ...route.data, matched_segment_name: "Jl. Jendral Sudirman" } },
    { ...congestion, data: { ...congestion.data, segment_name: "Jl. Yos Sudarso (Koridor Utama)" } }, mappedRoute, { ...congestion, data: {} }, generic];
  const row = { id, conversation_id: id, turn_id: id, sequence: 1, role: "assistant", content: "Saved answer remains readable", status: "failed", structured_results: items, created_at: new Date().toISOString() };
  const auth = { getSession: async () => ({ data: { session: { access_token: "test", user: { id } } }, error: null }) };
  const api = createOracleApi(id, auth, "http://test", async () => new Response(JSON.stringify({ messages: [row], next_cursor: null })));
  const saved = (await api.messages(id, new AbortController().signal)).messages[0];
  const events = [];
  await stream.consumeOracleStream(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: "result", results: items })}\n\n`)); c.close(); } }), event => events.push(event));
  assert.deepEqual(events[0].results, saved.structured_results); assert.equal(saved.unavailable_results, 1); assert.equal(events[0].unavailable_results, 1);
  assert.equal(saved.structured_results[0].data.matched_segment_name, "Jl. Jendral Sudirman");
  assert.equal(saved.structured_results[1].data.segment_name, "Jl. Yos Sudarso (Koridor Utama)");
  assert.deepEqual(saved.structured_results[2].data.route_geometry, mappedRoute.data.route_geometry);
  const display = restoreMessages([saved]).messages[0]; assert.equal(display.content, row.content); assert.equal(display.outcome, "failed"); assert.equal(display.unavailableResults, 1);
});
console.log(`${count} Oracle result contract checks passed.`);
