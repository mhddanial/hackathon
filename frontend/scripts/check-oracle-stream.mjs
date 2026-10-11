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
const results = await compile("../src/lib/oracle-results.ts");
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
console.log("8 Oracle stream checks passed: fragmented/batched UTF-8+CRLF, invalid persistence/metadata/result/type/JSON, frame limit.");
