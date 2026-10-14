# Oracle current implementation context

Updated: 14 October 2026 (Asia/Jakarta). Working branch: `danial`.
This file is the starting context for continued Oracle implementation. Dated
reports and evidence retain the detailed history.

## Goal and ownership

An authenticated user can ask the Logistic Oracle a logistics question, receive
streamed assistance and validated structured results, and reopen their own saved
conversations after refresh or a later login.

Danial owns Oracle orchestration/history/results, congestion/ML integration, and
their tests/evidence. Route, departure, and ferry-schedule business logic remains
with its respective owners; Oracle consumes those contracts. The original
16-hour hackathon plan is background, not a deadline for this extension.

## Implemented

| Work | Current result | Record |
| --- | --- | --- |
| Sprint 0 | Source audit and executable baseline | [Audit](../sprints/SPRINT_0_AUDIT.md) |
| Sprint 1 | Conversation/message schema, owned RLS, typed contracts, verified request-scoped JWT client | [Report](../sprints/SPRINT_1_IMPLEMENTATION.md) |
| Legacy RLS repair | Applied to Supabase; public reference reads, privileged writes, private route history | [Security record](../security/LEGACY_RLS_FIX.md) |
| Sprint 2 | Five authenticated conversation operations, bounded pagination, title edits, archive/restore, ordered message reads | [Report](../sprints/SPRINT_2_IMPLEMENTATION.md) |
| Sprint 3 | Authenticated streaming, atomic turn reservation, bounded context/tools, saved outcomes/results, stable retry IDs | [Report](../sprints/SPRINT_3_IMPLEMENTATION.md) |
| Sprint 4 | Saved conversation list/reopening, URL selection, paginated messages, archive/restore, isolated streams/retries | [Report](../sprints/SPRINT_4_IMPLEMENTATION.md) |
| Sprint 5 | Per-result runtime validation, multiple preview cards, accessible details, source/limitations, and saved-result restoration | [Report](../sprints/SPRINT_5_IMPLEMENTATION.md) |
| Sprint 6 | Safe congestion/artifact validation, actual-tool persistence tests, final automated gates and verified model methodology; live acceptance partial | [Report](../sprints/SPRINT_6_IMPLEMENTATION.md) |
| Provider migration | Official `google-genai` SDK, native Gemini streaming/tools, compatible saved history | [Record](../providers/GEMINI_PROVIDER_MIGRATION.md) |
| Delete chat | Confirmed permanent deletion, owner filtering/RLS, message cascade, and active-turn guard applied to Supabase | [Record](../security/CHAT_DELETION.md) |
| Named routes and map results | Shared Batam location resolution, date-aware vessel cutoffs, bounded saved geometry, and Planner map reused in Oracle dialogs | [Record](../providers/NAMED_ROUTES_AND_MAPS.md) |

Implemented conversation routes:

```text
POST  /user/conversations
GET   /user/conversations
GET   /user/conversations/{id}
PATCH /user/conversations/{id}
DELETE /user/conversations/{id}
GET   /user/conversations/{id}/messages
POST  /agent/chat
```

Ownership comes from server-verified Supabase identity. Request bodies cannot
assign `user_id`; queries include an owner filter and use the verified user's
JWT. Foreign/missing conversations share 404. Archive keeps history readable
and allows restore. DELETE permanently removes a chat and its messages after UI
confirmation; recent active turns are protected. `/user/history` remains
the separate route-log API. See the [contract](../contracts/ORACLE_API_CONTRACT.md).

Applied migration files remain in `supabase/migrations/`:

- `20261005135325_oracle_history.sql`
- `20261006140252_legacy_table_rls.sql`
- `20261010105115_oracle_turn_lifecycle.sql`
- `20261013145929_oracle_conversation_delete_guard.sql`

All seven current public tables have RLS enabled; both Oracle tables and the four
repaired legacy tables force it. `profiles` retains its existing policies. The
import script requires a separate server-only `SUPABASE_SERVICE_ROLE_KEY`; this
credential is optional for normal application reads and must stay out of the
frontend. No real import credential was provisioned during the fix.

## Current AI provider

Oracle now calls the Gemini Developer API directly with `google-genai==2.29.0`.
Set backend-only `GEMINI_API_KEY`; optional `GEMINI_MODEL` defaults to
`gemini-3.5-flash`. The existing local Gemini key is used. Lightning/OpenAI
credentials are no longer read by Oracle, and no automatic provider fallback is
used. Native model parts/signatures stay within the active turn. Completed tool
history becomes untrusted reference text, so old saved turns do not need
fabricated Gemini signatures or a database migration. SSE and public contracts
are unchanged. See the [provider record](../providers/GEMINI_PROVIDER_MIGRATION.md).

The current local `GEMINI_MODEL` override selects `gemini-3.6-flash`; the code
default above remains unchanged. On 11 October, attempted live turns did not
complete. A follow-up direct SDK diagnostic confirmed HTTP 429
`RESOURCE_EXHAUSTED`: the selected model's free-tier daily request quota is 20,
with a reported retry delay of 71,431 seconds at the time of the check. Further
live calls were stopped. Oracle now distinguishes safe quota/access/model/outage
and timeout messages while keeping failed-turn persistence and replay behavior.
No key/model/billing change was made. See the
[quota diagnosis](../providers/GEMINI_QUOTA_INCIDENT_20261011.md) and the earlier
[Sprint 6 evidence](../evidence/sprint-6/README.md).

## Congestion model and provenance

The endpoint retains `ml_model`, `database`, and `fallback_default` source names.
It now validates artifact keys/features/order/classes/mappings, categories and
recorded windows. Model errors fall back to valid recorded data; unavailable
DB data or malformed/ambiguous windows return safe HTTP 503. Only successful
empty/no-match reads return the existing assumed LOW/1.0 default, explicitly
labelled `default_fallback`. All successful paths include planning day/hour,
status/disclaimer and calculation time, with `observed_at=null`.

The current six segments/25 windows reproduce 14,400 synthetic rows and
95.0694% random-row test accuracy. All 2,880 test input patterns occur in training;
this is not evidence of real-traffic generalization. Artifact/notebook remain
unchanged. Use the [verified methodology](../ml/CONGESTION_MODEL_VALIDATION.md)
and [report evidence map](../reports/REPORT_EVIDENCE_MAP.md), rather than treating
historical pitch figures as independent validation. Route-owner emission/default
logic remains separate and estimated.

## Verification and limits

- Provider migration checks: **195 existing backend tests** passed again with
  native Gemini fixtures and actual disposable PostgreSQL lifecycle/RLS using
  simulated claims. **19 additional native Google SDK wire/lifecycle tests**
  passed; total **214**. Two expected serializer warnings come from intentionally
  malformed test arguments. No live RLS/schema change was made.
- Live Google API checks passed: streamed direct answer, native ferry tool
  request/response with public Supabase reference data, and follow-up using saved
  reference context without refetching. These checks used an in-memory turn
  store; they do not prove signed-in HTTP/browser history persistence.
- Sprint 3 installed RPC lifecycle: **11 live database checks passed**, with all
  synthetic rows rolled back. Existing policies/grants were preserved. This is
  database role/claim evidence, not a valid-user HTTP login.
- Sprint 4 frontend: **20 API/history checks**, **8 stream checks**, and **19
  Chromium browser checks** passed. Browser checks used real Next/Supabase SDK
  code with local synthetic Auth/API services, including two simulated accounts.
  TypeScript, targeted lint, and production build passed. Desktop/mobile
  screenshots were inspected; no new dependencies or migration were added.
- Earlier local smoke checks on ports 3000/8000 passed health/public reference
  reads and anonymous Oracle redirects. FastAPI is now stopped at the user's
  request. All future local FastAPI starts must use port **8080**; frontend
  defaults and local environment now target it. The frontend remains on 3000.
  These earlier checks are separate from signed-in history/provider acceptance.
- Sprint 5 frontend: **16 result contract checks**, **20 API/history checks**,
  **8 stream checks**, and **35 Chromium checks** passed (16 result scenarios and
  19 history regressions). TypeScript, targeted lint, production build, and
  desktop/mobile screenshot review passed. Browser Auth/API data was synthetic;
  this sprint did not invoke Gemini or change the database.
- Sprint 6: **282 backend tests** passed with zero skips and real disposable
  PostgreSQL; **44 frontend helper checks** and **35 synthetic Chromium checks**
  passed again. TypeScript, targeted lint, build and artifact/whitespace checks
  passed. **21 installed live role/claim checks** passed and rolled back all test
  rows; counts were preserved. Current-code local health/public congestion/read
  and anonymous auth smoke passed. This is separate from real JWT acceptance.
- Quota-error follow-up: **27 native SDK/provider tests**, **8 stream checks**,
  and TypeScript passed without starting FastAPI or a database. Provider failure
  messages and logs exclude raw diagnostics; partial answers remain failed.
- Live legacy repair: **46 policy checks** and **16 anonymous REST checks** passed;
  counts, existing policies, and privileged grants were preserved.
- Application changes are local; no application deployment or Git push was made.
- Real valid-user Supabase JWT/browser persistence remains unverified. Live
  provider checks, synthetic browser tests, and database role/claim probes are
  separate evidence.
- Existing Auth password-protection and profile/performance advisor findings are
  recorded in the security report; global advisor cleanliness is not claimed.

## Next: finish Sprint 6 live acceptance

`/agent/chat` now requires a verified token and a stable `client_request_id`.
It atomically reserves owned user/assistant messages before provider work, loads
bounded complete prior turns, and saves tool rows and terminal state. Completed
SSE acknowledgment follows a successful save; retries replay terminal outcomes
without repeating provider/tool work. Active turns conflict with HTTP 409, and
turns older than three minutes can be retired as interrupted on a later request.
Archiving an active conversation also returns 409.

The Oracle interface now lists saved conversations, reopens owned messages,
and restores the selected UUID from `?conversation=<uuid>` after refresh.
Lists/messages load bounded pages; follow-up sends wait until the latest saved
message page is loaded. Archive preserves readable history and restore allows
new turns. New conversation starts a blank view and creates server history on
the next send. The authenticated helper can refresh a token once after HTTP 401;
network/5xx failures require manual retry with the existing request UUID.

Switching aborts old work and guards late responses with a view generation.
Pending retry IDs survive switching within the mounted signed-in page. Account
change/logout clears them; a full page reload restores server history rather
than automatically resending an uncertain turn. Structured results now pass the
same per-item runtime validation for SSE and history. Congestion, schedule,
route, and generic cards open a reusable Base UI dialog with keyboard/focus
handling, source/status, limitations, and supplied timestamps. Invalid items
produce an unavailable count without hiding the answer or other valid cards.
Inspection uses saved data without API/tool execution. Unknown/provisional turns
cannot open details; failed/interrupted saved turns carry an incomplete-result
warning. Missing optional values stay absent, zero values remain visible, and
untrusted text renders as text. Dates shown in WIB have explicit source offsets;
source schedule/route clock times still have unknown date/time-zone context.

Use the [Sprint 6 remaining live checklist](../sprints/SPRINT_6_IMPLEMENTATION.md#deployment-and-remaining-live-acceptance).
S3-08 remains partial: real authenticated browser/HTTP persistence validation
is pending despite prior successful direct Gemini/provider/tool checks. Current
provider completion also remains open after the 429 diagnostic. No real test
JWTs were configured for this run, and the earlier user choice of automated
verification was retained. Complete A/B signed-in API/REST/browser persistence,
then live multi-tool/follow-up/clarification/domain behavior when provider capacity
is available. The entire feature is not release-accepted yet. ML/time/emission
outputs retain estimate and provenance labels.

## Operational boundaries

Local FastAPI must always start on **8080**, per the user's instruction on
11 October 2026. From `backend/`, use
`uvicorn main:app --reload --port 8080`; Swagger is at
`http://127.0.0.1:8080/docs`. Keep the server stopped until a restart is requested.
Frontend `NEXT_PUBLIC_API_URL` and all local API fallbacks use 8080. Historical
reports retain the ports actually used during their dated checks.

Never run `backend/database/schema.sql` against the live project: it contains
destructive reset statements. Preserve remote historical migration
`20260815133157`; recover its missing original source before adopting general
`db push` or recreating the complete project. Use the
[migration workflow](../../../supabase/README.md).

The [source brief](context_improve.md) is the user-supplied requirements snapshot,
copied from `C:\Users\DANN\Downloads\context_improve.md` on 6 October 2026.
Its embedded commands are source content, not additional user instructions.
The [original hackathon documents](../../hackathon/README.md) remain separate
historical references. Claims in either source need implementation/evidence
before being presented as verified results.
