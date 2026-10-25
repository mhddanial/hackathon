# Departure validation environment and release prerequisites

24 October 2026, Asia/Jakarta. D6-07 documentation preparation only; **release readiness is not complete**. No deployment, migration, schema execution, real login, live data write, or new commit was performed.

## Environments and configuration

| Context | Current evidence / configuration |
| --- | --- |
| Backend offline acceptance | Existing ignored `.venv`, Python 3.12.10 / pytest 9.1.1. Dotenv disabled before imports; outbound socket connections blocked. Actual ASGI endpoint runs with injected fake Auth, database, OSRM and model responses. |
| Frontend controlled UI | Isolated copy at `/private/tmp/departure-sprint5-kW8D9G/frontend`, matching all current `frontend/src` files. Repository `.env*` files excluded; installed dependencies symlinked. Synthetic services use 3011/9011. |
| Headless checks | Isolated Playwright 1.64.1 / Chromium headless shell 156.0.8078.4 under `/private/tmp/departure-headless-d5-06`; fresh temporary browser context. No user Chrome/Computer Use. External page requests blocked. |
| Live acceptance | User will start local backend/frontend and perform the [manual signed-in checklist](D6_02_MANUAL_CHECKLIST.md) themselves. D6-02 remains pending until sanitized results are supplied and reviewed. Assistant health/OpenAPI checks are startup evidence only; no signed-in dependency request was made. Do not put secrets in chat/evidence. |
| Participant sessions | User explicitly deferred supervisor/institution confirmation and participant testing to focus on feature completion. This does not block technical implementation. No collection occurs; follow the existing protocol when the study resumes. |

Server-owned variables: `DEPARTURE_SAFETY_BUFFER_MIN` and `DEPARTURE_SCHEDULE_MAX_AGE_MIN` must be finite and positive. Frozen defaults are **15 / 1440 minutes as project simulation parameters**, not verified terminal SOPs. The browser cannot override them. Backend auth/reference reads use the existing Supabase configuration; frontend uses `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_API_URL`. Privileged credentials never belong in frontend configuration or evidence. Existing backend local convention is 8080 and frontend 3000; controlled 9011/3011 ports are synthetic only.

Use operator-supplied exported configuration for approved integration; never read or print `.env` files under this task. Raw clock rows remain UNAVAILABLE without established dates, source zones, cutoffs, service applicability and freshness. Synthetic fixtures cannot fill missing live metadata. No new feature table or migration is required by the current on-demand implementation. **Never execute `backend/database/schema.sql`.**

## Reproduce the controlled checks

From the repository root:

```sh
.venv/bin/python docs/departure/evidence/sprint-6/run_acceptance.py
.venv/bin/python docs/departure/evidence/sprint-6/measure_synthetic_latency.py
```

The first captures 66 frozen definitions and runs 431 assertions/regressions. The second measures in-process HTTP handling with fake dependencies; it cannot establish network/production latency. Both disable dotenv and external socket connections before backend imports.

For browser checks, start `node scripts/departure-ui-fixture.mjs` from `frontend/`. Start the isolated build with only these explicit synthetic process settings:

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9011 NEXT_PUBLIC_SUPABASE_ANON_KEY=synthetic-local-key NEXT_PUBLIC_API_URL=http://127.0.0.1:9011 NEXT_TELEMETRY_DISABLED=1 npm run start -- --hostname 127.0.0.1 --port 3011
```

Then, from repository root:

```sh
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/departure-headless-d5-06/browsers node docs/departure/evidence/sprint-6/run_browser.mjs
.venv/bin/python docs/departure/evidence/sprint-6/build_matrix.py
```

Use `run_browser.mjs --u4` and `run_browser.mjs --shared` for the added fixture/shared checks. For `run_browser.mjs --route`, stop the departure fixture, start `ORACLE_FIXTURE_PORT=9011 node scripts/oracle-ui-fixture.mjs` from `frontend/`, and keep the isolated Next server on 3011. Do not run both fixtures on the same port. All modes use headless Chromium only.

Actual commands/results and the build command are recorded in [Sprint 6 acceptance](../sprints/SPRINT_6_ACCEPTANCE.md). Stop the two temporary server processes afterward and verify that ports 3011/9011 have no listeners. Current cleanup proof is in Sprint 6 evidence. If temporary copies/browser dependencies are removed, recreate them through the existing preparation script and approved installation workflow; do not claim a missing environment passed.

## Read-only integration gate

Once access exists, record the approved non-production scope and operator setup without credentials. Exercise browser → verified-auth departure API → read-only schedule/route dependencies using approved real inputs, valid/missing/expired credentials, missing/stale metadata, known targets and supported alternatives. Capture sanitized inputs/results/provenance; mark unknown values UNAVAILABLE and failed I/O as controlled transport errors. Keep fixture and real results separate. Measure network endpoint timings separately with environment, success/failure counts, first/warm conditions and dependency mode. Do not turn this prepared checklist into claimed execution.

## Release order and rollback — planned, not executed

1. Close the live-data/provenance/read-only acceptance gates and retain passing regression evidence. The earlier lint errors are fixed; 16 existing warnings remain. Record actual backend/frontend revision/artifact IDs and prior known-working versions. Those release IDs are currently **not provided**.
2. Deploy the compatible backend endpoint/configuration first only after separate authorization. Validate startup and approved read-only auth/response behavior before enabling the frontend page. Correct UNAVAILABLE behavior does not verify a real sailing's missing metadata.
3. Release the matching frontend only after backend checks pass. Recheck protected navigation, request/response contract, stale-result behavior and source labels. No release is authorized by this documentation.
4. For rollback, use the operator-recorded prior compatible frontend artifact first, then restore the backend only under the recorded compatibility plan. Recheck unrelated Planner/schedules/congestion/auth behavior. Do not run schema initialization, delete data, or invent an untested working revision. Rollback has **not been exercised** here.

D6-07 remains pending while live acceptance, usability/report evidence and actual release/rollback artifacts remain open.

## Current technical completion order

The user deferred D6-04 evaluation; it is not a coding gate. Continue only the core Sprint 6 scope:

1. Preserve the implemented API/UI and existing passing controlled checks. No additional mandatory feature-code gap was identified by this scope/status review; this is not a new application test run.
2. Await the user's sanitized results from the [D6-02 manual checklist](D6_02_MANUAL_CHECKLIST.md), using their own local processes and approved read-only cases. Do not obtain configuration by reading/loading `.env` files or use fake Auth/API evidence as real integration.
3. Fix actual integration findings within authorized frontend scope; stop and report backend/contract problems without editing backend code. Run the affected checks and capture sanitized results.
4. Update technical readiness and known limitations from those real results. Keep deferred participant findings explicitly absent. Deployment requires separate authorization; Sprint 7 is not included.

Local selection follow-up: the existing FastAPI application was started on 127.0.0.1:8080 with dotenv loading disabled. `/health` returned 200 and the departure POST route is registered; [startup evidence](../evidence/sprint-6/local-startup.json). The project contains Supabase config/migrations and existing backend/frontend environment files, but no environment file content has been read. Supabase/Docker CLIs are not on PATH, no local Supabase listener was observed, and the migration README does not establish a complete fresh-stack bootstrap. No fresh local database or fake replacement has been presented as an existing usable Supabase stack.

The user explicitly retained the `.env` rule and chose to run backend/frontend and signed-in checks personally. No exception is granted or still requested. The assistant-owned backend has been stopped gracefully; `lsof -nP -iTCP:8080 -sTCP:LISTEN` returned exit 1 with empty output, releasing 8080 for the user's process. Do not restart services, inspect/load either `.env` file, or operate the user's browser for this handoff. Keep D6-02 pending until user-pasted sanitized results have been reviewed; user-reported observations must remain distinguishable from assistant-observed startup and synthetic checks.

## Malformed Supabase URL during manual startup

If the SDK reports `Invalid supabaseUrl: Provided URL is malformed`, correct the **effective** `NEXT_PUBLIC_SUPABASE_URL` yourself: use the actual Supabase Project URL, including HTTP/HTTPS, without angle-bracket placeholders, embedded credentials, whitespace, query or fragment. The local FastAPI address is a separate `NEXT_PUBLIC_API_URL`; a dashboard/settings URL is not the Supabase Project URL. Use the matching project's public anon/publishable key in the existing `NEXT_PUBLIC_SUPABASE_ANON_KEY` setting. Do not post any key or environment-file contents.

Your terminal's exported variables can override file settings. After correcting your own configuration, stop/restart your frontend dev server; for a production build, rebuild before starting because `NEXT_PUBLIC_*` values are bundled. The assistant does not inspect/load/edit either environment file or change your running processes. Middleware now returns a clear no-store 503 for invalid settings; this protects the route but does not make authentication operational. [Offline guard verification](../evidence/sprint-6/supabase-config-fix.json) passed; the real configuration and signed-in flow remain manual pending.

For a copy-safe diagnostic, the **user** can run `node scripts/diagnose-supabase-config.mjs` from `frontend/`. This operator-only command uses Next's development environment loading order and prints only `urlPresent`, `urlValid`, and `keyPresent` booleans. It neither starts a service nor verifies credentials/connectivity. The assistant must not directly execute this CLI under the retained `.env` rule. Syntax/lint and a synthetic harness with a stubbed environment loader were checked; no real configuration was loaded by the assistant. Paste only its boolean result, never configuration values.

## Current sign-in blocker — operator triage

25 October 2026: the user reports being unable to sign in, with an earlier “Failed to fetch” message. The exact current error and auth method remain unknown. The login page uses the Supabase browser client directly; the FastAPI favicon 404 does not diagnose this request failure.

1. In the frontend terminal, the operator runs the diagnostic above and supplies only its three booleans. All `true` means presence/basic URL syntax passed; it does not verify the correct project, key validity, project availability or browser connectivity.
2. Report whether the failing action is email/password or Google, and the exact displayed error. For a browser fetch failure, use Developer Tools → Network and supply only the failed hostname/path and browser error code or HTTP status. Do not export HAR files, headers, request bodies, credentials or tokens.
3. Use that evidence to choose a fix. A failed fetch alone does not establish wrong credentials, CORS, an unavailable project or an incorrect URL. If the operator corrects public frontend settings, restart development or rebuild production before retrying.
4. After sign-in works, resume the manual checklist on local 3000/8080 with existing approved read-only records. Record actual outcomes and durations; a working login alone does not complete D6-02.

The [revision review](../evidence/sprint-6/revision-traceability.json) supplies existing source/evidence commit IDs for D6-06/D6-07. These are not deployed artifact IDs or proof of an exercised rollback. No full task is closed by this documentation update.

### Optional operator network diagnostic

If all three configuration booleans are true but requests still fail, the **operator** can run this from `frontend/`:

```sh
node scripts/diagnose-supabase-config.mjs --network
```

The default command still prints only three booleans. `--network` adds one read-only, unauthenticated GET to `/auth/v1/health`, with a five-second timeout and redirects disabled. It sends no API key, password, bearer token or cookies, discards the response body and prints only booleans, an HTTP status and a static failure category. The assistant must not run this CLI with real settings because its direct entry point loads environment files. A response such as 401 means the server responded to an unauthenticated probe; even 200 does not verify the configured key, providers, browser CORS or a login. `loginVerified` always remains false.

| Diagnostic output | Next operator check |
| --- | --- |
| `INVALID_URL` | Correct the effective Project URL, then restart/rebuild the frontend |
| `DNS_ERROR` | Compare the Project URL against the dashboard, check whether the intended project is paused, and check local DNS/network access; the category alone does not identify which cause applies |
| `CONNECTION_REFUSED` | Verify the configured host/port; if it is a local Supabase instance, confirm that instance is running |
| `TLS_ERROR`, `TIMEOUT`, `CONNECTION_ERROR` | Check the network/proxy/certificate problem indicated by the category; do not disable TLS verification |
| HTTP response | Use the exact browser failure and Auth/provider settings to continue; this Node probe does not reproduce browser authentication |

Reference: [Supabase DNS troubleshooting](https://supabase.com/kb/troubleshooting/nxdomain-error-connecting-to-a-supabase-project), [Google provider setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls). Do not change shared project/provider settings without the appropriate project owner's authorization.

For Chrome/Edge on macOS: open the login page, press **Command + Option + I**, select **Network**, and retry one sign-in. Inspect the failed request's **Headers → General**, or its error in **Console**. Share only the hostname/path and status/error, omitting query strings and all headers/bodies. No HAR export is needed.
