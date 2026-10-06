# Sprint 2 — Owned conversation API

Date: 6 October 2026 (Asia/Jakarta). Branch: `danial`.
Status: implemented locally and verified. No application deployment or Git push.
The separately approved legacy RLS migration is applied to Supabase; this sprint
requires no additional database migration.

## Delivered

- POST `/user/conversations` creates a conversation from a validated optional
  title and server-derived identity, returning 201.
- GET `/user/conversations` returns bounded active-history pages; optional
  `include_archived=true` includes archived items.
- GET `/user/conversations/{id}` and `/messages` read only owned records; foreign
  and missing UUIDs return the same 404.
- PATCH `/user/conversations/{id}` edits title and archives/restores. Archived
  conversations/messages stay readable; existing RLS blocks message writes until
  restored. No DELETE/hard-delete route is added.

`backend/services/oracle_history.py` owns queries, validated cursors, and safe
upstream errors. All database queries use the verified request client; reads and
edits have explicit owner filters alongside RLS. Responses select/allowlist the
public contract, excluding owner IDs and retry IDs. Conversation order is update
time plus UUID descending; message order is server sequence ascending. Each page
fetches at most `limit+1` rows (default 30, maximum 100). Cursor fields are typed,
bounded, and resource-specific; they carry no authorization capability. Ordering
can change between requests, so callers refresh lists after edits.

The existing `/user/history` remains a route-log API. Its ownership schema was
fixed by the approved legacy migration; this sprint does not write route logs.
Chat sending/turn persistence/retries are intentionally integrated together in
Sprint 3 rather than exposing a partial message-write endpoint now. The existing
agent remains unchanged and public until that integration; the UI is Sprint 4.

## Verification

**145 passed, 0 failures/errors/skips**, JUnit duration **10.210 seconds**.
This includes 36 new conversation API tests and the existing 109 checks.

The new tests run FastAPI endpoints through the real installed Supabase SDK,
with Auth/PostgREST HTTP supplied by a test transport. The transport translates
only the history query subset to a disposable local PostgreSQL database, where
the actual Oracle migration, triggers, ownership policies, and FKs execute.
This validates application queries together with RLS; it is not a real Supabase
JWT session or a production PostgREST/browser test.

Covered: A/B isolation for create/list/read/change/archive; identical foreign and
missing 404s; all five routes rejecting missing/expired tokens; client owner and
unsupported body rejection; title reset; archive/restore/read behavior; equal-time
conversation paging; sequence-based message paging; cursor validation/resource
and archive-filter binding; safe database/transport failures; persisted tool and
multiple structured-result reads without provider execution; response privacy.

Evidence: `docs/oracle/evidence/sprint-2/tests.xml`, `test-summary.json`, and `openapi.json`.
Full valid-user live HTTP/browser testing remains pending test sessions. No Auth
accounts or real conversations were created for testing, and no AI-provider
request was made. The isolated local server is stopped after verification.

## Next sprint

Sprint 3 integrates authenticated chat, reserves retry IDs, saves owned turns,
validates tools, persists answers/results/failure states, and extends SSE. Its
existing frontend caller must gain token/request-ID compatibility in that same
change. Sprint 4 then adds the full history interface.
