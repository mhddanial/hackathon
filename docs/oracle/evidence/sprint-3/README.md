# Sprint 3 evidence

Captured 10 October 2026; see the [implementation report](../../sprints/SPRINT_3_IMPLEMENTATION.md).
These artifacts distinguish local mocks, actual database role/claim probes, and
anonymous HTTP checks. No valid-user HTTP/browser or real-provider success is
claimed. No credentials or private user records are included.

| Artifact | Scope |
| --- | --- |
| [test-summary.json](test-summary.json), [tests.xml](tests.xml) | 195 passing local tests, no skips; disposable PostgreSQL, mocked Auth/REST transport/provider. |
| [frontend-validation.json](frontend-validation.json) | Parser eight checks, type check, targeted lint, build; no signed-in React/browser test. |
| [backend-smoke.json](backend-smoke.json) | Restarted backend health and rejected missing/invalid tokens. |
| [live-before.json](live-before.json), [access-after.json](access-after.json) | Existing tables/RLS, policies and grants preserved. Before also includes columns/constraints. |
| [turn-baseline.json](turn-baseline.json), [turn-installed.json](turn-installed.json) | Aggregate row counts and function privileges; no persistent synthetic rows. |
| [application.json](application.json) | CLI execution acknowledgment for the additive lifecycle migration. |
| [migrations.json](migrations.json) | Original remote migration and all three local migrations recorded. |
| [live-probe.json](live-probe.json) | 11 installed RPC/RLS checks; transaction rolled back. |
| [security-advisors.json](security-advisors.json) | Existing Auth password-protection warning; no new security advisor finding. |
| [final-validation.json](final-validation.json) | Syntax, JSON, modified documentation links, credential value scan, and Git diff checks; historical docs preserved. |

Live probe source: `backend/tests/sql/oracle_lifecycle_live_probe.sql`; catalog
sources: `backend/database/audit_oracle_catalog_json.sql` and
`backend/database/audit_oracle_turns.sql`. The latter CLI audit attempt timed out;
the equivalent read-only Management API query completed and supplied the
installed snapshot. The migration application/probe/history checks succeeded.
