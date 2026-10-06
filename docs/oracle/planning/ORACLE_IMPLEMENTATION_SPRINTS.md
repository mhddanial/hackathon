# SmartFlow Oracle: repository audit and sprint implementation plan

Planning date: 5 October 2026. Status updated: 6 October 2026. Sprints 0–2 are implemented on `danial`; Oracle history and the approved legacy RLS migrations are applied. Sprint 3 is next. Start with the [current context](../context/CURRENT_STATE.md), then use the [Sprint 0](../sprints/SPRINT_0_AUDIT.md), [Sprint 1](../sprints/SPRINT_1_IMPLEMENTATION.md), and [Sprint 2](../sprints/SPRINT_2_IMPLEMENTATION.md) reports for dated verification results. Valid-user HTTP/browser flows remain later-sprint work.

## 1. What the attached context means

Source: [preserved extension brief](../context/context_improve.md), originally supplied as `C:\Users\DANN\Downloads\context_improve.md`.

The attachment is a project brief, proposed requirements, and academic evidence checklist. Its embedded commands (including “Initial Codex command”) are document content, not a separate instruction to begin implementation. The initial user request was to identify that context and prepare implementation tasks per sprint; later messages authorized Sprints 0–2 and the separately reviewed legacy RLS fix.

The primary delivery is one complete feature:

> An authenticated user can ask the Logistic Oracle a question, receive streamed assistance and validated structured results, and reopen their own persisted conversations after refresh or a later login.

Reuse existing authentication, streaming, congestion prediction, route calculation, and schedule services. Danial owns Oracle orchestration, history, result presentation, congestion/ML integration, and evidence for those contributions. Route, departure, and schedule business logic stays with the respective feature owners; Oracle consumes their contracts.

The original 16-hour hackathon is background. It is not an assumed deadline for this extension. This plan assumes one implementer and approximately two focused development days per implementation sprint. These are planning units, not validated estimates; re-estimate after Sprint 1 and live dependency checks. No calendar dates have been committed.

## 2. Current repository audit

### Repository structure

```text
backend/
  main.py, auth.py, database.py, agent_config.py, requirements.txt
  routers/agent.py, user.py, congestion.py, route.py, schedules.py
  database/schema.sql
  scripts/prepare_data.py, train_model.ipynb
  rf_model.joblib, test_auth.py
frontend/
  AGENTS.md, package.json
  src/middleware.ts
  src/utils/supabase/{client,server,middleware}.ts
  src/components/providers/AuthProvider.tsx
  src/app/auth/callback/route.ts
  src/app/(dashboard)/oracle/page.tsx
  src/components/ui/ (existing shared UI)
docs/
  oracle/README.md, context/, planning/, contracts/, sprints/, security/, evidence/
  hackathon/PRD.md, TECH.md, TASK.md, BUILDER_A.md, BUILDER_B.md
  hackathon/NEXT_STEPS.md, DESIGN.md, methodology_notes.md, pitch-deck/, data/
```

`frontend/AGENTS.md` requires consulting the installed Next.js guides before implementation. Those guides are present under `frontend/node_modules/next/dist/docs/`.

### Initial source findings (before Sprint 1)

| Area | Current implementation | Gap for the target feature |
| --- | --- | --- |
| Browser authentication | Supabase client/SSR helpers, OAuth callback, session provider, and middleware redirect anonymous protected-page access to `/login`. | Browser protection does not protect the chat API. Verify actual session expiry behavior during integration. |
| Backend authentication | `backend/auth.py` verifies Bearer tokens with `supabase.auth.get_user(token)`. `/user/history` uses that dependency. | `/agent/chat` has no authentication dependency. Distinguish invalid tokens from authentication-service outages. |
| Database client | `backend/database.py` creates a client using `SUPABASE_ANON_KEY`. | Verifying a token does not make subsequent PostgREST queries run as that user. Forward the validated JWT using a request-scoped client. |
| Oracle backend | `/agent/chat` streams `status`, `chunk`, `error`, and `done` SSE events. Uses Lightning AI, `google/gemini-3.5-flash`, and three named tools. Caps tool rounds at three. | Each request starts with only the current user message. No conversation ownership, history context, persistence, result payload, or server message IDs. |
| Tool execution | Explicit name dispatch, congestion/route function reuse, and ferry schedule query. | Backend tool schemas are missing. Route tool forces `weekday`, silently defaults time from host clock, and schedule tool has no destination filter. Congestion tool schema gives IDs inconsistent with `SEG001`–`SEG006`. |
| Malformed tool JSON | Exception handling exists in `agent.py`. | The JSON-error handler can reference `func_args` before assignment or reuse a prior value. Non-object JSON is not checked on the normal parse path. |
| Oracle frontend | Local React message state, quick actions, status/error bubbles, buffered SSE parsing, and abort handling. | Fetch does not send the access token. No conversation list/reload, server IDs, retry persistence, result card, or modal. “Clear Chat” only clears local state. Enter can call send while a stream is active because the send handler has no busy guard. |
| Existing history | `GET /user/history` queries `route_query_log` filtered by authenticated `user_id`, ordered by `requested_at`. | It is route history, not chat history. Checked-in `route_query_log` has no `user_id`. Preserve this route-history contract and record its discrepancy separately. |
| Schema/RLS | Checked-in SQL defines road segments, multipliers, ferry schedules, and route query logs. | No conversations/messages or RLS statements. SQL begins with destructive `DROP TABLE ... CASCADE`; it must not be used as the history migration. Live schema/policies are unverified. |
| Structured results | Tool dictionaries exist internally. | No validated backend-to-frontend structured result contract or persisted result representation. |
| Congestion service | Model artifact loading, feature ordering, parameter checks, database-window fallback, source fields. | Fallback labels are `database` and `fallback_default`, not the attachment's proposed names. Default fallback omits day/hour. Database lookup is required before inference; a DB outage does not reach a useful default fallback. No data-status disclaimer. |
| ML notebook | Source contains stratified random row split, 20% test size, seed 42, 50 estimators, and stored evaluation output. | Stored output is not a newly verified training result. Similar synthetic rows may cross the split. Artifact compatibility and provenance need evidence. |
| Tests | `backend/test_auth.py` is a manual network script for absent/fake tokens. | No discovered automated Oracle/history suite or frontend test script. Manual output has no assertions and does not prove user isolation. |

### Documentation discrepancies

1. README describes a JSON `{ reply }` chat response; configured chat actually uses SSE, with a separate JSON fallback when the AI client is absent. The current Oracle UI expects SSE and cannot correctly display that JSON fallback.
2. README mixes Gemini 2.5 wording with the current Lightning model configuration.
3. README describes `proxy.ts`; checked-out route protection is `frontend/src/middleware.ts`. Do not change framework conventions solely to match documentation.
4. README describes schedule departure arrays; the checked-in schema and Oracle adapter use individual `departure_time` rows.
5. `user.py` comments claim RLS is enabled, but checked-in SQL does not establish it. Actual deployed RLS remains unknown.
6. README uses real-time and emission-reduction claims that the checked-out calculation/data flow does not establish. Route emissions use a simple distance formula, while methodology notes describe a different fuel/idling formula. Document actual behavior and coordinate any formula change with the route owner.
7. `docs/hackathon/NEXT_STEPS.md` still treats authentication as undecided even though auth code exists. The new Oracle scope needs a single current implementation record.

### Audit limits

Sprint 0 added live DNS/Auth/data probes, TestClient checks, a frontend build, and anonymous redirects. Sprint 1 subsequently inspected the authorized live catalog and verified installed ownership policies; see its implementation report and evidence. Valid-user HTTP/browser sessions, provider execution, and application deployment remain unverified. API-role column probes alone are not a full schema/RLS inventory.

## 3. Implementation decisions to carry through the sprints

1. **Preserve SSE.** Keep `status`, `chunk`, `error`, and `done`; add typed metadata/result payloads. Document actual content types and migrate backend/frontend together. If a real JSON consumer is discovered, support it explicitly rather than removing it accidentally.
2. **Authenticate before opening the stream.** Missing/expired credentials and ownership violations return normal HTTP errors before any provider work or private-history access.
3. **Use a request-scoped Supabase client with the verified user's JWT.** Never mutate a shared client's auth session between requests. No service-role key is needed for the proposed history access design.
4. **Keep route history separate.** Add conversation endpoints under `/user/conversations`; do not turn `/user/history` or `route_query_log` into chat storage.
5. **Use an additive migration.** Inspect live schema first, adapt equivalent tables if present, and add only missing structures. Keep the legacy reset SQL out of the migration process.
6. **Enforce ownership twice.** API queries scope every operation by authenticated user; RLS protects direct database access. Ensure message ownership matches conversation ownership using a database constraint/policy, not only UI logic.
7. **Persist completion explicitly.** A streamed answer remains provisional until saved. A successful terminal event is sent only after final persistence. Interrupted/failed turns must not reload as completed answers.
8. **Make retries safe.** Use a per-turn request ID and uniqueness rule, with completed/failed/in-progress behavior defined. One retry must not duplicate user messages or repeat completed tool work.
9. **Build results from validated tool data.** Never infer a result card from arbitrary prose. Preserve all successful tool outputs in history; if a turn has several results, provide a deterministic list of results rather than silently discarding them.
10. **Keep source and freshness distinct.** ML output is a synthetic estimate; a database lookup is database-sourced and may have unknown freshness. Route time/emissions are estimates. No invented current timestamp may be presented as the source's observation time.
11. **Use explicit logistics time.** Store timestamps in UTC; handle Batam planning time as `Asia/Jakarta` and distinguish Singapore schedule times where applicable. Clarify missing planning inputs instead of using undocumented defaults.
12. **Limit scope.** No new departure service, geocoder, route optimizer, file-upload feature, or model-provider migration is required. A dedicated departure tool is optional only after its owner supplies a tested contract; the existing route response has departure fields but that alone does not establish a standalone departure API.

## 4. Sprint overview

| Sprint | Outcome | Depends on | Exit evidence |
| --- | --- | --- | --- |
| 0 — Audit and baseline | Source and executable baseline complete; external verification partially pending | None | `SPRINT_0_AUDIT.md`, read-only audit utilities, sanitized JSON evidence |
| 1 — Secure foundation | Contracts, non-destructive schema, request-scoped authentication, and RLS | Sprint 0 | Applied test-environment migration; A/B policy tests; API contract examples |
| 2 — Conversation API | Owned conversations and deterministic message retrieval | Sprint 1 | CRUD/ownership/pagination API tests |
| 3 — Persistent agent | Validated tools, conversation context, safe retries, persisted streamed answers/results | Sprint 2 | Mocked streaming/tool/failure tests plus live authenticated smoke test |
| 4 — History interface | New/select/reopen conversations and reliable authenticated chat | Sprint 3 | Browser flow survives refresh and later login |
| 5 — Result details | Validated result cards and accessible recommendation modal | Sprints 3–4 | UI tests for supported types, missing fields, and restored results |
| 6 — Integration, ML evidence, documentation | End-to-end acceptance and report-ready actual evidence | Sprints 1–5 | A/B isolation, failure matrix, artifact compatibility, updated docs |

Security, persistence, and runtime provenance are release requirements. Do not postpone them to a polish sprint. Tests accompany each sprint; Sprint 6 validates the complete integration.

## 5. Step-by-step sprint backlog

### Sprint 0 — Audit and baseline

- [x] **S0-01:** Read the attachment and identify goal, contribution boundary, hypotheses, and acceptance criteria.
- [x] **S0-02:** Inspect repository tree, README, auth, Oracle callers, tools, schema, notebook, and existing test setup.
- [x] **S0-03:** Record current behavior versus documentation, without editing application code or database.
- [ ] **S0-04 (partial):** Supabase DNS/Auth health, schedule read, model-backed congestion, API column probes, and anonymous frontend redirects were checked. Full catalog/RLS inspection and dedicated two-user availability still require authorized test-environment access; carry those explicit prerequisites into Sprint 1.

Deliverable: `SPRINT_0_AUDIT.md`, `backend/scripts/audit_oracle_baseline.py`, read-only catalog SQL, and `docs/oracle/evidence/sprint-0/` results. Local/source baseline is complete; external policy and valid-user verification remain pending.

### Sprint 1 — Secure foundation and shared contracts

Execute in this order:

- [x] **S1-01 — Confirm live schema and migration convention.** Authenticated CLI inspected catalog/grants/policies and matched the configured project. No equivalent chat tables existed; `profiles` and historical migration history were preserved. Isolated local PostgreSQL and rollback-only live transactions supplied test environments.
- [x] **S1-02 — Define typed contracts.** `backend/schemas/oracle.py` and `docs/oracle/contracts/ORACLE_API_CONTRACT.md` define validation, variants, HTTP errors, SSE lifecycle, and per-turn request IDs. These target contracts are wired into endpoints in Sprints 2/3.
- [x] **S1-03 — Write an additive migration.** CLI-generated `supabase/migrations/20261005135325_oracle_history.sql` adds owned conversations/messages, composite owner/turn FKs, retry/outcome fields, and a server sequence for deterministic ordering.
- [x] **S1-04 — Add RLS and grants.** Eight policies, explicit authenticated grants, anonymous denial, and enabled/forced RLS passed local and installed live role/claim isolation checks.
- [x] **S1-05 — Implement request-scoped authenticated DB access.** Verified JWT forwarded to PostgREST on a fresh request-owned client; existing route history shares that context. Invalid identity returns 401; upstream outages/malformed responses return 503; secrets/upstream details are not exposed.
- [x] **S1-06 — Prove the foundation.** 59 local tests and ten installed live transaction checks passed. The migration is applied/recorded, anonymous REST is rejected, legacy counts/policies are preserved, and rollback/report evidence is saved. Valid-user HTTP/browser integration remains later-sprint work.

Implemented files: auth/database/legacy-history integration, `backend/schemas/oracle.py`, CLI-generated `supabase/migrations/20261005135325_oracle_history.sql`, `supabase/README.md`, security tests, API contract, and `docs/oracle/sprints/SPRINT_1_IMPLEMENTATION.md` with evidence.

**Done when:** the authenticated DB client and ownership policies work for A/B users; no legacy data is reset; shared chat/history contracts are reviewable.

### Sprint 2 — Conversation and message API

- [x] **S2-01 — Add history storage helpers.** `OracleHistory` centralizes owned lookup, creation, message reads, title/archive changes, and safe database errors. Atomic turn persistence/retries are implemented together with streaming in S3-01/S3-05/S3-07, rather than adding a partial turn-write path here.
- [x] **S2-02 — Add create/list endpoints.** POST returns 201; GET uses bounded validated cursor pages ordered by update time and ID, with an archive filter.
- [x] **S2-03 — Add owned retrieval.** UUID-validating conversation/message GET endpoints use verified owner filters and RLS; foreign/nonexistent IDs share 404. Messages paginate by ascending server sequence.
- [x] **S2-04 — Add title/archive operations.** PATCH allowlists title and archive/restore; omitted title remains unchanged and null resets it. Archived conversations remain readable; no DELETE/hard-delete route is exposed.
- [x] **S2-05 — Test all ownership boundaries.** 36 API/SDK/PostgreSQL tests cover two users, auth rejection, body/cursor validation, archive/restore, stable pagination, persisted result/tool reads, safe failures, and private-field exclusion. Full local suite: 145 passed. Real JWT/browser flows remain later acceptance work.
- [x] **S2-06 — Publish request/response examples.** Updated API contract. `/user/history` remains separate; its ownership column/policy was repaired by the independently confirmed legacy migration, not repurposed for chat.

Implemented files: `backend/routers/user.py`, `backend/services/oracle_history.py`, `backend/tests/test_oracle_history.py`, and the API contract/report/evidence.

**Done when:** history operations pass API and RLS isolation tests, messages are stably ordered, and the route-history API has not been repurposed.

### Sprint 3 — Authenticated agent and persistent streaming

- [ ] **S3-01 — Protect chat and resolve the turn.** Authenticate, validate request, resolve/create only an owned conversation, reserve the retry ID, and save the user turn before invoking the provider. Reject DB/ownership failures before streaming starts.
- [ ] **S3-02 — Load bounded conversation context.** Include a limited recent history with valid assistant/tool-call pairing. Keep the server system prompt authoritative; do not replay client-controlled system instructions as trusted configuration.
- [ ] **S3-03 — Validate the three registered tools.** Fix JSON parsing first, then use Pydantic validation for IDs, day/hour, coordinates, time, terminal, and optional destination. Reject unknown tools/non-object JSON. Preserve route-owner internals; adapt only Oracle arguments and output normalization.
- [ ] **S3-04 — Correct guardrails and provenance.** Fix segment examples, remove unsupported live-data/06:00-benefit claims, handle missing inputs through clarification, limit unrelated questions, and distinguish actual tool errors from absent data. Use source/status metadata and controlled errors.
- [ ] **S3-05 — Persist the tool/answer/result lifecycle.** Save tool names, validated arguments, outputs, assistant text, result metadata, and turn outcome. Maintain updated conversation title/time. Results must come from successful validated tool output; failed tools never create recommendation data.
- [ ] **S3-06 — Extend SSE without breaking existing events.** Send conversation/message metadata, streamed chunks/status, validated results, and final persisted IDs/outcome. Unconfigured-provider and provider-error paths follow a documented consistent transport. Send terminal success only after save; send a safe failure outcome on save errors.
- [ ] **S3-06a — Upgrade the existing caller together.** When chat starts requiring auth/request IDs, minimally update the existing Oracle fetch/event handling in the same integration change. Do not defer basic caller compatibility to Sprint 4's full history interface.
- [ ] **S3-07 — Handle limits, aborts, and retries.** Bound message/context sizes, tool rounds/calls, provider/tool timeouts, and retry behavior. Define how interrupted turns are marked/recovered and ensure duplicate IDs do not repeat a completed turn.
- [ ] **S3-08 — Validate streaming and failures.** Test direct reply, successive tools, multiple results, fragmented tool-call deltas, malformed JSON, unknown tools, service failure, disconnect, replay, and final-save failure. Then run one real authenticated provider/tool request when services are available.

Likely files: `backend/routers/agent.py`, `backend/agent_config.py`, shared schemas/history service, a small new `backend/services/oracle_tools.py` if useful, and new `backend/tests/test_oracle_agent.py` / `test_oracle_tools.py`.

**Done when:** an owned conversation can receive a streamed turn and reload its persisted text/tools/results; failures cannot appear as successful saved answers; real provider validation is recorded separately from mocks.

### Sprint 4 — Persistent Oracle history interface

- [ ] **S4-01 — Add an authenticated Oracle API helper.** Use the current Supabase session token for chat/history requests; handle expiry and safe auth retry without replaying a non-idempotent turn. Keep request IDs stable across turn retries.
- [ ] **S4-02 — Add conversation list and new-conversation flow.** Include empty/loading/error states. Keep chat history navigation separate from the application's existing navigation sidebar.
- [ ] **S4-03 — Load/select/reopen conversations.** Fetch server messages and server IDs. Restore selected conversation using a validated URL parameter or non-sensitive selection state; reload messages from the server after refresh/login.
- [ ] **S4-04 — Connect persistent streaming.** Send the conversation ID, reconcile provisional UI messages with server IDs, and distinguish streaming, final saved, failed, and interrupted states. Preserve buffered parsing of fragmented/batched SSE frames.
- [ ] **S4-05 — Make switching and retry reliable.** Abort or isolate old requests so late responses cannot land in a different conversation. Guard both Enter and click against concurrent sends. Clear user-scoped state on logout/account change; cancel pending requests and reject stale responses. Define “New conversation” versus “Archive” actions instead of implying local clear deletes persisted history.
- [ ] **S4-06 — Verify the user flow.** New chat → send → refresh → reopen → follow-up → switch chat → logout/login. Test auth failure, network interruption, retry, and an empty conversation list.

Likely files: `frontend/src/app/(dashboard)/oracle/page.tsx`, new `frontend/src/lib/oracle-api.ts`, new `frontend/src/types/oracle.ts`, new `frontend/src/components/oracle/ConversationList.tsx`, and focused frontend tests. Reuse `AuthProvider` unless integration exposes a necessary narrow fix.

**Done when:** users can manage and reopen their own conversations, with no duplicate turns or cross-conversation/account UI leakage.

### Sprint 5 — Structured recommendation cards and modal

- [ ] **S5-01 — Validate the client result contract.** Use typed per-result data plus runtime checks at the API boundary; keep unsupported/malformed values from opening a modal. Support multiple results from one turn.
- [ ] **S5-02 — Add result preview cards.** Congestion, schedule, and route previews display only fields actually provided. Departure is enabled only for an established validated service result; generic data gets a safe presentation.
- [ ] **S5-03 — Build a reusable result modal.** Reuse the installed UI primitives, creating a dialog wrapper if necessary. Include keyboard navigation, focus trapping/return, close behavior, small-screen layout, source/status, limitations, and available timestamps.
- [ ] **S5-04 — Restore saved results.** Old conversations must display the same cards/modal data from persisted metadata; never rerun a tool merely to display history.
- [ ] **S5-05 — Test trust and empty boundaries.** No result means no modal. Failed/default/partial tools show explicit limitations. Treat untrusted text as text; do not inject HTML or manufacture missing time/emission/capacity values.

Likely files: shared frontend types/API helper, new `frontend/src/components/oracle/OracleResultCard.tsx`, new `OracleResultModal.tsx`, optional `frontend/src/components/ui/dialog.tsx`, Oracle page, and result-component tests.

**Done when:** a validated tool result can be inspected now and after refresh, with source and estimated/synthetic labels visible and accessible.

### Sprint 6 — Complete integration, ML validity, and report evidence

- [ ] **S6-01 — Run the two-user acceptance flow.** Use both API requests and direct RLS access: A cannot list/read/modify/append to B, including guessed UUIDs and forged ownership fields. Repeat through authenticated browser sessions.
- [ ] **S6-02 — Run the failure matrix.** Provider unavailable, Supabase unavailable, expired auth, unknown/malformed tool args, missing input, interrupted stream, duplicate retry, and final-save failure. Confirm deterministic ordering and pagination.
- [ ] **S6-03 — Verify congestion/artifact compatibility.** Check artifact package keys, feature order, peak-hour encoding, label/multiplier mapping, segment validation, midnight/full-day windows, model failure, database fallback, and default metadata. Preserve existing source labels or normalize at the Oracle boundary; update all known consumers if endpoint labels change.
- [ ] **S6-04 — Address congestion fallback limits.** Decide and test DB-unavailable behavior explicitly. Do not claim a database fallback succeeds when the initial corridor lookup already failed. Any default remains visibly uncertain; never silently present an assumed LOW value as observed traffic.
- [ ] **S6-05 — Record actual training methodology.** Extract actual dataset/class counts, features, parameters, split strategy, metrics, confusion matrix, artifact provenance, and runtime compatibility from a verified run when available. Explain synthetic-data limitations. A grouped/source-window evaluation is optional research work: document class coverage and compare with the baseline, without silently overwriting the current model or claiming generalization to Batam traffic.
- [ ] **S6-06 — Collect actual report evidence.** Save sanitized API examples, migration/RLS evidence, A/B rejection results, tool logs, refresh/history/modal screenshots, measured request latency with sample count/environment, and failure outputs. Map designs to BAB III and actual implementation/results to BAB IV.
- [ ] **S6-07 — Synchronize Oracle documentation.** Update the Oracle current context, API contract, sprint reports, evidence index, migration instructions, environment examples, test commands, provider/SSE contracts, provenance labels, and deployment order. Keep original hackathon materials as historical references. Publish only implemented/tested results; record unresolved issues explicitly.
- [ ] **S6-08 — Run final relevant checks.** Backend suite, frontend type checking/build/targeted lint, UI/browser tests, and `git diff --check`. Restart any non-reload backend before live validation so it serves current code. Verify deployment only if release is within the execution scope.

Likely files: `backend/routers/congestion.py`, notebook only if verified methodology work requires edits, new `backend/tests/test_congestion.py`, Oracle integration tests, frontend tests, `docs/oracle/context/CURRENT_STATE.md`, `docs/oracle/contracts/ORACLE_API_CONTRACT.md`, Oracle sprint reports, and a new Oracle evidence index. Original `docs/hackathon/` materials may be cited as background rather than rewritten for this extension.

**Done when:** the entire target flow passes security, persistence, streaming, UI, and provenance acceptance checks, with evidence that separates mocks, source inspection, and live results.

## 6. Minimum release tests

| Boundary | Required checks |
| --- | --- |
| Authentication | No token, malformed/expired token, valid token, auth-service outage; rejected before provider execution. |
| Ownership | A/B list/read/update/archive/append isolation; direct RLS select/insert/update/delete isolation; no forged owner or message/conversation mismatch. |
| History | Stable order and pagination, repeated timestamps, refresh/later login, archived conversation behavior, duplicate request ID. |
| Agent/tools | Three allowed tools, unknown tool, malformed/non-object JSON, invalid ID/coordinate/day/hour/time, missing input clarification, domain guardrail, bounded tool rounds. |
| Streaming/persistence | Fragmented/batched frames, multi-round deltas, disconnect, save failure, provider missing/failure, result metadata, terminal success only after persistence. |
| Frontend | Loading/error/empty states, authenticated fetch, conversation/account switching during pending work, Enter/click busy guard, safe retry, restored messages/results. |
| Modal | Valid variants, multiple results, no result, unsupported JSON, missing fields, safe text, keyboard/focus behavior, source/status/disclaimer. |
| ML | Feature compatibility, midnight/full-day windows, invalid requests, all fallback paths, source/status consistency, verified dataset-only metrics. |

Use mocked dependency tests for predictable backend coverage, a small frontend component/stream test setup, and browser end-to-end tests for user flows. Test tooling should be selected in Sprint 1 to fit the existing project rather than introducing several overlapping frameworks.

## 7. Environment, migrations, and release order

Existing configuration names: backend `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `LIGHTNING_API_KEY`; frontend `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

No new production credential is assumed. Optional provider URL/model configuration can be made environment-driven if useful, with the existing provider as the default. Two-user integration credentials must be provided through an approved test environment and excluded from logs/version control; do not put privileged keys in `NEXT_PUBLIC_*` variables.

Sprint 1 delivered additive conversation/message ownership, indexes, RLS/grants, and retry/outcome support after live schema comparison. The legacy `schema.sql` remains a reset script, not a deployment migration. Initial planning made no changes; the later authorized Sprint 1 migration is applied and recorded. No data reset or application deployment was performed.

Planned release order: test-environment migration and RLS verification → backward-compatible backend/history/SSE deployment → updated Oracle frontend → authenticated smoke test and A/B isolation check. Keep existing route/schedule functionality available throughout. A rollout issue should be recoverable by reverting application changes while retaining added data; avoid dropping new history as an automatic rollback.

## 8. Sprint reporting and stop condition

At the end of each sprint, record:

- task IDs completed and acceptance evidence;
- files changed and relevant tests/commands with actual results;
- migrations required/applied and target environment;
- remaining blockers, assumptions, and integration risks;
- the next sprint's entry requirements.

The feature is complete only when an authenticated user can reopen a persisted conversation containing saved replies and validated result details, another user cannot access or append to it, failures are transparent, and actual test/report evidence is available. Planned work and static checks alone are not completion evidence.

## 9. Planning-session baseline

- Repository source and available file tree inspected; working tree was clean before this document.
- Python AST syntax check passed for 13 backend source files; this did not execute application logic or contact services.
- Frontend TypeScript check passed: `frontend/node_modules/.bin/tsc.cmd --noEmit --incremental false` (run from `frontend`).
- Targeted Oracle ESLint passed: `frontend/node_modules/.bin/eslint.cmd 'src/app/(dashboard)/oracle/page.tsx'` (run from `frontend`). These checks do not prove browser behavior or API integration.
- Existing manual auth/network script was inspected, not executed. No automated runtime acceptance result is claimed.
- No application code, secrets, schema, or deployed services were changed.
