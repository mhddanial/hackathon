# Sprint 1 — Secure Oracle history foundation

Dated implementation snapshot. See the [current context](../context/CURRENT_STATE.md)
and [legacy RLS repair](../security/LEGACY_RLS_FIX.md) for subsequent changes.

Date: 5 October 2026 (Asia/Jakarta). Branch: `danial`.
Status: implemented and verified. Application changes are local; the additive database migration was applied to the linked Supabase project matching backend configuration. No application deployment/push was performed.

## Delivered

| Task | Result |
| --- | --- |
| S1-01 — Inspect live schema/conventions | Authenticated Supabase CLI inspected the complete public-table inventory, policies, grants, ownership constraints, and existing migration history. No equivalent chat tables existed. The existing `profiles` table was discovered and preserved. |
| S1-02 — Typed contracts | Added validated chat/conversation/message/result/SSE contracts and an API contract document. These target the Sprint 2/3 endpoints; the current chat transport was not changed. |
| S1-03 — Additive migration | Added conversations/messages with user ownership, composite owner/turn FKs, deterministic server sequence, timestamps, allowed roles/tools, results, outcome state, and per-user request-ID uniqueness. |
| S1-04 — RLS/grants | Added eight SELECT/INSERT/UPDATE/DELETE policies, enabled and forced RLS on both tables, denied anonymous grants, and explicitly granted authenticated access with ownership predicates. |
| S1-05 — Request-scoped database access | Auth verifies the token before forwarding it to PostgREST; one client/transport per request, no shared auth mutation, automatic transport closure, 401 for invalid identity versus 503 for outages/malformed upstream responses. Existing route-history access uses this verified context. |
| S1-06 — Verification/preservation | 59 local tests passed, ten live transaction isolation checks passed before application and again on the installed schema, anonymous REST checks were rejected, legacy counts/policies were preserved, and the migration was recorded in cloud history. |

## Live inspection and migration

The Supabase plugin was confirmed installed/enabled, but its project/SQL tools were not exposed in this chat. The existing authenticated Supabase CLI login supplied the necessary access; its project link was matched to backend configuration without printing credentials. No keys were requested or retrieved.

Live database: PostgreSQL 17.6. Existing public tables were `road_segments`, `congestion_multipliers`, `ferry_schedules`, `route_query_log`, and `profiles`. `profiles` already had three ownership policies; the other four tables had RLS disabled. No existing chat storage was found.

The CLI generated `supabase/migrations/20261005135325_oracle_history.sql`. The migration was first tested in a disposable local database, then in a live transaction that rolled back its DDL/test rows. After those checks passed, the reviewed migration was applied through the authenticated CLI, verified, and recorded with migration repair. The existing historical migration entry was preserved.

The new schema deliberately fails on conflicting existing table/function names rather than overwriting an unknown implementation. It does not use the legacy reset script.

### Data and policy preservation

| Existing dataset | Before | After |
| --- | --- | --- |
| Road segments | 6 | 6 |
| Congestion multipliers | 25 | 25 |
| Ferry schedules | 20 | 20 |
| Route query log | 0 | 0 |
| Profiles | 0 | 0 |
| Auth users (aggregate only) | 19 | 19 |

Existing policy definitions compare equal before/after. No users, credentials, or private messages were returned by the catalog queries. Live policy probes used two existing identities internally, inserted only synthetic history in a transaction, and rolled it all back. They validate database roles/claims; they do not prove a successful real JWT login or browser session.

## Authentication behavior

`get_authenticated_context` creates a private HTTP transport and fresh Supabase client for one request. Supabase Auth verifies the supplied access token. Only after verification does the backend set that token on the client's PostgREST headers. FastAPI dependency caching lets identity and database dependencies share the same verified context. The transport closes after request processing.

Client session persistence and automatic refresh are disabled for that request-scoped client. No service-role key was introduced. Existing public-data callers keep their current client behavior.

The implementation was checked against the installed Python SDK and current [Supabase user-verification documentation](https://supabase.com/docs/reference/python/auth-getuser), [ownership policy guidance](https://supabase.com/docs/guides/database/postgres/row-level-security), and [explicit Data API grants guidance](https://supabase.com/docs/guides/api/securing-your-api).

Missing/malformed/invalid credentials return 401 with a Bearer challenge. Auth rate limits, network errors, retryable failures, server errors, and malformed upstream responses return a safe 503. Endpoint/database errors are not caught and mislabeled as authentication errors. Context repr excludes user data and client headers.

The existing `/user/history` response shape remains route-history-specific and now uses the verified token and explicit owner filter. Its live table still lacks `user_id`, so a valid route-history request may fail with a sanitized unavailable message. This pre-existing schema issue is not concealed by redirecting it to chat tables.

## Verification evidence

Local suite: **59 passed, 0 failures/errors/skips**, measured JUnit duration 4.337 seconds. Tests include:

- missing/invalid tokens, Auth failures/rate limits/network errors/malformed responses;
- real Supabase SDK header forwarding with mocked HTTP, concurrent user-client isolation, single verification per dependency chain, and transport cleanup;
- client identity rejection, UUID/message limits, result provenance/values, unsupported variants, and saved-success acknowledgment constraints;
- real PostgreSQL policy checks for A/B select/update/delete/append isolation, forged ownership/owner transfer, independent composite-FK enforcement, anonymous/no-user denial, retry uniqueness, archive behavior, valid own writes, and deterministic ordering;
- preservation of legacy sentinel tables/data when applying the additive migration locally.

Local SQL tests ran on an isolated loopback PostgreSQL 18 instance with a minimal test-only `auth.users`/`auth.uid()` stub. The disposable test database was created/dropped by fixtures. The temporary server was stopped after verification. Docker was unavailable; no Docker installation or service startup was required.

Live verification on installed Supabase schema: **10/10 checks passed**. Anonymous REST reads of both new tables returned HTTP 401 / `42501`. Catalog metadata confirmed enabled and forced RLS. Fresh backend smoke checks confirmed health, live schedule/congestion access, and rejection of absent/invalid history tokens. Python syntax parsed successfully for 20 backend source/test files.

Frontend code did not change in this sprint. The prior production-build/lint baseline remains applicable; no new frontend build was needed for the backend/schema changes. A transient CLI timeout during final catalog verification was resolved with a sequential retry; only completed query evidence is reported as successful.

Evidence files in `docs/oracle/evidence/sprint-1/`:

- `live-catalog-before.json`, `live-catalog-after.json` — tables/policies/grants/constraints;
- `live-baseline.json`, `live-counts-after.json` — preservation counts;
- `live-dryrun-rls.json`, `live-installed-rls.json` — rollback-only isolation probes;
- `live-anonymous-rest.json` — public API rejection;
- `tests.xml`, `test-summary.json` — actual local test results;
- `backend-smoke.json` — current source/app/data baseline;
- `advisor-summary.json` — scoped advisor findings;
- `migration-history.json` — cloud/local migration registration.

The standalone backend smoke utility still reports full catalog/session checks as outside its own public-API scope. The separate authenticated catalog/probe evidence establishes Sprint 1's live policy result.

## Files changed

- `backend/auth.py`, `backend/database.py`, `backend/routers/user.py` — verified request context, token-scoped client, and safe legacy-history errors;
- `backend/schemas/oracle.py` — typed contracts;
- `backend/tests/` — SDK/auth/contracts and PostgreSQL tests plus rollback-only live probe;
- `backend/database/audit_oracle_catalog_json.sql`, `audit_oracle_counts.sql` — metadata/count audits;
- `supabase/` — CLI config/ignores, generated migration, and migration/reproduction/rollback instructions;
- `docs/oracle/contracts/ORACLE_API_CONTRACT.md`, sprint reports/backlog, and evidence artifacts.

## Remaining scope and findings

Sprint 2 implements conversation endpoints/storage helpers using this foundation. Sprint 3 integrates persistent chat and protects `/agent/chat`; that existing chat API is still public in Sprint 1. The target request IDs and typed SSE contracts must be integrated with its existing caller together. Sprint 4 adds the history UI.

Supabase advisors reported no issues for the new Oracle tables/policies/trigger. Existing findings remain: four legacy public tables without RLS, three profile-policy initialization-plan warnings, and leaked-password protection disabled. These were recorded rather than silently changing unrelated services or global Auth settings. The project is not claimed globally secure or advisor-clean.

The cloud also has historical migration `20260815133157` without its original local file. Its history was preserved. Recover/reconcile that source before adopting general `db push` or a full fresh-project bootstrap workflow; the added CLI directory is not a complete historical schema recreation.

Valid-user HTTP sessions, browser history persistence, final streamed-message saving/retries, and result UI remain later-sprint acceptance tests. No AI-provider quota was used here, and no traffic accuracy or emission-reduction claim was made.
