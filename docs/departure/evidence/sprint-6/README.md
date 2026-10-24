# Sprint 6 evidence — SYNTHETIC SIMULATION / pending real gates

24 October 2026, Asia/Jakarta. [Sprint report](../../sprints/SPRINT_6_ACCEPTANCE.md), [task status](verification.json). **Sprint 6 is not complete.** The ordered follow-up closes the U4 fixture gap and current observed issues (D6-05); final full lint passes 0 errors/16 warnings. Follow-up results are linked below. The user confirmed that real read-only integration access and institutional/participant readiness are not yet available. No live request, real sign-in, real sailing, observed traffic, usability benefit, production latency, deployment or commit is established by these artifacts.

## D6-01 — fresh functional matrix

- [ACCEPTANCE_MATRIX.md](ACCEPTANCE_MATRIX.md), [acceptance-matrix.json](acceptance-matrix.json): all DEP-01–DEP-14 rows with inputs/expected/actual/result; **13 synthetic passes / 0 failures / 1 pending (DEP-14)**. D6-01 remains partial until genuine usability evidence exists.
- [backend-acceptance.json](backend-acceptance.json): actual captured outputs and merged synthetic inputs for all **66 frozen definitions**; **63 HTTP + 3 asserted configuration rejections**. Every fixture has its executed test identity and actual outcome; no expected value is substituted for actual output. Auth-string/validation-array envelopes have no invented backend error code; `envelope_kind` is an explicitly derived classification.
- `backend-tests.xml`, `backend-acceptance.log`: **431 passing backend checks**, zero failed/skipped, 1 existing Starlette/httpx deprecation warning. This includes existing route/congestion/auth regressions. Dotenv was disabled and outbound socket connects blocked before imports.
- [browser-acceptance.json](browser-acceptance.json), `browser-acceptance.log`: **26 fresh headless UI groups passed**, 4 cancelled requests, zero uncaught page errors/external hosts. The real Next UI used a separate fake Auth/API on 9011; it was not wired to a real or ASGI backend in this run. The raw controlled malformed body is negative-test evidence rejected by the UI, not an accepted recommendation.
- [Synthetic desktop screenshot](departure-desktop.png): **synthetic simulation**, 1440 px viewport; captured and visually inspected.
- [Synthetic mobile screenshot](departure-mobile-375.png): **synthetic simulation**, 375 × 812 viewport; full-page capture inspected at native width using four crop panels. No horizontal overflow, overlap or clipping observed. Dates, labels, UUIDs, signed buffers, simulation labels and alternative actions readable. Original images unchanged. No physical-device or participant finding is implied.

The backend and browser clock/occurrence data are explicit dated synthetic scenarios, not current ferries. Exact signed and zero values/nulls are retained. Actual source-zone/midnight tests run in ASGI/backend fixtures; the UI fixture has its own documented supported scenarios.

## D6-02 / D6-04 — pending external prerequisites

- [live-preflight.json](live-preflight.json): user confirmed no approved setup. Only exported variable-presence booleans recorded; `.env` files were not read. Real auth/dependency acceptance was not attempted.
- [usability-readiness.json](usability-readiness.json): user confirmed participant/institutional readiness pending. **0 recorded sessions**. Planned sample 5 is not an achieved count.
- [observation-template.json](observation-template.json): **blank template only**, not a respondent. Q1 is per task; Q2–Q5 are recorded once at session end, following the unchanged custom protocol. All values null; no personal/consent/customer data stored. See [pending usability results](../../reports/USABILITY_RESULTS.md).
- [Moderator guide](../../reports/USABILITY_SESSION_GUIDE.md): preparation only, including task cards and exact custom questions. The previously identified **S6-FIXTURE-01** gap is now fixed: explicitly dated `overnight` and `source-zone` modes passed five headless groups. This is preparation evidence, not participant evidence.

## D6-03 — regressions and timing

- `departure-helpers.log`: **18 helper groups passed**; `route-helpers.log`: **8 existing route helper groups passed**.
- `typecheck.log`, `scoped-lint.log`: exit 0 with no diagnostics. `build.log`: fresh isolated production build passed, `/departure` included. Source comparison confirmed the tested copy matches all current `frontend/src` files.
- `full-lint.log`: initial exit 1, **7 existing errors / 19 warnings**. Retained as historical failure evidence. After minimal frontend fixes, `full-lint-final.log` passes **0 errors / 16 warnings**; no rule disabled.
- [synthetic-latency.json](synthetic-latency.json), `synthetic-latency.log`: actual in-process TestClient POST durations with fake Auth/database/OSRM/model. Three distinct catalog origin/terminal pairs; **1 first-request + 20 warm successes each (63 total)**; **3 separately injected 503s each (9 total)**. Raw samples, first/warm summaries, environment and failure codes preserved. Success percentiles exclude but do not hide failures. Imports/setup excluded; later scenarios share module/process caches. Injected timeouts are immediate exceptions, not real waited timeout durations. **Not network endpoint/production latency or cold process/model startup.** Any missing-Supabase-config log warning is expected in this dotenv-disabled fake-dependency process, not a real connection result.

## D6-05–D6-07 and cleanup

- [issues.json](issues.json): original lint issues, U4 preparation gap and observed schedules hydration issue now linked to fixes and actual retests. D6-05 checked for current issues only. New integration/usability findings can reopen it.
- [source-context.json](source-context.json): tested worktree/base HEAD context; existing staged Sprint 5 work preserved. The base commit does not claim to include this uncommitted Sprint 6 work.
- [process-cleanup.json](process-cleanup.json): both temporary servers stopped; no listeners on **3011/9011**.
- [continuation-checks.json](continuation-checks.json): later documentation/evidence consistency review passed; existing test results retained as recorded results, zero sessions and pending tasks preserved. Ports 3011/9011 rechecked with no listeners; no new application execution.
- [Evidence map](../../reports/REPORT_EVIDENCE_MAP.md), [environment/release guide](../../reports/VALIDATION_ENVIRONMENT.md): prepared report/release material with pending findings and revision/rollback IDs left explicit. No release/rollback execution claimed.

Drivers here are offline evidence utilities, not backend/frontend application changes: `run_acceptance.py` reuses the existing test harness and captures actual endpoint outputs; `run_browser.mjs` runs the existing UI script with isolated headless Chromium; `measure_synthetic_latency.py` reuses the ASGI mock harness; `build_matrix.py` generates the matrix from fresh results. Exact commands are in the Sprint report. No new project dependency, contract/policy/fixture edit, schema run or live write occurred.

## Ordered follow-up — current frontend results

[follow-up-verification.json](follow-up-verification.json) records exact commands, source hashes, and comparison of all 79 current frontend source files with the tested isolated copy. **All application data remains SYNTHETIC SIMULATION.**

- [u4-browser-acceptance.json](u4-browser-acceptance.json), `u4-browser-acceptance.log`: **5 passed**, zero page errors, one aborted request; midnight/service-date revision, Singapore source-date conversion, fixed cutoff, delayed input edits and mobile keyboard checks. [Synthetic U4 mobile screenshot](u4-mobile-375.png) inspected.
- [shared-browser-acceptance.json](shared-browser-acceptance.json), `shared-browser-acceptance.log`: **5 passed**, zero page errors. Synthetic provider-error recovery, schedules initial load/refresh, date hydration/Jakarta midnight, and mobile 767/768/375 px breakpoint behavior.
- [route-browser-acceptance.json](route-browser-acceptance.json), `route-browser-acceptance.log`: **13 existing Planner/Oracle handoff groups passed**, zero page errors, using the existing fake Oracle/route fixture on 9011. External map tile hosts blocked; no live route traffic or Sprint 7 departure integration implied.
- `browser-acceptance.json/.log` refreshed against the final build: **26 departure groups passed**, zero page errors and four cancelled requests. `departure-helpers-after-fixes.log` / `route-helpers-after-fixes.log`: **18/8 passed**.
- `typecheck-after-fixes.log`, `scoped-lint-after-fixes.log`: exit 0; `full-lint-final.log`: exit 0, **0 errors/16 existing warnings**. `build-after-hydration-fix.log`: final isolated production build passed.
- `shared-browser-attempt-1/2.json` and logs retain the failed runs with an uncaught schedules hydration error. `full-lint-after-fixes.log` retains the intermediate remaining lint error. `build-after-fixes.log` retains the sandbox Google Fonts DNS failure; approved retry succeeded. No failed check was represented as passed.

The earlier 431 backend assertions and synthetic latency samples were not rerun in this frontend follow-up. Current live/institutional/participant gates remain pending; actual participant sessions remain **0**. Final process check found no listeners on 3011/9011. No backend/contract/policy/protocol/dependency change, `.env` access, live write, deploy or commit.

## Current local handoff — pending manual results

[local-startup.json](local-startup.json) records actual local backend health/OpenAPI startup only and its later graceful shutdown; no signed-in Auth/schedule/route result is established. Port 8080 was released for the user. [live-preflight.json](live-preflight.json) now records **PENDING_USER_MANUAL_RESULTS**: the user explicitly retained the `.env` read/load prohibition and will operate their own backend/frontend and browser. Use the [manual checklist/paste-back template](../../reports/D6_02_MANUAL_CHECKLIST.md). No manual results have been supplied; D6-02 remains unchecked. Keep later user-reported evidence separate from assistant-observed startup and synthetic evidence.
