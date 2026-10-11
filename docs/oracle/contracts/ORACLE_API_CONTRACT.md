# Oracle history and persistent chat contract — Sprints 1–4

Updated: 10 October 2026. Python definitions: `backend/schemas/oracle.py`.

The conversation endpoints and authenticated persistent chat below are implemented. The Oracle caller now sends its session token and request ID together. SSE retains `status`, `chunk`, `error`, and `done`, with typed `metadata` and `result` events. Backend checks are recorded in the [Sprint 3 report](../sprints/SPRINT_3_IMPLEMENTATION.md), and history UI checks in the [Sprint 4 report](../sprints/SPRINT_4_IMPLEMENTATION.md). The [Gemini provider migration](../providers/GEMINI_PROVIDER_MIGRATION.md) uses the official native SDK; live direct-answer/tool/follow-up checks passed with an in-memory turn store. Real signed-in browser/HTTP persistence remains unverified.

## Identity and errors

Every new history/chat request requires `Authorization: Bearer <Supabase access token>`. The backend remotely verifies it, forwards the same verified token to PostgREST using a request-owned client, and derives ownership from the returned user ID. Request bodies do not accept `user_id`.

| HTTP status | Meaning |
| --- | --- |
| 401 | Missing, malformed, invalid, or expired credentials; `WWW-Authenticate: Bearer`. |
| 503 | Auth/network service unavailable or invalid upstream response; `Retry-After: 5`. |
| 404 | Owned conversation not found, including foreign IDs; do not disclose another user's existence. |
| 422 | Request validation failure (UUID, length, unsupported field/value). |
| 409 | Request ID conflicts with saved content/conversation, a turn is already active, a conversation is archived, or archive races an active turn. |

Authentication, request validation, ownership lookup, and initial persistence occur before the SSE response opens. Runtime stream errors use safe `error` content and a terminal failed/interrupted outcome rather than claiming success.

## Conversation API (Sprint 2)

```text
POST  /user/conversations
GET   /user/conversations
GET   /user/conversations/{conversation_id}
GET   /user/conversations/{conversation_id}/messages
PATCH /user/conversations/{conversation_id}
```

POST returns HTTP 201. Create body: `{ "title": "Batu Ampar trip" }`; title is optional, nullable, trimmed, and limited to 160 characters. Update accepts only `title` and/or `archived`; an explicit `title: null` resets the title, and an omitted field leaves it unchanged. Empty updates are rejected. Archive with `{ "archived": true }`; restore with `{ "archived": false }`. No DELETE alias or hard-delete API is exposed.

Conversation response:

```json
{
  "id": "00000000-0000-4000-8000-000000000011",
  "title": "Batu Ampar trip",
  "created_at": "2026-10-05T00:00:00Z",
  "updated_at": "2026-10-05T00:00:00Z",
  "archived_at": null
}
```

Conversation lists return `{ "conversations": [], "next_cursor": null }`; message lists return `{ "messages": [], "next_cursor": null }`. Implemented pages accept `limit` (default 30, minimum 1, maximum 100) and a validated opaque `cursor` (maximum 512 characters). Conversations sort by `(updated_at DESC, id DESC)`. Messages sort by the server-generated `sequence` ascending; gaps are allowed and identical timestamps do not cause ambiguous ordering. Lists request one extra row to detect a next page without counting every record.

Conversation lists exclude archived items by default; `include_archived=true` includes active and archived items. Owned archived conversations and their messages remain directly readable. The existing database policies prevent appending/editing messages while archived. Title editing and restore remain available. Listing cursors are bound to the archive filter, and message cursors to their conversation. They contain only typed ordering fields and resource context, not user IDs or credentials. Cursors do not authorize access: every query still uses the verified user filter and RLS. Paging is not a frozen snapshot; refresh the list after edits that change update-time ordering.

Example sequence (all calls require the Bearer header):

```text
POST /user/conversations                 body: {"title":"Batu Ampar trip"}
GET  /user/conversations?limit=30
GET  /user/conversations/{id}
GET  /user/conversations/{id}/messages?limit=30
PATCH /user/conversations/{id}           body: {"title":"Updated trip"}
PATCH /user/conversations/{id}           body: {"archived":true}
GET  /user/conversations?include_archived=true
PATCH /user/conversations/{id}           body: {"archived":false}
```

Pass `next_cursor` back as a URL-encoded query parameter with the same filter/resource. It is null on the final page. Foreign/nonexistent IDs both return `{ "detail": "Conversation not found" }` with HTTP 404. Database/network/malformed stored-contract errors return safe 503 and `Retry-After: 5`, independently of Auth verification failures.

Message responses contain server UUIDs, `conversation_id`, `turn_id`, `sequence`, `role`, `content`, tool fields, `tool_calls`, `structured_results`, `status`, and `created_at`. Do not expose user IDs, system instructions, or raw credentials. User text and structured results are still untrusted display data and must be safely rendered.

`GET /user/history` retains its route-history contract. The separately approved legacy RLS fix added `route_query_log.user_id` and owner-read access; chat storage does not use that table. No route-history writer or AI-provider invocation is added by Sprint 2.

## Persistent chat (Sprint 3)

Implemented `POST /agent/chat` request:

```json
{
  "message": "Estimate SEG001 congestion for weekday 08:00",
  "conversation_id": "00000000-0000-4000-8000-000000000011",
  "client_request_id": "00000000-0000-4000-8000-000000000031"
}
```

`conversation_id` may be omitted for a new chat. `message` is trimmed, nonempty text with a maximum of 8,000 characters. `client_request_id` is a UUID created once per submitted user turn and reused for retries. The new contract deliberately rejects arbitrary identity fields.

Atomic reservation looks up `(authenticated user, client_request_id)` before creating another conversation. Completed, failed, and interrupted retries replay the saved terminal outcome with the same IDs and no provider/tool rerun. A fresh execution after a saved failure needs a **new** request ID. A live in-progress retry or another active turn in that conversation returns 409 with `Retry-After: 5`; there is no automatic provider retry. Different content or a supplied conflicting conversation also returns 409. For uncertainty caused by a lost connection, retry the original ID/content rather than creating a second turn.

After three minutes, a later reservation can retire a stale in-progress turn as interrupted. Retrying its original ID replays that interrupted state; a new ID can begin a fresh turn. Late writes to a retired turn fail. This is lazy recovery, not a background worker. Archived conversations reject new turns; terminal replay remains readable. PATCH archive returns 409 while a recent turn is active, preventing archive from blocking its final save under RLS.

Each turn starts with a user message whose `id = turn_id`, plus one assistant placeholder. Tool messages reference that owned user turn. Composite foreign keys enforce both conversation ownership and turn membership. Final assistant metadata holds allowed tool calls, validated arguments/outputs, and all successful structured results. Persisted roles are `user`, `assistant`, and `tool`; the server system prompt is not accepted from the client.

SSE frames use `data: <JSON>\n\n`:

```text
metadata  → conversation_id, turn_id, user_message_id, assistant_message_id
status    → content
chunk     → content (streamed assistant text)
result    → results (array of validated structured results)
error     → content (safe diagnostic)
done      → conversation_id, turn_id, message_id, outcome, persisted
```

`outcome` is `completed`, `failed`, or `interrupted`. A completed terminal event requires `persisted: true` and an assistant `message_id`. A partial streamed response is provisional until that success acknowledgment. A failed save must never produce a completed acknowledgment. Failed/interrupted outcomes may acknowledge saved failure state with `persisted: true` without suggesting that the answer completed.

HTTP failures before reservation/context success return normal JSON errors. Once SSE opens, missing provider configuration, provider exceptions, truncation, empty final answers, malformed tools, or persistence failures produce safe `error` and failed `done` events. A save failure can have `persisted: false` and no message ID. Cancellation makes a bounded best-effort interrupted save; a disconnected client may receive no terminal event. Live success is emitted only after the terminal RPC acknowledgment. Normal results are emitted after that save; replay may return stored partial results alongside a failed/interrupted outcome.

Gemini SDK HTTP 429 produces a rate/quota-limit message; 401/403 identifies
server credentials/model access, 404 identifies unavailable model configuration,
and 5xx identifies a temporary provider outage. A turn deadline produces a
timeout message. Other errors retain the generic safe diagnostic. Messages keep
the provisional-text warning and never include raw provider diagnostics.
Provider 401/403 within SSE does not mean the user's Supabase token is invalid.
Server logs record only exception type and provider HTTP status. The public
event shape and failed-turn replay contract are unchanged.

The caller keeps React messages provisional until the terminal event, validates IDs, buffers fragmented/batched UTF-8/CRLF frames, rejects invalid completion acknowledgments, guards concurrent sends, and clears scoped state on account change. New conversation starts a fresh local view without deleting saved history. History list/reopening and archive/restore are implemented in Sprint 4; validated result cards and detail dialogs are implemented in Sprint 5.

## Implemented history interface (Sprint 4)

The client lists 30 conversations per API page, with optional archived items and explicit load-more/reload controls. Selection is a single UUID in `?conversation=<uuid>`; invalid/duplicate values are removed and valid uppercase UUIDs are canonicalized. Browser back/forward and refresh reload the owned conversation and messages. The URL contains no token, owner ID, or message text and does not authorize access.

Stored messages load 100 rows per API page in ascending sequence. Tool rows are retained in the received contract but not rendered as chat bubbles; assistant result metadata is restored without rerunning tools. More saved pages are explicit, and new follow-up sends wait until all pages are loaded. Completed, failed, interrupted, active, and uncertain local outcomes remain distinct. No title-edit or hard-delete UI is introduced.

The API helper obtains the current session for each request, checks that it still belongs to the mounted account, and lets the backend verify the token. After HTTP 401 it refreshes once and repeats the same request; chat keeps its UUID/body unchanged during that auth retry. The backend rejects 401 before mutation/provider work. There is no automatic retry after network/5xx failure. History/update requests have a 30-second browser deadline; chat keeps its 120-second deadline.

Selecting a different chat aborts pending reads/streams/updates, clears visible old messages, and ignores results from older view generations. Uncertain retry state is cached only in memory per conversation in the mounted signed-in page; the latest unassigned request can be checked separately if metadata was lost. A terminal replay clears the earlier active state and permits a follow-up. Logout/account change clears that cache. Full refresh does not persist/replay pending request bodies: it reloads server state and offers explicit reload for a recent active turn, with the existing three-minute stale recovery rule.

Archive/restore uses the existing PATCH endpoint. Archived history remains readable and its composer is disabled until restored. Archive is disabled during local active/uncertain work, while the database guard handles concurrent active turns. Successful list/archive updates are refreshed from the API. Native buttons/labels and responsive history/message panes provide the existing shared UI styling.

## Implemented result interface (Sprint 5)

Both the SSE `result` event and stored `structured_results` use one client
validator. Each item needs known type/status, nonempty bounded metadata, object
data, and its typed required fields. Numbers must be finite and meet the variant
bounds. Clock times are `HH:MM[:SS]`; optional timestamps need valid calendar
dates, times, and an explicit ISO timezone. Null optional fields remain absent.
Known variants retain only their supported fields. One invalid/unsupported item
adds an unavailable count; it does not hide the answer or other valid results.
Rejected raw payloads are excluded from display state. Invalid outer arrays or
more than 12 items remain transport errors.

Rendering is bounded to 16,000 serialized UTF-8 bytes per result, 100 schedule
rows, and six JSON nesting levels/1,000 nodes for generic data. This is a client
display boundary; the existing schedule tool returns at most 20 rows. Generic
data is escaped plain JSON. Source text, titles, and disclaimers never become
HTML or executable links.

Completed, failed, and interrupted saved outcomes can display multiple preview
cards and independent detail dialogs. Failed/interrupted dialogs warn that the
turn is incomplete. Provisional, active, or unconfirmed outcomes offer no detail
trigger. The installed Base UI Dialog provides accessible names/descriptions,
focus containment/return, keyboard opening, Escape, backdrop dismissal, and
close buttons. Long tables scroll within a viewport-bounded mobile dialog.
Conversation/account lifecycle continues to remove old result state.

Cards/modal read restored metadata and perform no fetch/provider/tool call.
Source/status and limitations are displayed, with explicit unknown freshness
when observation time is absent. Supplied absolute timestamps display in WIB;
schedule/route clock times do not imply a source timezone or service date.
Optional emissions, capacity, departure, and gate-in fields display only when
provided; numeric zero is preserved. No independent departure variant exists.
See [Sprint 5 implementation and verification](../sprints/SPRINT_5_IMPLEMENTATION.md).

## Implemented limits and storage

- Context: at most 120 recent completed rows, reconstructed as up to eight complete user/assistant/tool pairs within 24,000 serialized characters. Failed/incomplete pairs are skipped; a pair is never clipped in half.
- Provider: official `google-genai` SDK/Gemini Developer API, backend `GEMINI_API_KEY` and optional `GEMINI_MODEL` (default `gemini-3.5-flash`), 20-second SDK timeout, one attempt with zero SDK retries, at most 2,048 output tokens per round, 90-second generation/lifecycle budget, and 32,000 accumulated answer characters. Native parts/signatures are limited to 256,000 UTF-8 bytes per turn. Current-turn native signatures are preserved; older completed tool history is untrusted reference text. See the [provider migration](../providers/GEMINI_PROVIDER_MIGRATION.md).
- Tools: three executed rounds, 12 calls per turn, 8,000-byte JSON arguments, 16,000-byte outputs, 15-second per-tool deadline. Recorded schedule queries return at most 20 rows; map geometry is excluded from Oracle results.
- Database calls: 10-second client timeout; mutation functions have a five-second lock timeout. Disconnect cleanup uses a 12-second cancellation shield; a DB outage can leave a turn for three-minute lazy recovery. Timed-out read-only tool threads may continue until their underlying network timeout.
- Frontend: 120-second request deadline and 300,000-character SSE frame/pending-buffer limit; unknown saved outcomes offer a manual retry with the same request ID.

The additive `oracle_reserve_turn`, `oracle_record_tool`, and `oracle_finish_turn` RPCs use the caller JWT with RLS, `SECURITY INVOKER`, an empty search path, and authenticated-only execution. Reservation atomically creates the user/assistant pair; each tool row is appended before continuing the model; terminal text/tool metadata/results and both message outcomes commit together. RPCs serialize reservations/writes, and a unique tool-call index prevents repeated tool rows. No service-role credential is used.

Tool argument models in `backend/services/oracle_tools.py` generate provider schemas and validate execution: `SEG001`–`SEG006`, explicit weekday/weekend and hour 0–23, finite bounded coordinates, explicit `HH:MM`, supported terminal/destination, and paired vessel ETD/cargo type. Missing planning inputs belong in a clarification; Oracle does not invent coordinates or a host-clock departure time. The server prompt instructs scope/provenance behavior, but real model adherence remains an acceptance check.

## Structured results

### Congestion runtime provenance (Sprint 6)

The public `/congestion` endpoint keeps existing core fields and source values
`ml_model`, `database`, `fallback_default`, and adds `day_type`/`hour` consistently,
`data_status`, `disclaimer`, `observed_at=null`, and UTC `calculated_at`. Oracle
normalizes those into its existing congestion result and forwards the service
disclaimer. Synthetic model output is not observed/live traffic; recorded window
data has unknown freshness. No source name or route-service response field was
renamed.

Model package/feature/category/label/mapping errors fall back to validated recorded
windows. Empty/no-match data after a successful read may return the labelled
assumed LOW/1.0 default. Initial corridor DB failure, recorded DB failure,
malformed data or ambiguous matching windows return safe HTTP 503 and no Oracle
result card. Known valid segment absent is 404; invalid segment/day/hour is 400
before DB work, while a non-integer HTTP hour remains 422. See
[verified runtime/model methodology](../ml/CONGESTION_MODEL_VALIDATION.md).

Current local gates are in [Sprint 6](../sprints/SPRINT_6_IMPLEMENTATION.md).
Real signed-in persistence and current completed live provider answer remain
unverified; Google 429 is recorded separately from controlled failure fixtures.

Supported discriminators are `congestion`, `schedule`, `route`, and `generic`. A departure discriminator/tool is intentionally not registered without an established tested service contract.

Every result requires `type`, `title`, typed `data`, `source`, `data_status`, and `disclaimer`. `observed_at` and `calculated_at` are optional and distinguish actual source observation time from computation time. Database availability is not proof of source freshness.

```json
{
  "type": "congestion",
  "title": "Congestion estimate",
  "data": {
    "segment_id": "SEG001",
    "day_type": "weekday",
    "hour": 8,
    "congestion_level": "LOW",
    "multiplier": 1.07
  },
  "source": "ml_model",
  "data_status": "synthetic_estimate",
  "disclaimer": "Based on project data; not real-time traffic."
}
```

This is a contract example, not a new traffic measurement. Status values: `synthetic_estimate`, `database`, `estimated`, `default_fallback`, and `unknown`. Preserve actual source identifiers such as `ml_model`, `database`, `fallback_default`, and route routing sources; normalization happens at the Oracle boundary. Successful tool data, rather than assistant prose, determines results. A default or partial source must retain its limitations, and errors must not manufacture results.

Schedule data contains a bounded `schedules` array of terminal/destination/departure rows, with nullable cutoff/vessel/capacity fields. Route data contains distance, estimated duration, routing source, and optional congestion/emission/departure fields actually returned by the route owner. Finite/nonnegative numeric values, supported levels, planning-hour bounds, and clock formats are validated. The existing map/routing endpoint is unchanged.
