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
const stream = await compile("../src/lib/oracle-stream.ts", { "./oracle-results": results });
const { createOracleApi, OracleApiError } = await compile("../src/lib/oracle-api.ts", { "./oracle-stream": stream, "./oracle-results": results });
const { selectedConversation, mergeMessages, restoreMessages, hasRecentActiveTurn } = await compile("../src/lib/oracle-history.ts", { "./oracle-stream": stream });
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const user = id(1), convo = id(2), turn = id(3), assistant = id(4);
const now = new Date().toISOString();
const conversation = { id: convo, title: "Saved chat", created_at: now, updated_at: now, archived_at: null };
const row = { id: turn, conversation_id: convo, turn_id: turn, sequence: 1, role: "user", content: "Question", status: "completed", structured_results: [], created_at: now };
const answer = { ...row, id: assistant, sequence: 2, role: "assistant", content: "Saved answer", structured_results: [{ type: "route", title: "Saved route", source: "test_fixture", data_status: "estimated", disclaimer: "Test estimate", data: { distance_km: 2, final_time_min: 5, routing_source: "test_fixture" } }] };
const signal = () => new AbortController().signal;
const session = (token = "old-test-token", owner = user) => ({ data: { session: { access_token: token, user: { id: owner } } }, error: null });
const auth = { getSession: async () => session(), refreshSession: async () => session("new-test-token") };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const sse = () => new Response("", { headers: { "Content-Type": "text/event-stream" } });
let passed = 0;
async function check(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }

await check("current token, bounded list, encoded cursor, allowed response fields", async () => {
  let request;
  const api = createOracleApi(user, auth, "http://test", async (url, init) => { request = { url, init }; return json({ conversations: [{ ...conversation, user_id: "private-field" }], next_cursor: null }); });
  const page = await api.list(signal(), true, "abc+&=");
  assert.equal(new URL(request.url).searchParams.get("cursor"), "abc+&=");
  assert.equal(request.init.headers.Authorization, "Bearer old-test-token");
  assert.equal(page.conversations[0].user_id, undefined);
});
await check("401 refresh reuses exact chat request UUID/body", async () => {
  const requests = [];
  const api = createOracleApi(user, auth, "http://test", async (url, init) => { requests.push(init); return requests.length === 1 ? json({}, 401) : sse(); });
  await api.chat(" Question ", id(9), convo, signal());
  assert.equal(requests.length, 2); assert.equal(requests[0].body, requests[1].body);
  assert.equal(requests[1].headers.Authorization, "Bearer new-test-token");
});
await check("repeated 401 stops after one refresh", async () => {
  let calls = 0;
  const api = createOracleApi(user, auth, "http://test", async () => { calls++; return json({}, 401); });
  await assert.rejects(api.list(signal()), error => error.status === 401); assert.equal(calls, 2);
});
await check("refresh account mismatch stops before second fetch", async () => {
  let calls = 0;
  const api = createOracleApi(user, { ...auth, refreshSession: async () => session("new", id(10)) }, "http://test", async () => { calls++; return json({}, 401); });
  await assert.rejects(api.list(signal()), error => error.status === 401); assert.equal(calls, 1);
});
await check("missing/mismatched session never fetches", async () => {
  for (const data of [session("old", id(10)), { data: { session: null }, error: null }]) {
    const api = createOracleApi(user, { ...auth, getSession: async () => data }, "http://test", async () => { throw new Error("Must not fetch"); });
    await assert.rejects(api.list(signal()), error => error.status === 401);
  }
});
await check("aborted token lookup never sends", async () => {
  const controller = new AbortController();
  const api = createOracleApi(user, { ...auth, getSession: async () => { controller.abort(); return session(); } }, "http://test", async () => { throw new Error("Must not fetch"); });
  await assert.rejects(api.list(controller.signal), error => error.name === "AbortError");
});
await check("network and 503 never automatically retry", async () => {
  for (const mode of ["network", "503"]) {
    let calls = 0;
    const api = createOracleApi(user, auth, "http://test", async () => { calls++; if (mode === "network") throw new Error("raw-secret-detail"); return json({}, 503); });
    await assert.rejects(api.chat("Question", id(9), convo, signal()), error => error.status === 503 && !error.message.includes("secret"));
    assert.equal(calls, 1);
  }
});
await check("foreign conversation and conflict have controlled errors", async () => {
  for (const status of [404, 409, 422]) {
    const api = createOracleApi(user, auth, "http://test", async () => json({ detail: "raw-secret-detail" }, status));
    await assert.rejects(api.get(convo, signal()), error => error instanceof OracleApiError && error.status === status && !error.message.includes("secret"));
  }
});
await check("archive mutation and returned ownership ID", async () => {
  let body;
  const api = createOracleApi(user, auth, "http://test", async (_url, init) => { body = JSON.parse(init.body); assert.equal(init.method, "PATCH"); return json({ ...conversation, archived_at: now }); });
  assert.equal((await api.archive(convo, true, signal())).archived_at, now); assert.deepEqual(body, { archived: true });
});
await check("cross-conversation message data is rejected", async () => {
  const api = createOracleApi(user, auth, "http://test", async () => json({ messages: [{ ...row, conversation_id: id(10) }], next_cursor: null }));
  await assert.rejects(api.messages(convo, signal()), error => error.status === 503);
});
await check("malformed/oversized/unordered history is rejected", async () => {
  const invalidPages = [{ messages: [answer, row], next_cursor: null }, { messages: [row], next_cursor: 2 },
    { messages: [{ ...row, structured_results: Array(13).fill({}) }], next_cursor: null }, { messages: Array(101).fill(row), next_cursor: null }];
  for (const data of invalidPages) {
    const api = createOracleApi(user, auth, "http://test", async () => json(data));
    await assert.rejects(api.messages(convo, signal()), error => error.status === 503);
  }
});
await check("invalid IDs and non-SSE chat fail safely", async () => {
  const api = createOracleApi(user, auth, "http://test", async () => json({ reply: "Old transport" }));
  await assert.rejects(api.get("../foreign", signal()), error => error.status === 422);
  await assert.rejects(api.chat("Question", id(9), undefined, signal()), error => error.status === 503);
});
await check("message pages preserve stored status/results and deduplicate IDs", async () => {
  const api = createOracleApi(user, auth, "http://test", async () => json({ messages: [row, answer], next_cursor: "next" }));
  const page = await api.messages(convo, signal()); assert.deepEqual(page.messages[1].structured_results, answer.structured_results);
  assert.deepEqual(mergeMessages([row], [row, answer]).map(item => item.id), [turn, assistant]);
});
await check("URL selection accepts one UUID and rejects duplicates/injection", () => {
  assert.equal(selectedConversation(`?conversation=${convo}`), convo);
  for (const search of ["", "?conversation=javascript:alert(1)", `?conversation=${convo}&conversation=${id(10)}`, "?conversation=../foreign"]) assert.equal(selectedConversation(search), null);
});
await check("uppercase bookmark UUID is canonicalized", () => {
  const upper = "ABCDEFAB-ABCD-4ABC-8DEF-ABCDEFABCDEF";
  assert.equal(selectedConversation(`?conversation=${upper}`), upper.toLowerCase());
});
await check("coerced array role/status cannot masquerade as a typed message", async () => {
  for (const invalid of [{ ...row, role: ["user"] }, { ...row, status: ["completed"] }]) {
    const api = createOracleApi(user, auth, "http://test", async () => json({ messages: [invalid], next_cursor: null }));
    await assert.rejects(api.messages(convo, signal()), error => error.status === 503);
  }
});
const pending = { message: "Question", requestId: id(9), conversationId: convo, userMessageId: "local-user", agentMessageId: "local-assistant", userServerId: turn, assistantServerId: assistant };
await check("completed server outcome clears uncertain retry without duplicate bubbles", () => {
  const restored = restoreMessages([row, answer], pending); assert.equal(restored.pending, null);
  assert.deepEqual(restored.messages.map(item => item.id), ["local-user", "local-assistant"]);
  assert.deepEqual(restored.messages[1].results, answer.structured_results);
});
await check("failed and interrupted server outcomes remain visibly terminal", () => {
  for (const status of ["failed", "interrupted"]) {
    const restored = restoreMessages([row, { ...answer, status }], pending); assert.equal(restored.pending, null);
    assert.equal(restored.messages[1].outcome, status);
  }
});
await check("active/uncertain retry preserves UUID, provisional text and pairing", () => {
  const restored = restoreMessages([row, { ...answer, status: "in_progress", content: null }], pending,
    [{ id: "local-assistant", role: "agent", content: "Partial answer", outcome: "streaming" }]);
  assert.equal(restored.pending.requestId, id(9)); assert.equal(restored.messages[1].content, "Partial answer");
  const missing = restoreMessages([], pending); assert.equal(missing.messages.length, 2); assert.equal(missing.pending.requestId, id(9));
});
await check("tools are hidden, raw text remains text, active age has a stale boundary", () => {
  const tool = { ...row, id: id(7), sequence: 3, role: "tool", content: "raw tool data" };
  assert.equal(restoreMessages([row, answer, tool]).messages.length, 2);
  const malicious = { ...answer, content: "<script>untrusted</script>" };
  assert.equal(restoreMessages([malicious]).messages[0].content, malicious.content);
  const active = { ...answer, status: "in_progress" }; assert.equal(hasRecentActiveTurn([active], Date.parse(now) + 179999), true);
  assert.equal(hasRecentActiveTurn([active], Date.parse(now) + 180000), false);
});
console.log(`${passed} Oracle API/history checks passed.`);
