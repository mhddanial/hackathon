// Loopback-only synthetic Auth/API for browser verification. Never contacts Supabase/provider.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

const port = Number(process.env.ORACLE_FIXTURE_PORT || 9010);
const origin = `http://127.0.0.1:${port}`;
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owners = { a: id(1), b: id(2) };
const now = () => new Date().toISOString();
const user = owner => ({ id: owner, aud: "authenticated", role: "authenticated", email: `${owner === owners.a ? "a" : "b"}@sprint4.example.invalid`,
  app_metadata: { provider: "email", providers: ["email"] }, user_metadata: { full_name: owner === owners.a ? "Test A" : "Test B" }, created_at: now(), identities: [] });
const jwt = owner => `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: owner, aud: "authenticated", role: "authenticated", iss: `${origin}/auth/v1`, exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000) })).toString("base64url")}.c3ludGhldGlj`;
const session = owner => ({ access_token: jwt(owner), refresh_token: owner === owners.a ? "synthetic-refresh-a" : "synthetic-refresh-b", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: user(owner) });
function ownerOf(req) { try { const token = req.headers.authorization?.replace(/^Bearer /, ""); const owner = JSON.parse(Buffer.from(token.split(".")[1], "base64url")).sub; return Object.values(owners).includes(owner) ? owner : null; } catch { return null; } }
const conversations = new Map(), turns = new Map(), requests = [];
let sequence = 0, nextMode = "normal", nextResults, listFailure = false, emptyList = false, authFailures = 0, executions = 0;
function createConversation(owner, title, key = randomUUID(), archived = false) {
  const time = new Date(Date.now() - 60000).toISOString();
  const value = { id: key, title, created_at: time, updated_at: time, archived_at: archived ? time : null, owner, messages: [] };
  conversations.set(key, value); return value;
}
function reserve(conversation, content, requestId) {
  const turn = randomUUID(), assistant = randomUUID();
  const row = { id: turn, conversation_id: conversation.id, turn_id: turn, sequence: ++sequence, role: "user", content, status: "in_progress", structured_results: [], created_at: now() };
  const answer = { ...row, id: assistant, sequence: ++sequence, role: "assistant", content: null };
  conversation.messages.push(row, answer); conversation.updated_at = now();
  const value = { conversation, row, answer, requestId }; turns.set(`${conversation.owner}:${requestId}`, value); return value;
}
function finish(turn, status = "completed") {
  turn.row.status = status; turn.answer.status = status;
  turn.answer.content = status === "completed" ? `Saved answer: ${turn.row.content}` : "";
  turn.answer.structured_results = status === "completed" ? [{ type: "congestion", title: "Synthetic test estimate", source: "test_fixture", data_status: "synthetic_estimate", disclaimer: "Synthetic browser fixture", data: { segment_id: "SEG001", day_type: "weekday", hour: 8, congestion_level: "LOW", multiplier: 1.1 } }] : [];
  turn.conversation.updated_at = now();
}
const harbour = createConversation(owners.a, "Harbour planning", id(101)); finish(reserve(harbour, "Harbour question", "seed-harbour"));
const road = createConversation(owners.a, "Road estimates", id(102)); finish(reserve(road, "Road question", "seed-road"));
const archive = createConversation(owners.a, "Archived reference", id(103)); finish(reserve(archive, "Archived question", "seed-archive")); archive.archived_at = now();
const other = createConversation(owners.b, "User B notes", id(201)); finish(reserve(other, "B private question", "seed-b"));
const publicConversation = ({ id, title, created_at, updated_at, archived_at }) => ({ id, title, created_at, updated_at, archived_at });
const sendJson = (res, data, status = 200) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
const frame = (res, data) => { if (!res.destroyed) res.write(`data: ${JSON.stringify(data)}\r\n\r\n`); };
function metadata(turn) { return { type: "metadata", conversation_id: turn.conversation.id, turn_id: turn.row.id, user_message_id: turn.row.id, assistant_message_id: turn.answer.id }; }
function terminal(res, turn, persisted = true) {
  if (turn.answer.structured_results.length) frame(res, { type: "result", results: turn.answer.structured_results });
  frame(res, { type: "done", conversation_id: turn.conversation.id, turn_id: turn.row.id, message_id: persisted ? turn.answer.id : null, outcome: persisted ? turn.answer.status : "failed", persisted }); res.end();
}
const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); res.setHeader("Access-Control-Allow-Headers", "authorization,content-type,apikey,x-client-info,x-supabase-api-version"); res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  const url = new URL(req.url, origin); let body = {};
  try { const chunks = []; for await (const chunk of req) chunks.push(chunk); if (chunks.length) body = JSON.parse(Buffer.concat(chunks).toString()); } catch { sendJson(res, {}, 422); return; }
  const owner = ownerOf(req);
  if (url.pathname === "/__control" && req.method === "POST") {
    if (body.mode) nextMode = body.mode;
    if (Array.isArray(body.nextResults)) nextResults = body.nextResults;
    if (body.savedResults) {
      const conversation = conversations.get(body.savedResults.conversationId);
      if (!conversation) { sendJson(res, {}, 404); return; }
      const answer = conversation.messages.filter(row => row.role === "assistant").at(-1);
      answer.structured_results = body.savedResults.results;
      if (body.savedResults.status) for (const row of conversation.messages.filter(row => row.turn_id === answer.turn_id)) row.status = body.savedResults.status;
    }
    if (typeof body.listFailure === "boolean") listFailure = body.listFailure;
    if (typeof body.emptyList === "boolean") emptyList = body.emptyList;
    if (typeof body.authFailures === "number") authFailures = body.authFailures;
    if (body.finishActive) for (const turn of turns.values()) if (turn.answer.status === "in_progress") finish(turn, body.finishActive);
    sendJson(res, { ok: true }); return;
  }
  if (url.pathname === "/__stats") { sendJson(res, { executions, requests, conversations: [...conversations.values()].map(item => ({ id: item.id, owner: item.owner, message_count: item.messages.length })) }); return; }
  if (url.pathname === "/auth/v1/token") { sendJson(res, session(body.email?.startsWith("b@") || body.refresh_token === "synthetic-refresh-b" ? owners.b : owners.a)); return; }
  if (url.pathname === "/auth/v1/user") { sendJson(res, owner ? user(owner) : { message: "Invalid fixture session" }, owner ? 200 : 401); return; }
  if (url.pathname === "/auth/v1/logout") { res.writeHead(204); res.end(); return; }
  if (url.pathname.startsWith("/rest/v1/")) { sendJson(res, []); return; }
  if (!owner) { sendJson(res, {}, 401); return; }
  if (authFailures > 0) { authFailures--; sendJson(res, {}, 401); return; }
  requests.push({ path: url.pathname, method: req.method, owner, request_id: body.client_request_id ?? null, conversation_id: body.conversation_id ?? null });
  if (url.pathname === "/user/conversations") {
    if (listFailure) { sendJson(res, {}, 503); return; }
    const items = emptyList ? [] : [...conversations.values()].filter(item => item.owner === owner && (url.searchParams.get("include_archived") === "true" || !item.archived_at)).sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.id.localeCompare(a.id));
    const offset = Number(url.searchParams.get("cursor") || 0), limit = 2;
    sendJson(res, { conversations: items.slice(offset, offset + limit).map(publicConversation), next_cursor: offset + limit < items.length ? String(offset + limit) : null }); return;
  }
  const match = url.pathname.match(/^\/user\/conversations\/([^/]+)(\/messages)?$/);
  if (match) {
    const conversation = conversations.get(match[1]);
    if (!conversation || conversation.owner !== owner) { sendJson(res, {}, 404); return; }
    if (match[2]) {
      const offset = Number(url.searchParams.get("cursor") || 0), items = conversation.messages;
      sendJson(res, { messages: items.slice(offset, offset + 2), next_cursor: offset + 2 < items.length ? String(offset + 2) : null }); return;
    }
    if (req.method === "PATCH") conversation.archived_at = body.archived ? now() : null;
    sendJson(res, publicConversation(conversation)); return;
  }
  if (url.pathname === "/agent/chat") {
    let turn = turns.get(`${owner}:${body.client_request_id}`);
    const replay = !!turn;
    if (turn && turn.answer.status === "in_progress") { sendJson(res, {}, 409); return; }
    const mode = nextMode, results = nextResults; nextMode = "normal"; nextResults = undefined;
    if (!turn && mode === "conflict") { sendJson(res, {}, 409); return; }
    if (!turn) {
      const conversation = body.conversation_id ? conversations.get(body.conversation_id) : createConversation(owner, body.message.slice(0, 80));
      if (!conversation || conversation.owner !== owner) { sendJson(res, {}, 404); return; }
      if (conversation.archived_at) { sendJson(res, {}, 409); return; }
      turn = reserve(conversation, body.message, body.client_request_id); executions++;
    }
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
    frame(res, metadata(turn));
    if (replay) { frame(res, { type: "chunk", content: turn.answer.content }); terminal(res, turn); return; }
    if (mode === "failed") { finish(turn, "failed"); if (results) turn.answer.structured_results = results; frame(res, { type: "error", content: "Synthetic provider failure" }); terminal(res, turn); return; }
    if (mode === "slow") {
      frame(res, { type: "chunk", content: "Partial old-conversation response" });
      setTimeout(() => { if (turn.answer.status === "in_progress") finish(turn); frame(res, { type: "chunk", content: " LATE old-conversation response" }); terminal(res, turn); }, 2500); return;
    }
    if (mode === "save-failure") { if (results) turn.answer.structured_results = results; frame(res, { type: "chunk", content: "Provisional answer" }); terminal(res, turn, false); return; }
    finish(turn);
    if (results) turn.answer.structured_results = results;
    frame(res, { type: "chunk", content: turn.answer.content });
    if (mode === "drop") { res.end(); return; }
    terminal(res, turn); return;
  }
  sendJson(res, {}, 404);
});
await mkdir("output/playwright", { recursive: true });
for (const [name, owner] of Object.entries(owners)) {
  await writeFile(`output/playwright/oracle-sprint4-${name}.json`, JSON.stringify({ cookies: [{ name: "sb-127-auth-token", value: `base64-${Buffer.from(JSON.stringify(session(owner))).toString("base64url")}`, domain: "127.0.0.1", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" }], origins: [] }));
}
server.listen(port, "127.0.0.1", () => console.log(`Synthetic Oracle UI fixture listening on ${origin}`));
