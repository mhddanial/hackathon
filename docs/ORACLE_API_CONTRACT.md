# Oracle history contract — Sprint 1

Date: 5 October 2026. Python definitions: `backend/schemas/oracle.py`.

This document defines the interfaces for Sprint 2 history endpoints and Sprint 3 persistent chat. Those endpoints/behaviors are not implemented by Sprint 1. The current chat endpoint still accepts `{ message }`; its caller and authentication requirements must be upgraded together during Sprint 3. Keep the existing `status`, `chunk`, `error`, and `done` event names.

## Identity and errors

Every new history/chat request requires `Authorization: Bearer <Supabase access token>`. The backend remotely verifies it, forwards the same verified token to PostgREST using a request-owned client, and derives ownership from the returned user ID. Request bodies do not accept `user_id`.

| HTTP status | Meaning |
| --- | --- |
| 401 | Missing, malformed, invalid, or expired credentials; `WWW-Authenticate: Bearer`. |
| 503 | Auth/network service unavailable or invalid upstream response; `Retry-After: 5`. |
| 404 | Owned conversation not found, including foreign IDs; do not disclose another user's existence. |
| 422 | Request validation failure (UUID, length, unsupported field/value). |
| 409 | Request ID conflicts with a different conversation or a turn is already in progress. |

Authentication, request validation, ownership lookup, and initial persistence occur before the SSE response opens. Runtime stream errors use safe `error` content and a terminal failed/interrupted outcome rather than claiming success.

## Conversation API (Sprint 2)

```text
POST  /user/conversations
GET   /user/conversations
GET   /user/conversations/{conversation_id}
GET   /user/conversations/{conversation_id}/messages
PATCH /user/conversations/{conversation_id}
```

Create body: `{ "title": "Batu Ampar trip" }`; title is optional, nullable, trimmed, and limited to 160 characters. Update accepts only `title` and/or `archived`; an explicit `title: null` resets the title, and an omitted field leaves it unchanged. Empty updates are rejected. Archiving uses `archived: true`; a DELETE alias, if added, must document archive semantics.

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

Conversation lists return `{ "conversations": [], "next_cursor": null }`; message lists return `{ "messages": [], "next_cursor": null }`. Sprint 2 must implement bounded pages (default 30, maximum 100) and opaque validated cursors. Conversations sort by `(updated_at DESC, id DESC)`. Messages sort by the server-generated `sequence` ascending; gaps are allowed and identical timestamps do not cause ambiguous ordering.

Message responses contain server UUIDs, `conversation_id`, `turn_id`, `sequence`, `role`, `content`, tool fields, `tool_calls`, `structured_results`, `status`, and `created_at`. Do not expose user IDs, system instructions, or raw credentials. User text and structured results are still untrusted display data and must be safely rendered.

`GET /user/history` retains its route-history contract. Its missing legacy ownership column is a known separate issue; chat storage does not use that table.

## Persistent chat (Sprint 3)

Target request:

```json
{
  "message": "Estimate SEG001 congestion for weekday 08:00",
  "conversation_id": "00000000-0000-4000-8000-000000000011",
  "client_request_id": "00000000-0000-4000-8000-000000000031"
}
```

`conversation_id` may be omitted for a new chat. `message` is trimmed, nonempty text with a maximum of 8,000 characters. `client_request_id` is a UUID created once per submitted user turn and reused for retries. The new contract deliberately rejects arbitrary identity fields.

Look up `(authenticated user, client_request_id)` before creating another conversation. The database enforces uniqueness across that user's conversations. A completed retry replays the saved outcome without rerunning tools; an in-progress retry conflicts safely; a failed/interrupted retry follows an explicit recovery path using the same turn identity. If the supplied conversation conflicts with the saved request, return 409. Implement this orchestration in Sprint 3; database uniqueness alone is not a complete retry implementation.

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

The minimal existing Oracle caller must send its token/request ID and handle terminal outcome when Sprint 3 changes the endpoint; do not wait until the Sprint 4 sidebar work to restore caller compatibility. Preserve buffered fragmented/batched SSE parsing.

## Structured results

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
