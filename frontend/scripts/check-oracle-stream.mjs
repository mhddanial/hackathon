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
const results = await compile("../src/lib/oracle-results.ts", { "./route-contract": await compile("../src/lib/route-contract.ts") });
const { consumeOracleStream } = await compile("../src/lib/oracle-stream.ts", { "./oracle-results": results });
const id = "00000000-0000-4000-8000-000000000001";
const events = [
  { type: "metadata", conversation_id: id, turn_id: id, user_message_id: id, assistant_message_id: id },
  { type: "chunk", content: "Estimate 🌏" },
  { type: "result", results: [] },
  { type: "done", conversation_id: id, turn_id: id, message_id: id, outcome: "completed", persisted: true },
];
const wire = events.map(event => `data: ${JSON.stringify(event)}\r\n\r\n`).join("");
const bytes = new TextEncoder().encode(wire);
function stream(chunks) {
  return new ReadableStream({ start(controller) { chunks.forEach(chunk => controller.enqueue(chunk)); controller.close(); } });
}
for (const chunks of [[bytes], Array.from(bytes, byte => Uint8Array.of(byte))]) {
  const received = [];
  await consumeOracleStream(stream(chunks), event => received.push(event));
  assert.deepEqual(received, events);
}
for (const event of [
  { type: "done", conversation_id: id, turn_id: id, outcome: "completed", persisted: false },
  { type: "metadata", conversation_id: "foreign input" },
  { type: "result", results: Array(13).fill({}) },
  { type: "unknown" },
]) {
  await assert.rejects(() => consumeOracleStream(stream([new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`)]), () => {}));
}
await assert.rejects(() => consumeOracleStream(stream([new TextEncoder().encode("data: {broken}\n\n")]), () => {}));
await assert.rejects(() => consumeOracleStream(stream([new TextEncoder().encode(`data: ${JSON.stringify({type:"chunk",content:"x".repeat(300001)})}\n\n`)]), () => {}));
async function promptly(promise) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("Stream waited for transport teardown")), 1000);
    })]);
  } finally { clearTimeout(timer); }
}

// A valid terminal event must finish even when neither EOF nor cancel resolves.
let cancelled = false;
const held = new ReadableStream({
  start(controller) { controller.enqueue(bytes); },
  cancel() { cancelled = true; return new Promise(() => {}); },
});
const received = [];
await promptly(consumeOracleStream(held, event => received.push(event)));
assert.deepEqual(received, events);
assert.ok(cancelled && !held.locked);

// Caller-side turn/ownership validation must still reject and release the reader.
const invalidTurn = new ReadableStream({
  start(controller) { controller.enqueue(bytes); },
  cancel() { return new Promise(() => {}); },
});
await assert.rejects(() => promptly(consumeOracleStream(invalidTurn, event => {
  if (event.type === "done") throw new Error("Mismatched saved outcome");
})), /Mismatched saved outcome/);
assert.equal(invalidTurn.locked, false);

for (const trailing of [
  `data: ${JSON.stringify({ type: "chunk", content: "Late data" })}\n\n`,
  `data: ${JSON.stringify(events.at(-1))}\n\n`,
  "data: {broken",
]) {
  await assert.rejects(() => consumeOracleStream(stream([new TextEncoder().encode(wire + trailing)]), () => {}));
}
const noSeparator = [];
await consumeOracleStream(stream([new TextEncoder().encode(wire.trimEnd())]), event => noSeparator.push(event));
assert.deepEqual(noSeparator, events);
console.log("14 Oracle stream checks passed: fragmented UTF-8/CRLF, validation and limits, terminal completion without EOF, bounded teardown, caller validation, trailing events, EOF framing.");
