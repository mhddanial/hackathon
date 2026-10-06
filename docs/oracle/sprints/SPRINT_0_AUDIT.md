# Sprint 0 — Oracle audit and baseline

Historical audit snapshot. See the [current context](../context/CURRENT_STATE.md)
for findings resolved by later sprints.

Date: 5 October 2026 (Asia/Jakarta). Branch: `danial`.
Audited application commit: `b7d733021e62cfce671473c8c08284c99143b9c2`.

## Outcome

The source audit and executable baseline are complete. Live Supabase connectivity is working in this run. Live database policy inspection and authenticated two-user isolation remain pending because this workspace has neither configured database catalog access nor dedicated two-user test credentials. These are Sprint 1 entry checks, not assumed passes.

No application behavior, database schema, accounts, or deployed services were changed. The new Python/SQL files are audit utilities. No AI-provider request was sent. A temporary local frontend server was started for HTTP smoke checks and stopped afterward.

## Tasks

| Task | Outcome | Evidence |
| --- | --- | --- |
| S0-01 — Identify attached context | Complete | Scope, contribution boundary, proposed contracts, report requirements, and acceptance criteria in `ORACLE_IMPLEMENTATION_SPRINTS.md`. |
| S0-02 — Inspect current repository | Complete | Source audit of auth, Oracle, tools, DB SQL, frontend callers, dependencies, notebook, and existing tests. |
| S0-03 — Record gaps and baseline | Complete | Sprint plan, this report, repeatable audit script, and sanitized JSON results. |
| S0-04 — Live dependencies/schema/test users | Partially complete | DNS/Auth/schedule/congestion checks and API schema probes completed. Full catalog/RLS inspection and test-user availability still pending. |

## Verified results

| Check | Result | What it establishes |
| --- | --- | --- |
| Git branch | `danial` | The requested branch was already active; no branch recreation/reset was needed. |
| Python syntax | Pass, 14 source files at audit time | Backend source, including the audit script, parses successfully. |
| Frontend production build | Pass | Current source compiles, type checks, and produces the expected routes. |
| Oracle ESLint | Pass | Targeted Oracle page lint passed. |
| Pytest collection | Exit 5: no tests collected | Existing `test_auth.py` is a manual script, not an automated assertion suite. This is not a passing backend test suite. |
| Backend `/health` via TestClient | HTTP 200, `status=ok` | Current app imports and serves the health route in-process. |
| `/user/history`, no token | HTTP 401 | Missing credentials are rejected. |
| `/user/history`, invalid token | HTTP 401 | Invalid credentials are rejected with Supabase Auth available. Valid-user ownership has not been tested. |
| Chat route security declaration | Absent | Source and OpenAPI both show `/agent/chat` lacks an authentication dependency. The audit did not call this route or spend provider quota. |
| Supabase DNS | Pass | Configured host resolves now. |
| Supabase Auth health | HTTP 200 | Auth service health endpoint is reachable; this does not prove a valid user session. |
| Supabase schedule read | HTTP 200 | One public schedule row could be read. Only column names/count were retained, never record content. |
| `/congestion`, SEG001/weekday/08:00 | HTTP 200; `source=ml_model`, `LOW`, `1.07` | A real data-backed congestion request completed in-process. The result is a project model estimate, not observed traffic. It is not an accuracy evaluation. |
| Model artifact | Loaded; 50 trees, 7 expected columns, high/low/medium classes | Existing artifact is loadable in the current Python environment. Training provenance/metrics remain unverified. |
| Local frontend `/` and `/login` | HTTP 200 | Production server serves public pages. |
| Local frontend `/oracle` and `/dashboard`, anonymous | HTTP 307 to `/login` | Production-server middleware protects those routes for anonymous HTTP requests. Authenticated browser UX was not exercised. |

The build reports a Next.js warning that the `middleware` convention is deprecated in favor of `proxy`. This warning did not fail the build. Framework migration is not part of Sprint 0; consult the installed guide before a later change.

## Live schema findings and limits

The configured API role returned these results for read-only, zero-row column probes:

| Probe | Result | Interpretation |
| --- | --- | --- |
| `road_segments` expected identifier/corridor columns | HTTP 200 | Required columns are visible to this API role. |
| `congestion_multipliers` expected segment/day/window columns | HTTP 200 | Required columns are visible to this API role. |
| `route_query_log.user_id` | HTTP 400, database code `42703` | The ownership column used by `/user/history` is unavailable in the live API contract. |
| `conversations` expected columns | HTTP 404, `PGRST205` | This table is not exposed in the API schema cache for this role. Do not equate this probe with a complete database inventory. |
| `chat_messages` expected columns | HTTP 404, `PGRST205` | This table is not exposed in the API schema cache for this role. |
| PostgREST schema root | HTTP 401 | Full API schema discovery is unavailable through this request. Successful data reads do not establish policy definitions. |

Schedule column metadata agrees with the checked-in single-row `departure_time` schema rather than README departure arrays.

Actual PostgreSQL RLS flags, policy expressions, grants, ownership constraints, and the presence of equivalent differently named history tables remain unverified. The supplied catalog audit SQL retrieves schema metadata without returning user records or changing the database. It has been prepared but not executed.

## Configuration and test environment

- Required backend Supabase and Lightning configuration is present; credential validity was only checked through the listed read operations.
- Frontend Supabase configuration is present. `NEXT_PUBLIC_API_URL` is not set in `.env.local` or the execution environment for this audit; the Oracle source currently falls back to `http://127.0.0.1:8000`.
- Neither `DATABASE_URL` nor `SUPABASE_DB_URL` is configured for catalog inspection.
- Dedicated `ORACLE_TEST_USER_A_*` / `ORACLE_TEST_USER_B_*` credentials are not configured. Other test-account availability is unknown; the audit did not enumerate users, sign in, or create accounts.
- The configured Supabase project's development/production classification is unknown. Select/confirm the non-production migration target before Sprint 1 applies schema changes.

## Sprint 1 entry requirements

1. Inspect authorized database catalog metadata with `backend/database/audit_oracle_schema.sql`; compare against checked-in SQL and the API probes. Reuse equivalent existing structures if found.
2. Confirm the test/migration environment and identify two dedicated test users through an approved setup. Keep credentials outside source control and logs.
3. Define history/result/SSE contracts before migrations or caller changes. Keep the existing event format and route-history contract distinct.
4. Implement request-scoped JWT forwarding and authenticated ownership queries; token verification alone does not authenticate later PostgREST requests.
5. Use an additive migration. Do not execute the legacy `schema.sql` reset statements.
6. Investigate model estimate versus documented source-window examples during the planned ML validity work. The single observed LOW prediction at 08:00 is recorded evidence, not proof of correctness or a reason to silently retrain.

## Files added

- `backend/scripts/audit_oracle_baseline.py` — rerunnable read-only Python audit with sanitized JSON output and bounded HTTP timeouts.
- `backend/database/audit_oracle_schema.sql` — read-only catalog/RLS/grant/index inspection for authorized SQL access.
- `docs/oracle/evidence/sprint-0/baseline.json` — configuration presence, live dependency probes, backend wiring, and model load evidence.
- `docs/oracle/evidence/sprint-0/frontend-http.json` — local production-server HTTP checks.
- `docs/oracle/sprints/SPRINT_0_AUDIT.md` — results, limitations, and Sprint 1 entry requirements.
- `docs/oracle/planning/ORACLE_IMPLEMENTATION_SPRINTS.md` — original backlog updated with the Sprint 0 execution status.

## Commands and reproduction

From the repository root:

```powershell
git branch --show-current
git status --short
& .\backend\.venv\Scripts\python.exe .\backend\scripts\audit_oracle_baseline.py --output .\docs\oracle\evidence\sprint-0\baseline.json
& .\backend\.venv\Scripts\python.exe -m pytest backend --collect-only -q
```

The audit loads credentials internally, never prints their values, fetches at most one public schedule row without retaining its content, probes history contracts with `limit=0`, and does not call the model provider. A zero exit code means the audit ran; inspect individual pass/fail/pending results rather than treating it as an acceptance test suite.

From `frontend`:

```powershell
& .\node_modules\.bin\next.cmd build
& .\node_modules\.bin\eslint.cmd 'src/app/(dashboard)/oracle/page.tsx'
& .\node_modules\.bin\next.cmd start --hostname 127.0.0.1 --port 3000
```

The smoke check requested `/`, `/login`, `/oracle`, and `/dashboard` without following redirects and retained only status codes and redirect paths. Stop the temporary server after checks. The saved evidence does not include screenshots or authenticated browser tests.

## Follow-up from Sprint 1

The authenticated Supabase CLI subsequently supplied live catalog access. `SPRINT_1_IMPLEMENTATION.md` records the discovered `profiles` table, installed private history tables/RLS, and successful live two-user database-role isolation probes. This report remains the initial Sprint 0 snapshot; valid-user HTTP/browser sessions were not exercised by either audit phase.
