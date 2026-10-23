# Departure Recommendation implementation sprints

Owner: **Ananda Khusnul Hotimah — 3312401044**.
Planning baseline: **23 October 2026, Asia/Jakarta**.
Status: **Sprint 1 design/fixture checks complete; Sprint 2 calculation work may begin; application implementation, regression runtime, and live-data gates remain pending**.

## 1. Context and intended result

This plan implements [Ananda’s personal context](../context/context_improve.md). A logistics/gudang operator or UMKM exporter enters an origin, destination terminal, road departure date/time, and optionally a target ferry. The system combines the relevant schedule cutoff with estimated road travel time and returns ETA, signed buffer, SAFE/RISKY/MISSED/UNAVAILABLE, reasons, and alternative sailings.

The [source audit](../sprints/SPRINT_0_AUDIT.md) distinguishes existing Planner behavior from this feature. The [original PRD](../../hackathon/PRD.md) supplies product context. Its 16-hour limit, older endpoint proposals, generic team roles, and historical demo targets do not constrain this extension or establish completed functionality.

Ananda owns the departure flow, decision service, interface, integration adapters, tests, and usability evidence. Danial owns congestion/Oracle, Khairul owns route/maps, and Chelsea owns schedule data/CRUD. Reuse their services and compatible helpers; document shared-code changes and attribution.

The required release is an authenticated page and API for on-demand recommendations. This authentication choice is a planning default aligned with the current dashboard, not a claim that existing public route/schedule endpoints require tokens. Saved departure history and Oracle integration are optional Sprint 7 work.

## 2. Sprint order and tracking

Sprints are ordered work packages, not calendar commitments. Finish each completion gate before advancing dependent work. The original planning baseline was source inspection only. Sprint 0 records fresh failed check attempts and the reuse/risk register; Sprint 1 records frozen policies, UX/protocol designs, and offline fixture/example checks. Passing application regressions, live schedule verification, and actual usability observations remain open. Unchecked tasks remain unimplemented or unverified.

| Sprint | Goal | Depends on | Demonstrable result |
| --- | --- | --- | --- |
| 0 | Audit and fresh baseline | Available source/runtime | Confirmed reuse map, baseline results, data gaps |
| 1 | Freeze contracts, data policy, and UX | 0 | Schemas/examples, decision rules, wireframe, fixture matrix |
| 2 | Build the calculation core | 1 | Deterministic ETA, buffer, statuses, latest-departure estimate |
| 3 | Integrate services and expose the API | 2 | Authenticated endpoint for a selected sailing |
| 4 | Add automatic selection and alternatives | 3 | Deterministic relevant alternatives with individual status |
| 5 | Complete the user interface | 4 | Signed-in user completes and revises a recommendation |
| 6 | Validate and prepare report evidence | 5 | Functional/regression results and actual usability evidence |
| 7, optional | Oracle tool or personal history | Core release gates | Separately tested extension |

Execution path: `0 → 1 → 2 → 3 → 4 → 5 → 6`. Early wireframes belong in Sprint 1; the full interface consumes a stable tested API in Sprint 5.

## 3. Original proposed implementation decisions

These planning proposals are retained for context. The [Sprint 1 report](../sprints/SPRINT_1_DESIGN.md), [v1 API contract](../contracts/DEPARTURE_API_CONTRACT.md), and [schedule/decision policy](../data/SCHEDULE_POLICY.md) now contain the frozen decisions and take precedence over these proposals. In particular, v1 requires destination/service kind/explicit service date, does not expand recurrence or assign real clock rows to dates, and withholds calculated statuses for Haversine or unverified route context.

### Interface and request

- Dedicated `/departure` page using the current dashboard shell, existing inputs/selects/buttons, and shared location catalog.
- Required origin coordinates or a resolved supported origin, terminal key, road departure date, and road departure time. Derive day type from the date; if accepted from a caller, validate agreement.
- Optional ferry destination and target `schedule_id`; require clarification/selection when destination or service compatibility would otherwise be ambiguous.
- Resolve terminal coordinates on the backend from a verified mapping. Do not let a schedule target one terminal while routing to another.
- Use the existing verified-auth dependency for the new endpoint; require a current session token from the client. No new auth provider or privileged credential is needed.

### Calculation and confidence

```text
ETA = planned_road_departure_at + final_time_min
buffer_min = (recorded_cutoff_at - ETA).total_seconds() / 60
latest_departure_estimate = recorded_cutoff_at - final_time_min - safety_buffer_min
```

| Condition | Outcome |
| --- | --- |
| Required schedule/cutoff/date/zone/credible duration cannot be established | UNAVAILABLE |
| buffer_min < 0 | MISSED |
| 0 <= buffer_min < safety_buffer_min | RISKY |
| buffer_min >= safety_buffer_min | SAFE |

Use a positive server-side safety buffer; proposed example/default is **15 minutes as a simulation parameter**. Validate configuration at startup. Determine status before UI rounding and preserve zero/negative buffer values.

Do not apply congestion twice: consume the route’s `final_time_min`. For the departure request, use a route-only estimate without the Planner’s cargo/ETD pair; compute the ferry cutoff in the departure service. Existing cargo-based route feasibility remains compatible and separately labeled.

Proposed conservative policy: route results with assumed/default or unavailable congestion do not establish SAFE/RISKY/MISSED; return UNAVAILABLE with the available estimate and limitation clearly separated. A valid Haversine estimate with otherwise supported inputs may be used as a simulation only if Sprint 1 explicitly permits it, with its source prominent. Never convert a timeout or malformed result into a favorable recommendation.

The backward departure estimate uses traffic at the submitted road departure time. Label that approximation and require recalculation if the user chooses it in another traffic period. A traffic-window search is a future enhancement; do not claim global optimization.

### Schedule semantics and selection

- Require validated absolute sailing/cutoff times, or an explicit project-simulation policy assigning recorded clock times to a selected date and source zone. Store/display the assumption in result metadata.
- Use a schedule’s known source zone before converting to `Asia/Jakarta`. Do not silently assume that clock-only database rows are WIB or confirmed daily sailings.
- Use explicit date/day offsets for overnight cutoff records. Ambiguous overnight rows remain unavailable until resolved.
- Initial supported horizon: the selected service date. Do not generate next-day sailings from a clock row unless a documented recurrence policy supports them.
- Preserve a user-selected sailing even when MISSED; show alternatives separately. A nonexistent target cannot silently change to another ferry.
- Proposed automatic choice: earliest SAFE sailing; otherwise earliest RISKY sailing; otherwise the latest cutoff among evaluable missed sailings on the supported date, returning MISSED. Break equal times by stable ID. Unknown-data candidates are excluded with an explicit limitation; if no evaluable candidate exists, return UNAVAILABLE.
- Alternatives must match terminal, destination, service applicability, and known service constraints. Rank feasible alternatives by departure time and stable ID; display at most three. Do not infer cargo eligibility or remaining capacity from vessel labels alone.
- Bound retrieval and computation. Document limits and avoid claiming an exhaustive automatic selection if the candidate set was truncated.

### Transport and response

- Proposed `200`: valid calculated SAFE/RISKY/MISSED or a valid request whose required domain data is unavailable, with explicit reason code.
- Proposed `422`: malformed input, unsupported terminal, date/day conflict, or a selected schedule conflicting with requested terminal/destination.
- Reuse `401` for invalid/missing user credentials and `503` for auth/dependency outage; expose safe error codes/messages. HTTP outages are not successful UNAVAILABLE calculations.
- Response: status, reason code/text, submitted plan, selected schedule, ETA, duration, signed buffer, configured threshold, latest-departure estimate when calculable, alternatives, sources, assumptions/warnings, data status, and calculation timestamp.
- Unknown fields are null, not fabricated zeros. `status` is a planning outcome; `data_status` describes provenance and is a separate field.

## 4. Sprint 0 — Audit and fresh executable baseline

**Goal:** establish what can be reused and which data/runtime limitations must be resolved.

- [x] **D0-01 — Identify personal scope.** Read the root context, retain Ananda’s ID, map required flow versus optional work, and reconcile PRD target users/scope. Evidence: this plan and source audit.
- [x] **D0-02 — Inspect existing integration.** Review router registration, route schema/calculations, schedule endpoint/schema, location catalog, auth, navigation, route protection, Oracle contract, and existing test approach. Evidence: source-audit table.
- [x] **D0-03 — Record a fresh local baseline.** Confirm runtime/dependencies without printing secrets. Run existing relevant backend route/congestion tests and frontend route helper checks. Record exact commands, failures, and whether fixtures or services were used. Do not reuse historical pass counts. **Recorded:** both commands exited 1 before assertions (missing pytest / TypeScript); this completes the baseline record, not regression verification. See [fresh evidence](../evidence/sprint-0/runtime-baseline.json).
- [ ] **D0-04 — Audit actual schedule semantics.** Inspect a sanitized read-only sample/schema when accessible; otherwise record the dependency as pending and build explicit fixtures. List terminal keys/IDs, cutoff nulls, service types, dates/recurrence, timezone, source freshness, and duplicate rows. Do not guess missing metadata. **Partial:** repository DDL/source workbook inspected; actual live schema/sample remain pending. The [audit](../sprints/SPRINT_0_AUDIT.md) defines the fixture-only boundary; D1-05 now supplies explicit synthetic fixtures without closing live acceptance.
- [x] **D0-05 — Finalize the reuse map and risk register.** Choose a shared in-process adapter versus HTTP only where needed; list blocking data gaps, proposed resolutions, test harness requirements, and shared files that may need changes. **Recorded:** in-process adapters, blocking gaps, harness requirements, and conditional shared-file changes in the [audit](../sprints/SPRINT_0_AUDIT.md).

**Files:** update `docs/departure/sprints/SPRINT_0_AUDIT.md`; store sanitized baseline outputs under `docs/departure/evidence/sprint-0/`. Application code changes are not required for the audit.

**Checks:** existing route tests retain cargo cutoff behavior, date handling, and route/Oracle parity; current helper scripts run or their runtime blocker is recorded.

**Done when:** baseline results and data unknowns are documented; any missing live access has a concrete fixture-only boundary. Live schedule acceptance remains open where unavailable.

**Current entry decision:** Sprint 1 may begin design and synthetic-fixture work under this documented boundary. D0-04 live acceptance stays open; unknown required metadata must remain unavailable. Restore the runtime and rerun the recorded checks before claiming regression preservation. No Sprint 1 task has been completed by the Sprint 0 audit.

## 5. Sprint 1 — Contract, data policy, and UX design

**Goal:** remove ambiguity before authoring the decision service.

- [x] **D1-01 — Write the user flow and wireframe.** Cover terminal/destination/target selection, road departure date/time, result review, alternatives, and revision. Include mobile layout, keyboard order, and every empty/error/unavailable state. Evidence: [user flow](../design/USER_FLOW.md), [wireframes](../design/WIREFRAME.md).
- [x] **D1-02 — Freeze the departure contract.** Specify required/optional fields, IDs, timezone-aware timestamps, nullable values, reason codes, transport semantics, auth, input bounds, and response limits. Include selected-sailing and automatic-selection examples. Evidence: [v1 contract](../contracts/DEPARTURE_API_CONTRACT.md), [five synthetic examples](../contracts/DEPARTURE_API_EXAMPLES.json).
- [x] **D1-03 — Freeze normalization and mapping.** Map supported terminal keys to catalog IDs. Define clock-to-occurrence rules, supported service date/horizon, timezone/recurrence assumptions, cutoff validity, service compatibility, and how unknown metadata is represented. Record dependencies requiring Chelsea’s verified data. Evidence: [schedule policy](../data/SCHEDULE_POLICY.md); unknown live semantics remain unavailable.
- [x] **D1-04 — Freeze decision and selection policies.** Confirm safety-buffer config, exact boundary behavior, confidence/fallback policy, preserved target, automatic choice, alternative ranking, and backward-estimate limitations. Evidence: [decision policy](../data/SCHEDULE_POLICY.md); finite positive 15-minute simulation default, one-date horizon, bounded selection.
- [x] **D1-05 — Prepare representative fixtures.** Include all four statuses, zero/threshold boundaries, missing cutoff, unknown zone/date, overnight data, incompatible service, duplicate time/IDs, dependency failure, and already-adjusted route duration. Evidence: [66 synthetic definitions](../../../backend/tests/fixtures/departure_cases.json), [offline consistency results](../evidence/sprint-1/design-validation.json); no service execution claimed.
- [x] **D1-06 — Define the usability protocol.** Plan representative participant criteria, tasks, success/error/time measures, a short documented ease/clarity questionnaire, consent/anonymization, and storage of observations. Record target sample size as a plan; confirm any supervisor-required instrument before collection. Evidence: [protocol](../reports/USABILITY_PROTOCOL.md); five participants planned, none recruited/tested, institutional confirmation remains a collection prerequisite.

**Proposed files:** `docs/departure/contracts/DEPARTURE_API_CONTRACT.md`, `docs/departure/design/USER_FLOW.md`, `docs/departure/design/WIREFRAME.md`, `docs/departure/data/SCHEDULE_POLICY.md`, `docs/departure/reports/USABILITY_PROTOCOL.md`, `backend/tests/fixtures/departure_cases.json`.

**Checks:** manually work through fixture arithmetic and request/response consistency; verify that every DEP-01–DEP-14 criterion has an assigned sprint/test. No fixture is represented as a real sailing.

**Done when:** the developer can implement without inventing dates, zones, cutoffs, thresholds, selection rules, or auth behavior. Unresolved live data can remain unavailable under an explicit tested policy.

**Recorded result:** [Sprint 1 design report](../sprints/SPRINT_1_DESIGN.md). Offline expectation checks passed for 66 fixture definitions and five examples, with DEP-01–DEP-14 ownership mapped. This is design closure, not application test/live-data/usability acceptance. Sprint 2 may start the typed pure calculation core with injected synthetic inputs; establish a runnable environment before claiming executable results. No Sprint 2 implementation has started.

## 6. Sprint 2 — Calculation core and typed models

**Goal:** calculate a recommendation correctly from normalized inputs, independently of networks and UI.

- [x] **D2-01 — Add typed models.** Define request, normalized schedule occurrence, route estimate, result, alternatives, provenance, and reason codes. Validate finite numbers, coordinate coverage, date/time/day consistency, supported IDs, and a positive safety buffer.
- [x] **D2-02 — Implement ETA and signed buffer.** Use compatible aware datetimes and validated duration; apply the route’s congestion adjustment once. Validate cutoff before sailing departure and retain original timestamp/source metadata.
- [x] **D2-03 — Implement the four-state classifier.** Keep missing-input/data reasons explicit; apply boundaries before display rounding; do not use truthiness for zero values.
- [x] **D2-04 — Implement latest-departure estimate.** Subtract travel duration and safety buffer from recorded cutoff; include its fixed-duration assumption. Do not claim to have searched future traffic windows.
- [x] **D2-05 — Verify arithmetic and confidence rules.** Test SAFE/RISKY/MISSED/UNAVAILABLE, zero and exact threshold, fractional-minute boundaries, negative/nonfinite duration, midnight/date changes, source-zone conversion, invalid cutoff ordering, and default/unavailable congestion.

**Proposed files:** `backend/schemas/departure_recommendation.py`, `backend/services/departure_recommendation.py`, `backend/departure_config.py`, `backend/tests/test_departure_calculation.py`, `backend/tests/test_departure_contracts.py`. Reuse `route_planning.py` and `locations.py` where their existing semantics fit.

**Checks:** pure unit/schema tests without real Supabase/OSRM/Gemini. Inject configuration and route/schedule values so test outcomes are deterministic.

**Done when:** all core fixtures pass and each result can be explained from its inputs and rule. No external call is required to validate the classifier.

**Recorded result:** [Sprint 2 report](../sprints/SPRINT_2_REPORT.md): 143 new pure calculation/schema checks and 37 existing route checks passed, with dotenv disabled and outbound connections blocked. All 43 in-scope Sprint 1 fixture cases passed; HTTP/I/O, target lookup, repository, and selection cases remain assigned to later sprints. Configuration startup wiring, service adapters, and verified live-data/provenance gates remain Sprint 3 work.

## 7. Sprint 3 — Service adapters and selected-sailing API

**Goal:** expose one complete backend recommendation for an explicitly selected sailing.

- [ ] **D3-01 — Add a schedule adapter.** Read/filter existing schedule data via a reusable service boundary; normalize records to the frozen contract. Distinguish empty success, absent target, conflicting target, malformed rows, and database outage. Bound reads and avoid leaking raw exceptions.
- [ ] **D3-02 — Add a route adapter.** Resolve the chosen terminal to a known point and call the route service with origin/date/time/day, without cargo-derived cutoff overrides. Validate `RouteData`, consume `final_time_min`, and propagate route/congestion limitations. Prefer reuse within this FastAPI process over a self-HTTP request.
- [ ] **D3-03 — Make dependency budgets explicit.** Define timeouts and total request budget. Inspect existing synchronous route/DB behavior; implement bounds where the I/O happens. Merely timing out an outer coroutine is insufficient for blocking work. Add no hidden unlimited retry.
- [ ] **D3-04 — Implement and register the endpoint.** Add `POST /departure-recommendation`, verified auth, typed request/response, safe transport errors, and calculation metadata; wire it in `backend/main.py`.
- [ ] **D3-05 — Test the HTTP boundary.** Use FastAPI TestClient with injected dependencies for valid selected-sailing results, missing/invalid tokens, auth outage, validation errors, terminal/schedule mismatch, missing schedule data, route timeout, DB outage, malformed responses, and source labels.
- [ ] **D3-06 — Check real dependencies read-only when available.** Record a selected-sailing request with valid date/zone policy and sanitized source metadata. If production records lack required metadata, demonstrate the explicit unavailable outcome and keep fixture success separate.

**Proposed files:** `backend/services/departure_dependencies.py`, `backend/routers/departure_recommendation.py`, `backend/main.py`, `backend/tests/test_departure_api.py`, `backend/tests/test_departure_dependencies.py`; reuse `backend/auth.py` without changing other endpoints’ auth policies.

**Checks:** new endpoint suite plus existing route/Oracle parity, route visualization, and congestion regression tests affected by shared code.

**Done when:** selected-sailing API tests pass; authentication and outages cannot masquerade as a valid recommendation. Any missing real-data acceptance is recorded before release.

## 8. Sprint 4 — Automatic selection and alternative schedules

**Goal:** help the user choose a relevant sailing without obscuring a missed target.

- [ ] **D4-01 — Implement candidate filtering.** Apply terminal, destination, supported date/recurrence, and known service constraints before ranking. Preserve meaningful distinctions between no records, invalid records, and all missed cutoffs.
- [ ] **D4-02 — Implement automatic choice.** Apply the Sprint 1 SAFE → RISKY → missed policy, stable tie-breakers, and explicit exclusion reasons for unevaluable data. Do not switch a supplied target implicitly.
- [ ] **D4-03 — Evaluate and rank alternatives.** Compute candidate-specific cutoff, buffer, and status; cap returned alternatives at three and disclose candidate-set bounds. Reuse one route estimate only when origin/terminal/road departure are identical.
- [ ] **D4-04 — Define alternative selection behavior.** Choosing another sailing keeps the current road departure unless the user changes it; recalculate through the backend. If suggesting a new road departure, expose the fixed-period assumption and require recalculation.
- [ ] **D4-05 — Test ranking and edge cases.** Cover missed target with later SAFE alternative, only RISKY candidates, all missed, duplicate departure clocks, mismatched destination/service, no alternatives, invalid candidate metadata, and unsupported next-day recurrence.

**Proposed files:** extend `backend/services/departure_recommendation.py`, `backend/schemas/departure_recommendation.py`, and `backend/tests/test_departure_alternatives.py`; update the API contract/examples.

**Checks:** candidate-specific math, stable repeat results, correct source metadata, and a fixed upper bound on reads/calculations; no route call per candidate when route inputs are identical.

**Done when:** automatic and explicit-target results follow the documented policy; alternative lists contain only evaluated matching sailings and preserve the original target result.

## 9. Sprint 5 — Complete the departure interface

**Goal:** let a signed-in user submit, understand, revise, and recalculate the complete flow.

- [ ] **D5-01 — Add page and navigation.** Implement `/departure`, sidebar entry, and route title where required. Extend the explicit protected-route list. Follow `frontend/AGENTS.md` and consult installed Next.js guides before code changes.
- [ ] **D5-02 — Add typed client and runtime parsing.** Define departure types and validate API values, status variants, nulls, arrays, timestamps, and limits. Send the current session token; reuse existing auth/API patterns without coupling the feature to Oracle chat state.
- [ ] **D5-03 — Build the form.** Use supported origins/coordinates, terminal/destination, required date and road time, and target sailing selection. Preserve actual schedule ID/cutoff/terminal binding; the existing clock-copy picker alone is insufficient. Derive day type and show WIB explicitly.
- [ ] **D5-04 — Build the result and alternatives.** Display ferry departure, recorded cutoff, ETA, signed buffer, status/reason, threshold, latest-departure estimate, and source/assumption labels. Present independent alternatives and a clear recalculate action.
- [ ] **D5-05 — Handle lifecycle and failures.** Provide loading/stop/retry, validation, empty, unavailable, expired-session, and service-error states. Invalidate results on edits; abort/ignore older requests and clear account-scoped state on logout/account change. No stale SAFE card after changed inputs or a failure.
- [ ] **D5-06 — Verify browser behavior.** Use deterministic Auth/API fixtures to exercise all statuses, alternative selection, malformed responses, delayed requests, invalid input, logout, and mobile/keyboard navigation. Capture desktop/mobile screenshots and inspect the actual layout.

**Proposed files:**

```text
frontend/src/app/(dashboard)/departure/page.tsx
frontend/src/components/departure/DepartureRecommendation.tsx
frontend/src/components/departure/DepartureForm.tsx
frontend/src/components/departure/DepartureResult.tsx
frontend/src/components/departure/AlternativeSchedules.tsx
frontend/src/hooks/use-departure-recommendation.ts
frontend/src/types/departure.ts
frontend/src/lib/departure-api.ts
frontend/src/lib/departure-contract.ts
frontend/src/components/layout/Sidebar.tsx
frontend/src/components/layout/Topbar.tsx             # only if route title mapping needs it
frontend/src/utils/supabase/middleware.ts
frontend/scripts/check-departure.mjs
frontend/scripts/departure-ui-fixture.mjs
frontend/scripts/check-departure-ui.js
```

**Checks:** TypeScript, targeted ESLint, production build, new helper/browser checks, and the existing route helper/browser checks when shared code changed. Reuse current script conventions; a new framework is not required.

**Done when:** the full browser flow works against controlled fixtures, invalid responses cannot render credible recommendations, and responsive/keyboard behavior is inspected. Fixture success is not live acceptance.

## 10. Sprint 6 — Acceptance, usability, and report evidence

**Goal:** verify the integrated result and document what the evidence supports.

- [ ] **D6-01 — Run the functional acceptance matrix.** Execute every DEP-01–DEP-14 scenario from the personal context, record inputs/expected/actual/pass/fail, and link failures to fixes.
- [ ] **D6-02 — Run signed-in dependency acceptance.** Exercise browser → authenticated departure API → schedules/route with approved read-only real inputs. Show valid result or correct unavailability, alternatives where data supports them, expiry/failure behavior, and source labels. Keep real-data gaps open rather than substituting fixtures.
- [ ] **D6-03 — Run relevant regressions and measure latency.** Run affected backend and frontend gates. Measure actual endpoint durations with environment, sample count, cold/warm conditions, and dependency mode; report failures separately. Three distinct supported origin/terminal scenarios provide a PRD-aligned demo, subject to available data.
- [ ] **D6-04 — Conduct the usability study.** Recruit actual participants under the Sprint 1 protocol; observe completing a plan, explaining status/cutoff, selecting an alternative, and revising a plan. Record actual completion, errors, timing, questionnaire responses, and qualitative findings. The developer cannot mark this complete without real participants.
- [ ] **D6-05 — Fix and retest evidenced issues.** Connect each change to an observed issue. Recheck calculation or interaction tests affected by a fix; repeat participant testing only when warranted and record its scope.
- [ ] **D6-06 — Prepare BAB III/BAB IV evidence.** Assemble user flow, wireframe, sequence diagram, formulas/decision table, API examples, screenshots, functional outputs, timings, usability findings, limitations, and attributable commits. Separate project simulation from real data and intended behavior from actual results.
- [ ] **D6-07 — Close documentation and release readiness.** Update feature README, contracts, completed task IDs, environment/configuration guide, and known limitations. Document backend-before-frontend release order and application rollback. Deploy only under the applicable user authorization and environment policy.

**Proposed files:** `docs/departure/sprints/SPRINT_6_ACCEPTANCE.md`, `docs/departure/reports/REPORT_EVIDENCE_MAP.md`, `docs/departure/reports/USABILITY_RESULTS.md`, `docs/departure/evidence/sprint-6/`, plus fixes in affected files.

**Checks:** fresh automated results, inspected desktop/mobile screenshots, genuine authenticated integration records, and actual anonymized usability observations. Historical Oracle passes do not satisfy these checks.

**Done when:** core criteria have actual evidence, no critical calculation/access/stale-result defects remain, and missing live-data/usability gates are resolved or explicitly reported as incomplete. Do not mark the full feature complete solely because controlled tests pass.

## 11. Optional Sprint 7 — Oracle integration or personal history

Start only after the core release, and treat each extension as a separate scoped change.

- [ ] **D7-01 — Add the departure tool with Danial.** Reuse the tested departure schema/service, add the explicit tool registry entry, define clarification inputs, and retain backend status authority.
- [ ] **D7-02 — Add a departure result contract.** Extend backend/frontend discriminators, runtime validation, cards/details, and persisted result handling together. Verify older results, replay, and saved-history compatibility; do not rename existing route fields.
- [ ] **D7-03 — Test Oracle consumption.** Check valid arguments, missing input clarification, unknown schedule, dependency failure, persisted departure results, and saved-result rendering. Real provider tests remain separate from fixtures.
- [ ] **D7-04 — Add personal departure history only if selected as a requirement.** Audit existing storage, design additive schema/RLS, derive identity from verified auth, preserve snapshot provenance, and test cross-user isolation and refresh. No conversation-table reuse by default.

**Done when:** the selected extension has its own passing contract/security/regression checks and evidence. Optional checkboxes do not block the core release.

## 12. Acceptance coverage map

| Personal-context case | Implementation tasks | Final verification |
| --- | --- | --- |
| DEP-01 SAFE, DEP-02 RISKY, DEP-03 MISSED | D2-02–D2-05, D3-05 | D5-06, D6-01 |
| DEP-04 no relevant schedule | D3-01, D4-01–D4-02 | D5-06, D6-01 |
| DEP-05 invalid input | D1-02, D2-01, D3-05 | D5-03/D5-06, D6-01 |
| DEP-06 dependency failure | D3-01–D3-05 | D5-05/D5-06, D6-01–D6-02 |
| DEP-07 missing cutoff | D1-03, D2-03, D3-01 | D5-06, D6-01 |
| DEP-08 relevant alternative | D4-01–D4-05 | D5-04/D5-06, D6-01 |
| DEP-09 midnight/timezone | D1-03, D2-02/D2-05 | D3-05, D6-01 |
| DEP-10 exact zero/threshold | D2-03/D2-05 | D5-06, D6-01 |
| DEP-11 no duplicate multiplier | D2-02/D2-05, D3-02 | D6-01 |
| DEP-12 stale response | D5-05–D5-06 | D6-01 |
| DEP-13 all sailings missed | D4-02/D4-05 | D5-06, D6-01 |
| DEP-14 usability | D1-06, D5-06 | D6-04–D6-06 |

## 13. Runtime, configuration, and migration approach

- Backend local port: **8080**. Frontend: **3000**. `NEXT_PUBLIC_API_URL` points to the backend. Confirm runtime availability in Sprint 0 rather than assuming installed environments exist.
- Existing Supabase URL/anon-key configuration supports reference reads and verified auth. The initial feature adds no required AI-provider credential and makes no direct Gemini call.
- Proposed new backend config: `DEPARTURE_SAFETY_BUFFER_MIN` with a validated positive simulation default documented in Sprint 1. Keep candidate/alternative limits and schedule policy server-owned and documented.
- Do not put secrets into evidence, fixtures, or frontend variables. Use synthetic identities in automated tests.
- No new feature table is required for on-demand calculations. Schedule metadata additions, if necessary, are coordinated with Chelsea and use additive migrations after actual-schema comparison. Keep migrations conditional on a demonstrated data need.
- Never run the destructive `backend/database/schema.sql` as an upgrade. Do not make live writes or deploy merely to complete a planning task.
- Typical future local checks: `python -m pytest tests/test_departure*.py` from `backend`, existing route/congestion regression modules, `node scripts/check-departure.mjs` from `frontend`, `npx tsc --noEmit --incremental false`, targeted ESLint, and `npm run build`. Resolve the actual Python/runtime first; these are planned commands, not executed results. Browser checks need their documented fixture server and available browser runtime.

## 14. Sprint report and next action

Every sprint report records completed task IDs, resulting behavior, files changed, actual commands/results, fixture versus live scope, migrations/configuration, unresolved decisions, and next-sprint prerequisites. Keep failed or pending gates visible.

Suggested next implementation prompt:

```text
Read docs/departure/README.md, docs/departure/context/context_improve.md sections 11 and 17, and the Sprint 1 report, v1 contract, schedule/decision policy, and synthetic fixtures. Execute Sprint 2 only: D2-01 through D2-05, using typed testable backend calculation/configuration modules with injected normalized inputs. Establish an explicit compatible backend dependency environment and record actual calculation/schema and applicable regression results with dotenv disabled. Do not redo Sprint 0, infer live occurrence metadata, multiply congestion twice, replace recorded cutoffs, or implement Sprint 3 adapters/endpoint, Sprint 4 selection, Sprint 5 UI, or optional Oracle/history. Preserve ownership and user edits; do not read .env, run destructive schema scripts, write live data, deploy, or commit without instruction. Report files, exact commands/results, remaining live/provenance/runtime gates, and Sprint 3 prerequisites.
```
