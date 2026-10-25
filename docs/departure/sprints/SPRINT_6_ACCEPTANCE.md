# Sprint 6 — Acceptance and evidence, in progress

24 October 2026, Asia/Jakarta. Owner: **Ananda Khusnul Hotimah — 3312401044**. Scope: **D6-01–D6-07 only**, processed in the plan's order. Sprint 7, live writes, schema execution, deployment and committing were not started. Existing Sprint 5 work was preserved. The initial run changed documentation/evidence only; the ordered follow-up below makes minimal frontend fixes tied to actual failures. Backend, frozen contracts/policy/fixtures and dependencies remain unchanged.

**Current result:** DEP-01–DEP-13 pass recorded **synthetic simulation** checks; DEP-14 has no actual participant evidence. User explicitly confirmed **no approved live/read-only integration access yet**, and subsequently **deferred supervisor/institution confirmation and participant testing to prioritize feature completion**. Evaluation is not a prerequisite for further coding. **Sprint 6 is not fully complete**, and only **D6-05** is checked for the currently evidenced fixes. Full lint passes **0 errors/16 warnings** in the recorded follow-up; U4 fixture preparation is verified synthetically.

## Ordered task status

| Step | Work actually done | Status / remaining requirement |
| --- | --- | --- |
| D6-01 — Functional matrix | Executed 431 backend checks, captured all 66 frozen definitions (63 ASGI HTTP cases / 3 configuration rejections), ran 26 fresh headless groups and 18 helpers. Matrix records inputs, expected, actual and results for DEP-01–DEP-14. | **Partial:** 13 synthetic criterion passes, 0 failures, 1 pending (DEP-14). Full task remains unchecked until actual usability evidence exists. |
| D6-02 — Signed-in dependencies | Recorded exported-variable presence without reading values/.env; recorded user-confirmed lack of approved setup. No real request or real sign-in attempted. | **Pending, as requested:** approved non-production URL/setup, authorized read-only inputs, verified occurrence/route context and real auth. Fake UI/Auth/ASGI results do not close this gate. |
| D6-03 — Regressions/timing | Fresh backend/frontend gates, 3 distinct catalog origin/terminal synthetic scenarios, 63 measured in-process successes and 9 injected errors reported separately. | **Partial:** follow-up lint, typecheck, build and affected regressions pass; 16 existing lint warnings remain. Real network/dependency latency and real three-scenario demonstrations pending access. |
| D6-04 — Usability | Prepared the protocol/template/moderator guide; fixed and verified the overnight/source-zone U4 fixture in five headless groups. Zero actual sessions. | **Deferred by the user:** focus on finishing implementation first. No collection or approval claimed; not a coding gate. Resume the existing protocol only when evaluation is requested. |
| D6-05 — Fix/retest evidenced issues | Fixed 7 lint errors, the U4 fixture preparation gap and an observed schedules hydration error. Retested 26 departure, 5 U4, 5 shared and 13 Planner browser groups, helpers, lint, typecheck and build. | **Complete for current evidenced issues:** source changes map to issue IDs and passing retests. New actual integration/usability findings can reopen this task; no participant retest was warranted because no sessions occurred. |
| D6-06 — BAB III/BAB IV evidence | Prepared evidence map, implemented sequence diagram, formulas/status table, actual synthetic output/screenshot/timing links and pending usability section. On 25 October, verified three existing Sprint 6 commits and nine recorded source hashes. | **Partial:** commit references are now supplied; real integration and participant findings remain absent. Earlier uncommitted captures describe their original run time. |
| D6-07 — Documentation/readiness | Updated feature README with honest progress; added environment/reproduction guide, known limitations, planned backend-before-frontend release and rollback prerequisites. Frozen contract/policy/design unchanged. | **Partial:** integration, usability/report and actual release/rollback artifacts remain open. No release/rollback was performed. |

## D6-01 — Functional acceptance

[Full human-readable matrix](../evidence/sprint-6/ACCEPTANCE_MATRIX.md) and [machine matrix](../evidence/sprint-6/acceptance-matrix.json) are generated from **actual fresh results**, not copied from expected values. [Backend captures](../evidence/sprint-6/backend-acceptance.json) include every fixture's merged inputs, frozen expectations, actual response summary, outcome and executed test identity. [Browser captures](../evidence/sprint-6/browser-acceptance.json) include controlled request/response bodies without tokens, headers, cookies or auth storage. Captured malformed responses are negative test inputs that the UI rejects; they are not accepted recommendations.

- DEP-01–DEP-11 and DEP-13 have captured ASGI/configuration results for every matching frozen fixture, including exact threshold/zero/tiny negative buffers, already-adjusted duration, missing cutoff, source-zone conversion, midnight/date rollover, mismatches, dependency/auth errors, bounded candidates, independent alternatives and all missed.
- DEP-12 ran the actual Next UI with the existing browser-fixture script: edits/Stop/keyboard Stop, slower old SAFE versus newer RISKY, expiry/logout/account change. **4 aborted requests**, 26 passing groups and zero uncaught page errors. Existing fixture path is fake Auth/API, separate from backend ASGI tests; this does not establish a real integrated backend chain.
- DEP-14 is explicitly **PENDING**: actual U1–U5 observations under the existing protocol are required. Developer/browser fixtures are not participants.

Fresh synthetic screenshots: [1440 px desktop](../evidence/sprint-6/departure-desktop.png), [375 px mobile](../evidence/sprint-6/departure-mobile-375.png). Both were inspected; labels, timestamps, signed buffers, simulation notices and stacked alternatives are readable, without horizontal overflow or overlapping/clipped content. Real Tab/Shift-Tab/Enter traversal, result/invalid-field/action focus and 44 px feature targets passed. No Computer Use or user Chrome was used. No real physical-device or participant accessibility-conformance claim is made.

The frozen clock/road/sailing times in examples are dated 23–24 October 2026 and injected explicitly. Running them on 24 October does not make them current sailings. Unknown values remain null, status is chosen before rounding, ETA consumes `final_time_min` once, and buffer uses the recorded cutoff.

## D6-02 — Real integration boundary

[Preflight](../evidence/sprint-6/live-preflight.json): user selected “No access yet — keep live acceptance pending.” No exported approved test endpoint/read-only credential was available in the inspected names; only presence booleans were recorded. `.env` files were not opened, printed or loaded by validation scripts. A fake fixture identity/token must not be used as real auth evidence. D3-06 remains open.

To resume, the operator supplies a non-secret approved setup reference/URL, secure process configuration and approved read-only cases. Then execute browser → verified-auth departure endpoint → real schedules/route, record valid results or correct unavailability/controlled failures, preserve source labels and document actual data gaps. This prepared sequence is not an executed test.

## D6-03 — Initial regressions and measured synthetic timing

This table records the initial run. Current post-fix frontend results are in the ordered follow-up below; the failed lint baseline is retained as historical evidence.

| Command (repository root unless indicated) | Result |
| --- | --- |
| `.venv/bin/python docs/departure/evidence/sprint-6/run_acceptance.py` | Exit 0; **431 passed**, 1 existing Starlette/httpx deprecation warning; **66/66 definitions captured**, no missing IDs. Dotenv disabled and external socket connections blocked before backend imports. |
| `.venv/bin/python docs/departure/evidence/sprint-6/build_matrix.py` | Exit 0; **13 synthetic criterion passes / 0 failed / 1 pending**, full D6-01 remains incomplete. |
| `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/departure-headless-d5-06/browsers node docs/departure/evidence/sprint-6/run_browser.mjs` | Exit 0; **26 headless groups passed**, 4 cancelled requests, zero uncaught page errors/external hosts. |
| `node scripts/check-departure.mjs` (`frontend/`) | Exit 0; **18 groups passed**. |
| `node scripts/check-route-integration.mjs` (`frontend/`) | Exit 0; **8 groups passed**. |
| `npx --no-install tsc --noEmit --incremental false` (`frontend/`) | Exit 0. |
| Scoped ESLint below (`frontend/`) | Exit 0, **0 errors/warnings**. |
| `npm run lint` (`frontend/`) | Exit 1; **7 existing errors / 19 warnings**, unchanged shared schedules/login/register/use-mobile files. Logged, not hidden or bypassed. |
| `.venv/bin/python docs/departure/evidence/sprint-6/measure_synthetic_latency.py` | Exit 0; 3 scenarios, **63 successes / 9 injected failures**, separate timing distributions. |
| Isolated production build below | Exit 0; `/departure` present, 12 static pages generated. |
| `git diff --check` | Passed after documentation/evidence work. |

Exact scoped lint:

```sh
npx --no-install eslint src/components/departure src/hooks/use-departure-recommendation.ts src/lib/departure-*.ts src/types/departure.ts 'src/app/(dashboard)/departure/page.tsx' scripts/check-departure.mjs scripts/check-departure-ui.js scripts/run-departure-headless.mjs
```

Browser setup reused the already installed isolated Playwright **1.64.1** / Chromium headless shell **156.0.8078.4**, with a fresh temporary context and page requests limited to 127.0.0.1:3011/9011. No installation/network download or application dependency/lockfile change was needed. The synthetic fixture was started from `frontend/` with `node scripts/departure-ui-fixture.mjs`; the isolated Next copy was started with:

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9011 NEXT_PUBLIC_SUPABASE_ANON_KEY=synthetic-local-key NEXT_PUBLIC_API_URL=http://127.0.0.1:9011 NEXT_TELEMETRY_DISABLED=1 npm run start -- --hostname 127.0.0.1 --port 3011
```

Fresh build command from `/private/tmp/departure-sprint5-mWoZgy/frontend`:

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9011 NEXT_PUBLIC_SUPABASE_ANON_KEY=synthetic-local-key NEXT_PUBLIC_API_URL=http://127.0.0.1:9011 NEXT_TELEMETRY_DISABLED=1 npm run build -- --webpack
```

The copy excludes repository `.env*`; source comparison confirmed all current `frontend/src` files match the tested copy. Build warnings are the existing middleware convention/Next Edge-runtime imports. Current logs and XML are in [Sprint 6 evidence](../evidence/sprint-6/README.md). Existing Sprint 5 route browser results remain historical and were not relabeled as fresh Sprint 6 results; backend route/congestion/auth regressions and route helpers did run fresh here.

### Timing scope and actual samples

[Raw timing samples](../evidence/sprint-6/synthetic-latency.json). Python **3.12.10**, macOS/Darwin **arm64**, monotonic `perf_counter_ns`, concurrency **1**. Per scenario: **1 first request after a fresh TestClient + 20 sequential warm requests**. Imports and TestClient setup excluded. Later scenarios share the Python process/module caches; first-request measurements are **not cold process/model startup**. Timer wraps the actual in-process POST through the implemented ASGI endpoint with mocked Auth/DB/OSRM and a mocked model response. No outbound network connection occurs.

| Synthetic catalog scenario | Injected final travel duration / expected result | First-request ms | Warm median ms | Warm p95 ms (nearest rank, n=20) | Warm min–max ms |
| --- | --- | ---: | ---: | ---: | ---: |
| Batamindo Industrial Park → Batu Ampar | 30 min; SAFE; +30 min buffer | 35.454 | 7.403 | 9.902 | 5.369–17.507 |
| Kabil Industrial Estate → Batam Center | 45 min; SAFE; +15 min buffer | 7.342 | 5.458 | 6.659 | 4.835–7.915 |
| Hang Nadim Airport → Sekupang | 60 min; RISKY; +0 min buffer | 9.152 | 5.530 | 9.409 | 4.748–9.454 |

These are **hypothetical dated fixture sailings/service permissions and synthetic durations**, even though the coordinates come from the shared catalog. They do not establish real services, cargo eligibility, route geometry, freshness, traffic or verified gates for these pairs. The source cutoff is explicit and not replaced by an invented margin.

Each scenario separately injected schedule outage, timeout exception and malformed response, yielding **3 controlled 503s each, 9 total**. Their individual durations/error codes are retained separately in JSON and excluded from success percentiles. Injected timeout exceptions return immediately; this does not measure a real timeout wait. The missing live endpoint/network/dependency latency remains **PENDING**, and no production performance/SLA claim follows from these measurements.

## D6-04 through D6-07 — Prepared material and remaining gaps

- [Usability results](../reports/USABILITY_RESULTS.md) explicitly records **0 sessions**, no scores, no observations. [Blank template](../evidence/sprint-6/observation-template.json) contains nulls only; it is not a respondent record. The user confirmed institutional/participant readiness is pending. Follow the exact custom formative instrument and consent/retention rules in the existing protocol before genuine collection.
- [Issue register](../evidence/sprint-6/issues.json) links the original 7 lint errors, U4 setup gap and later observed schedules hydration error to minimal fixes and actual passing retests. Current full lint has 0 errors/16 warnings. Future real integration/usability observations can still require fixes/retests.
- [BAB III/BAB IV evidence map](../reports/REPORT_EVIDENCE_MAP.md) links design, sequence, formulas, API examples, actual synthetic results/screenshots and timings. Real integration/usability findings and commit/release references are explicitly absent. Model training/accuracy is not attributed to Ananda.
- [Environment/release guide](../reports/VALIDATION_ENVIRONMENT.md) records synthetic setup, approved read-only integration prerequisites, positive server parameters, planned backend-before-frontend release order, and rollback prerequisites. Release IDs, real operational verification and exercised rollback are not supplied; no release or rollback was executed.

D6-05 is checked for the current observed fixes and passing retests; all other D6 task checkboxes remain unchecked because their full acceptance evidence is pending. This does not erase the passing offline portions above. The feature is not marked fully complete or operationally verified.

## Files and boundaries

The initial run changed only `docs/departure/README.md`, added this report, report/preparation documents, and sanitized `docs/departure/evidence/sprint-6/` drivers, matrices, logs, captures, screenshots, preflight/readiness/issues and cleanup records. The pre-existing staged Sprint 5 application/plan/evidence files were not reset, restaged or committed. The initial run modified no app code. The follow-up changes four frontend app files, the UI fixture and browser/evidence scripts as listed below. No backend, frozen contract/policy/design/fixture definition, model, owner service, schema or dependency manifest/lockfile was modified.

Both temporary servers were stopped via SIGINT after the browser run; [cleanup proof](../evidence/sprint-6/process-cleanup.json) confirms no listeners on ports **3011/9011**. Browser contexts were closed. No `.env` file was read/printed, no live write or deployment performed, and no commit created.

## Earlier documentation continuation — historical

Continuation on 24 October 2026: prepared a [D6-04 moderator guide](../reports/USABILITY_SESSION_GUIDE.md), preserving the existing protocol and custom instrument. Source review identified **S6-FIXTURE-01**: at that time the UI fixture rejected overnight plans with different road/service dates and has no source-zone control. A complete U4 UI scenario must be prepared and verified before participant collection; the existing delayed-request test covers only part of U4. Readiness/results/issue records now disclose this preparation gap. No application code changed, servers started, new browser/application tests run, or participant observations collected during this continuation. Earlier execution results above remain historical to their recorded run.

[Continuation checks](../evidence/sprint-6/continuation-checks.json): the read-only `python3 -` evidence audit passed (11 existing JSON files, 431 recorded passing XML cases, 26 recorded browser groups, 63 relative links, all seven D6 tasks unchecked, zero participant sessions). `python3 -m json.tool` passed separately for `usability-readiness.json` and `issues.json`; `git diff --check` passed. `lsof -nP -iTCP:3011 -iTCP:9011 -sTCP:LISTEN` returned exit 1 with empty output, confirming no listeners. These are documentation/evidence checks, not fresh application execution.

Resume **D6-02** when an approved non-production setup and authorized read-only inputs exist. Keep **D6-04/DEP-14** pending until actual consented sessions and institutional requirements are ready. The original full-lint errors have now been fixed in the ordered follow-up. Then rerun affected gates, fill genuine integration/usability findings and close only the task checkboxes whose full checks pass. No Sprint 7 work is authorized by this report.

## Ordered follow-up — fixture and evidenced fixes

24 October 2026, Asia/Jakarta. User authorized clearing the proposed steps in order. **Steps 1–3 are now complete under synthetic verification. Steps 4–6 require the previously confirmed missing live access and real participant evidence.** No live request or participant collection was substituted with fixtures.

1. **U4 preparation:** added two explicitly dated simulation modes to `frontend/scripts/departure-ui-fixture.mjs`. `overnight`: road 23 October 23:50 WIB → ETA 24 October 00:20, recorded cutoff 00:40, +20 SAFE. Revising road date/time to 24 October 00:00 gives ETA 00:30, +10 RISKY; the cutoff stays fixed. `source-zone`: source departure 24 October 00:30 +08:00 → 23 October 23:30 WIB and Jakarta service date 23 October; cutoff 23:00 WIB. Editing a delayed request discards its completion; recalculation uses the revised plan. No production/backend calculation changed.
2. **Headless verification:** **5 U4 groups**, **26 departure groups**, **5 shared-fix groups**, and the existing **13 Planner/Oracle handoff regression groups** passed against the final isolated build. Zero uncaught page errors in every final run. U4 has one aborted request; departure has four. Source-zone details fit at 375 px and remain keyboard accessible; the U4 screenshot was inspected. The route fixture's external tile hosts are blocked, not treated as real map/network evidence.
3. **Evidenced frontend fixes:** `S6-LINT-01` initial schedules reads now update state from asynchronous completion, with an unmount guard; refresh remains event-driven. `S6-LINT-02/03` auth catches narrow `unknown` errors, unused response values were removed, and the existing apostrophe is escaped. `S6-LINT-04` mobile state uses a `matchMedia` subscription with a stable server snapshot. The shared browser run then exposed **S6-UI-01**, a schedules React hydration error caused by default server/browser date formatting. Its display now uses a hydration-stable snapshot with explicit WIB formatting and a minute subscription. The actual synthetic midnight transition and mobile breakpoints 767/768/375 px pass. No ESLint rule was disabled.

The first shared run had four successful assertions but an uncaught page error, so it was correctly marked **failed**. The diagnostic repeat captured React #418 on `/schedules`. Both attempts remain in `shared-browser-attempt-1/2.json` and logs. After the fix, all five shared groups passed with zero page errors. The first lint-fix attempt still had one error; `full-lint-after-fixes.log` retains it. The final full lint passes with **0 errors/16 existing warnings**. Warnings remain outside this minimal fix scope.

| Follow-up command | Actual result / evidence |
| --- | --- |
| `node scripts/prepare-departure-check.mjs` (`frontend/`) | Created `/private/tmp/departure-sprint5-kW8D9G`; `.env*` excluded. All **79** current `frontend/src` files match the final tested copy. |
| `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/departure-headless-d5-06/browsers node docs/departure/evidence/sprint-6/run_browser.mjs --u4` | Exit 0; **5 passed**, `u4-browser-acceptance.json/.log`. |
| Same browser command with `--shared` | Exit 0; **5 passed**, `shared-browser-acceptance.json/.log`. |
| Same browser command without a flag | Exit 0; **26 passed**, `browser-acceptance.json/.log`. |
| Same browser command with `--route` | Exit 0; **13 passed**, `route-browser-acceptance.json/.log`; existing synthetic Oracle fixture substituted on 9011. No Sprint 7 departure integration implemented. |
| `npm run lint` (`frontend/`) | Exit 0; **0 errors/16 warnings**, `full-lint-final.log`. |
| `npx --no-install tsc --noEmit --incremental false` (`frontend/`) | Exit 0; `typecheck-after-fixes.log`. |
| Scoped ESLint in `follow-up-verification.json` | Exit 0; **0 errors/warnings**, `scoped-lint-after-fixes.log`; covers departure, changed hook/schedules UI and added fixture checks. |
| `node scripts/check-departure.mjs` / `node scripts/check-route-integration.mjs` (`frontend/`) | Both exit 0; **18/8 groups**, `*-helpers-after-fixes.log`. |
| `.venv/bin/python docs/departure/evidence/sprint-6/build_matrix.py` | Exit 0; **13 synthetic pass / 0 failed / 1 pending**, DEP-14 still pending. Backend's earlier 431 passes remain historical; backend unchanged and not rerun in this follow-up. |
| `node --check docs/departure/evidence/sprint-6/run_browser.mjs` | Exit 0. |

Final build, from `/private/tmp/departure-sprint5-kW8D9G/frontend`:

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9011 NEXT_PUBLIC_SUPABASE_ANON_KEY=synthetic-local-key NEXT_PUBLIC_API_URL=http://127.0.0.1:9011 NEXT_TELEMETRY_DISABLED=1 npm run build -- --webpack
```

Exit 0, `/departure` included, 12 static pages; `build-after-hydration-fix.log`. The initial fresh-copy build failed Google Fonts DNS in the sandbox (`build-after-fixes.log`); the approved network retry succeeded (`build-after-fixes-retry.log`). No npm install, dependency/lockfile change or `.env` access occurred. Existing Next middleware/Edge import warnings remain.

Changed frontend files: `scripts/departure-ui-fixture.mjs`, new `scripts/check-departure-u4-ui.js` and `scripts/check-departure-shared-ui.js`, `src/hooks/use-mobile.ts`, `src/app/(dashboard)/schedules/page.tsx`, `src/app/login/page.tsx`, and `src/app/register/page.tsx`. Updated the Sprint 6 runner, evidence/status/issue records, moderator/results/environment/evidence documents, feature README, and the **D6-05 checkbox only**. The frozen protocol, contracts, policy and Sprint 1 fixture definitions are unchanged. Backend, owner services and database remain unchanged; no commit or deployment.

[Follow-up verification](../evidence/sprint-6/follow-up-verification.json) includes exact commands, final result references, source hashes and copy comparison. Both temporary servers were stopped via SIGINT after the final regression; `lsof -nP -iTCP:3011 -iTCP:9011 -sTCP:LISTEN` returned exit 1 with empty output (no listeners).

## Next step — external prerequisites

**Technical priority:** finish D6-02 using an approved non-production URL/setup reference, securely supplied configuration and authorized read-only cases. These remain unavailable per the earlier user response. Once access exists, execute the real browser/API/dependency checks, fix/retest evidenced frontend issues and update technical release readiness. Report backend/contract issues without changing backend code.

**D6-04/DEP-14 are deferred by the user**, who asked to skip supervisor/institution confirmation for now and finish the feature first. No participant collection is performed, no approval is inferred, and no study task is checked complete. This deferral does not prevent coding or technical checks. The core UI/API implementation and its controlled evidence already exist; no additional mandatory implementation gap was identified in this documentation/status review. Real integration is still unverified. No application checks were rerun during this priority update, and previous results remain attributed to their actual runs. Sprint 6 remains partial; Sprint 7 has not started.

## Local setup — startup verified, authentication configuration pending

24 October 2026, Asia/Jakarta. The user selected **local** and asked to inspect the existing project folder. Started the existing, unmodified FastAPI application from `backend/`:

```sh
PYTHON_DOTENV_DISABLED=1 GEMINI_API_KEY='' ../.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8080 --no-access-log
```

The sandbox initially rejected the port bind; an approved retry started successfully. Read-only GET `/health` returned **HTTP 200, `{"status":"ok"}`**; GET `/openapi.json` confirmed POST `/departure-recommendation` is registered. Those HTTP probes also required an approved retry after sandbox network denial. [Sanitized startup evidence](../evidence/sprint-6/local-startup.json). This is actual local application startup, not synthetic Auth/API substitution, but it establishes no authenticated schedule/route result or real sign-in.

Folder inspection found `supabase/config.toml`, existing Oracle migrations, and the **presence only** of `backend/.env` and `frontend/.env.local`. No `.env` content was read. Supabase/Docker CLIs were not on PATH and no local Supabase listener was observed on 54321. The [Supabase workflow](../../../supabase/README.md) documents that these migrations extend an existing linked project; a historical base migration is missing, so the folder is not a verified complete fresh-stack bootstrap. No CLI installation, container startup, migration, schema execution or data import was attempted.

No Supabase configuration was available in exported process variables. Requested an explicit exception to the root `AGENTS.md` prohibition on `.env` reads: load the existing configuration into local processes without printing values, check configuration agreement and keep data checks read-only. Alternatively, the operator can supply separate process configuration. This approval is pending at this capture. Frontend was not started with invented credentials. Backend remains listening on **127.0.0.1:8080** without Supabase configuration; the earlier temporary 3011/9011 fixture servers remain stopped. D6-02 is unchecked; no backend/frontend application file changed in this setup step.

## Current handoff — user-managed local acceptance

The user explicitly declined the `.env` exception: **do not read or load `backend/.env` or `frontend/.env.local`**. They will start both services in their own terminals and run signed-in D6-02 manually. No exception is granted or still being requested. The previous paragraph records the earlier startup capture; the assistant-owned backend has now been stopped via SIGINT, with graceful Uvicorn shutdown observed. `lsof -nP -iTCP:8080 -sTCP:LISTEN` returned exit 1 with no output (no listener). No user-owned process was stopped, no frontend was started, and no further data/API/browser checks were run.

Prepared the [D6-02 manual checklist and paste-back template](../reports/D6_02_MANUAL_CHECKLIST.md). It distinguishes actual data gaps from successful calculations, covers selection/alternatives/auth/errors/stale state/source labels, and leaves unsupported cases pending. No account details, credentials, tokens, headers, HAR or raw logs are requested. Local backend transport failure is explicitly separate from an actual dependency 503; logout alone does not prove token-expiry behavior. No unexecuted checklist item is evidence.

Updated `live-preflight.json`, `local-startup.json`, `verification.json`, the feature README and environment/evidence guides to reflect this handoff. **D6-02 remains unchecked and pending user-pasted sanitized results.** Do not replace this gate with historical synthetic passes or the observed health check. D6-04 remains deferred. No application code, backend, frozen source, configuration value, dependency, schema, deployment or commit changed in this handoff.

## Configuration error follow-up — S6-CONFIG-01

The user reported `Invalid supabaseUrl: Provided URL is malformed` at the frontend middleware's Supabase constructor. This is a user-reported runtime failure, not a passing signed-in check. The installed SDK validates its URL with `new URL`; the actual configured value remains unknown because the user retained the prohibition on `.env` reads/loads.

Changed `frontend/src/utils/supabase/middleware.ts` to trim and validate the public settings before SDK construction. Missing/invalid configuration returns an explicit **503**, `Cache-Control: no-store`, with static setup instructions instead of an uncaught SDK error. No supplied URL/key is echoed. Invalid configuration does not allow requests through; valid configuration retains session refresh/cookies and existing protected-route redirects. Exactly one `/departure` protection entry remains. The user must still correct the effective frontend Project URL/public key and restart development (or rebuild production); this guard does not create a working Supabase configuration.

Added `frontend/scripts/check-supabase-config.mjs`: **6 offline synthetic groups passed**, using actual NextRequest/NextResponse with stubbed Auth and explicit synthetic configuration. Covers malformed/absent settings, non-HTTP URLs, credentials/query/fragment rejection, trimmed HTTP loopback/HTTPS settings, guest protection, signed-in navigation and cookie preservation. No browser/network/Auth service was invoked by these tests. Existing departure/route helpers passed **18/8** groups. `npx --no-install tsc --noEmit --incremental false` and `npm run lint` passed; full lint remains **0 errors/16 existing warnings**.

The production build passed from an isolated copy at `/private/tmp/departure-sprint5-emramH/frontend` with explicit synthetic public settings, using the same full build command recorded in [configuration-fix evidence](../evidence/sprint-6/supabase-config-fix.json). All 79 current frontend source files matched that copy. `build-config-fix.log` records the build; `supabase-config-check.log`, `departure-helpers-config-fix.log`, `route-helpers-config-fix.log`, `typecheck-config-fix.log` and `full-lint-config-fix.log` record the checks. Installed Next environment/proxy docs and installed Supabase URL-validation source were read before the change.

**Actual configuration correction and signed-in retest remain pending the user.** No `.env` file was read/loaded/edited, no service or browser was started, no user process was touched, and no backend/contract/dependency/plan-checkbox change or commit occurred. D6-02 remains unchecked; these synthetic checks do not replace manual acceptance.

Diagnostic handoff follow-up: repeated pasted inline commands contained stray escape characters and failed JavaScript parsing before any configuration verdict. Added `frontend/scripts/diagnose-supabase-config.mjs` so the user needs only one short command. Only direct operator execution loads the frontend's development environment; it prints three booleans and never values. The assistant did not run that CLI. `node --check` and scoped ESLint passed; a synthetic transpilation harness checked import/direct-CLI branches with a stubbed loader, including malformed/missing/valid inputs and absence of values in output. An initial verification harness could not replace a getter-only SDK export; the corrected harness stubs the import without touching environment files. No real URL/key was inspected, no services/browser were started, and D6-02 remains pending user results.

## 25 October — Work available while sign-in is blocked

The user reports inability to sign in; the earlier symptom was “Failed to fetch.” The current auth method, failed browser request/error and operator diagnostic booleans have not been supplied. Root cause remains unknown. This prevents D6-02 execution and real network measurements; it does not invalidate the recorded synthetic results or establish a backend calculation defect.

| Task | Progress possible without real sign-in | Remaining full-task gate |
| --- | --- | --- |
| D6-01 | Review existing DEP-01–DEP-13 synthetic coverage and connect actual new failures to fixes | DEP-14 actual participant evidence, currently deferred |
| D6-02 | Triage the user-reported login failure using sanitized operator results | Successful sign-in and the manual read-only dependency checklist; unsupported cases stay pending |
| D6-03 | Run affected offline regressions when a change or failure warrants them | Real endpoint durations and three supported scenarios with actual dependency mode recorded |
| D6-04 | Prepared protocol and fixtures remain available | User-deferred participant study; developer feedback does not complete it |
| D6-05 | Diagnose/fix/retest newly evidenced issues within authorized scope | Existing checked scope covers earlier fixes; the reported login blocker is unresolved and not yet a confirmed code defect |
| D6-06 | **Advanced now:** supplied existing commit references and verified nine recorded source hashes | Actual integration/participant findings or an explicitly agreed report scope recording their absence |
| D6-07 | **Advanced now:** documented current login triage and revision/readiness distinction | Real integration, outstanding report/evaluation evidence and actual compatible release/rollback artifact references |

[Revision traceability](../evidence/sprint-6/revision-traceability.json) verifies three existing commits, their relevant changed paths and nine SHA-256 matches against recorded source hashes. Git was clean before this documentation update. Historical `commit_created: false` and uncommitted-worktree captures are preserved as statements about their original runs. This review created no commit, ran no application checks and made no release claim. The [evidence map](../reports/REPORT_EVIDENCE_MAP.md) now supplies the revision references; the [environment guide](../reports/VALIDATION_ENVIRONMENT.md#current-sign-in-blocker--operator-triage) identifies the next sanitized diagnostic inputs.

Only documentation and revision evidence changed. No full D6 checkbox was newly closed; D6-04 stays deferred, D6-02 stays pending, and no Sprint 7 work, environment-file access, service/browser start, live write or deployment occurred.

## 25 October — Authentication diagnostic follow-up

The user now reports email sign-in, sign-up and Google login all fail; current errors and configuration verdicts are still unavailable. Source review confirms these flows share the browser Supabase client, but does not establish the root cause. No authentication bypass, new account creation, live write or application auth-code change was made.

Extended `frontend/scripts/diagnose-supabase-config.mjs` with an optional operator-only `--network` mode. It makes one unauthenticated read-only health GET with a five-second timeout, no credentials and no redirect following; it discards the response body and emits only static categories/statuses. The default three-boolean output remains unchanged. A Node HTTP response is not a verified key/provider, browser CORS result or successful login. The assistant did not execute the real CLI or load environment files.

Added `frontend/scripts/check-supabase-diagnostic.mjs`. **Six offline synthetic groups passed**, using a stubbed environment loader and injected fetch; no real settings or network. Checks cover import isolation, malformed URL skip, absence of credentials/redirects, response handling, categorized DNS/connection/TLS/timeouts and raw-error redaction. The initial harness failed while trying to assign a getter-only loader export; the replacement stubbed-import harness initially needed an async evaluation wrapper for top-level await. Both harness issues were corrected before the passing run; neither failure invoked the real loader or network.

Commands from `frontend/`: `node scripts/check-supabase-diagnostic.mjs` passed; `node --check scripts/diagnose-supabase-config.mjs` passed; `npx --no-install eslint scripts/diagnose-supabase-config.mjs scripts/check-supabase-diagnostic.mjs` passed. The [environment guide](../reports/VALIDATION_ENVIRONMENT.md#optional-operator-network-diagnostic) supplies the single operator command, interpretation limits and macOS Developer Tools steps. D6-02 remains blocked on actual operator results; no existing application regression count is relabeled as fresh and no full task checkbox was closed.
