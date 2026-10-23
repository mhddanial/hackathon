# Departure Recommendation source audit

23 October 2026, Asia/Jakarta. Owner: Ananda Khusnul Hotimah, 3312401044.

The original source-inspection baseline is retained below. The 23 October 2026 follow-up covers only D0-03, D0-04, and D0-05: fresh runtime/check attempts, read-only schedule source inspection, and the final reuse/risk register. Live database inspection, authenticated browser checks, deployment, and participant testing were not performed. Historical verification counts in Oracle documentation belong to their dated runs.

## Interpreted context

The root `context_improve.md` identifies Ananda as the end-to-end owner of Departure Recommendation. Its core outcome is a user-submitted road departure plan evaluated against a ferry schedule’s cutoff, returning ETA, signed buffer, status, reasons, sources, and relevant alternatives. UI/UX and usability evaluation are part of her contribution.

Danial supplies congestion and owns Oracle; Khairul supplies routes/maps; Chelsea supplies schedules and their management. Ananda owns the integration and decision rules. Model training, schedule CRUD, route-engine replacement, Oracle conversation storage, and emissions research are outside her core sprint backlog.

Persistent departure history and an Oracle departure tool are optional in the personal context. Neither is necessary to demonstrate the first complete feature.

## Sources and precedence

| Source | Use in this plan |
| --- | --- |
| Root `context_improve.md` | Current personal scope, identity, requirements, formulas, acceptance criteria, and report structure |
| Revised team feature plan summarized in the context | Ownership and the four recommendation outcomes |
| `docs/hackathon/PRD.md` | Logistics/gudang operators and UMKM exporters, reducing uncertainty around departure/cutoff planning, historical demo scope |
| `docs/hackathon/TECH.md`, `TASK.md`, `methodology_notes.md` | Historical design, sequencing, and data-source claims; verify before adopting |
| `docs/oracle/context/CURRENT_STATE.md` and `contracts/ORACLE_API_CONTRACT.md` | Current documented shared contracts, provenance, regression boundaries, and acceptance limits |
| Executable files listed below | Checked-in behavior and integration opportunities |
| Existing tests and frontend check scripts | Reusable test approach and regression scenarios; not newly executed results |

Current code establishes the existing API shape; the personal context and revised team scope define the intended feature. Older drafts do not override either. Conflicts become explicit design decisions in Sprint 1.

The PRD’s proposal for `GET /route` with a departure window in the historical technical design differs from today’s `POST /route` with a requested time. Its original team roles also differ from the revised named ownership. Its agent success percentage is a historical demo target, not a departure metric or measured result. Its real-world research figures are not independently validated by this audit.

## Existing behavior and gaps

| Area and inspected files | Existing behavior | Gap for Ananda |
| --- | --- | --- |
| `backend/main.py` | Registers route, schedules, congestion, agent, and user routers | No departure recommendation router is registered |
| `backend/routers/route.py`, `backend/schemas/route.py` | Coordinates, supported Batam envelope, explicit date/day handling, OSRM/Haversine routing, congestion-adjusted duration, optional ETA/slack and cargo gate-in estimate | No schedule-specific four-status decision or alternative-sailing engine |
| `backend/route_planning.py` | Clock validation and timezone-aware Batam planning helpers | Need a normalized ferry occurrence, source-zone policy, and midnight cutoff semantics |
| Cargo cutoff calculation in route router | Subtracts 120 minutes for CONTAINER or 60 for FAST_FREIGHT from vessel ETD; zero slack counts as feasible | A recorded ferry cutoff must remain authoritative for this feature; zero buffer is RISKY under the personal context |
| Route congestion helper | Separate route-owned inference/default behavior; may return null level and a 1.0 assumption | Decide what confidence permits a status; do not assume public `/congestion` fallback rules apply here |
| `backend/routers/schedules.py` | `GET /schedules` returns `{schedules: [...]}`; empty rows succeed; exceptions become HTTP 500 | Need typed normalization, safe error mapping, bounded selection, and explicit missing-data outcomes at the departure boundary |
| `backend/database/schema.sql` | Schedule UUID, terminal fields, destination, clock departure, nullable cutoff, vessel type, cargo capacity | Checked-in schema has no service-date/operating-day/source-timezone fields; live schema remains unverified |
| `backend/data/batam-locations.json`, `backend/locations.py` | Named Batam origins and representative points for Batam Center, Sekupang, Batu Ampar | Need explicit mapping of schedule terminal IDs/keys to supported location IDs; do not guess unsupported terminal gates |
| `frontend/src/components/planner/RecordedSailingPicker.tsx` | Copies only a recorded departure clock into a Planner form, warns about unknown freshness/time zone | Does not preserve selected schedule identity, recorded cutoff, terminal binding, or service date |
| Planner hook, route API/types/parser, and `RoutePlanner.tsx` | Validated route inputs/results and cancellation/stale-response patterns | Need a departure-specific typed client, status/result components, alternatives, and fixtures |
| `frontend/src/utils/supabase/middleware.ts` | Protects `/dashboard`, `/planner`, `/schedules`, `/oracle` explicitly | New `/departure` would need an explicit protection entry; dashboard route grouping alone does not provide this check |
| `backend/auth.py` | Verifies Supabase identity with controlled 401/503 handling and a request-scoped JWT client | Can be reused for the proposed authenticated departure API; existing route/schedules APIs are public |
| App sidebar and dashboard layout | Shared navigation and responsive shell | Need a Departure Recommendation navigation entry and route title handling where applicable |
| Oracle tool registry and result contract | Supports congestion, schedule, route, and generic results | Departure tool/result variant is absent; keep it optional until the service is tested |
| Backend `tests/`, frontend `scripts/` | pytest-style backend coverage; Node helper checks and browser fixture scripts | No departure-specific suite was found in the inspected inventory |

## Decisions to resolve before implementation

1. Choose `/departure` as the proposed dedicated feature page while reusing the existing dashboard shell. Confirm this through Sprint 1 design documentation.
2. Use a required road departure date and time; derive day type or reject an explicit mismatch.
3. Define how a clock-only schedule is applied to a service date. Require source metadata or an explicit documented project-simulation policy; unknown semantics must remain unavailable.
4. Map schedule terminal keys to catalog locations. Harbour Bay appears in the Oracle schedule enum but has no point in the inspected location catalog; it must remain unsupported for route estimation until mapped with evidence.
5. Use the recorded cutoff. Resolve overnight cutoffs with explicit dates/day offsets; do not guess whether a later clock time means the previous day or invalid data.
6. Document the simulated safety buffer and confidence policy for Haversine routing, assumed congestion, and stale schedule data.
7. Keep HTTP/dependency errors distinct from calculated UNAVAILABLE results.
8. Specify target-sailing preservation, automatic selection, ranking, and a bounded alternatives horizon.
9. Distinguish the backward latest-departure estimate from a search across traffic periods.
10. Confirm fresh local test/runtime availability and record baseline failures before measuring change impact.

## Runtime and database boundaries

`backend/database/schema.sql` begins with destructive resets and must not be executed as a migration. Existing additive migrations live under `supabase/migrations/`. The initial on-demand feature does not inherently require new storage.

The source plan can proceed using deterministic fixtures without live credentials. A real schedule-data check must be read-only and documented. Data gaps may require coordination with Chelsea or an explicitly labeled simulation configuration; they cannot be filled by fabricated operating dates or cutoffs.

Shared Oracle documentation specifies local FastAPI port **8080** and frontend port **3000**. No server was started in either audit session. Follow the repository’s installed Next.js documentation before authoring frontend code, as required by `frontend/AGENTS.md`.

## Original planning-session result

- Personal context, original PRD, shared current-state/contracts, relevant source, and test-file inventory reviewed.
- Original PRD assumptions reconciled in the proposed sprint plan.
- Source overlap and missing schedule semantics identified.
- Runtime baseline, live schema/data checks, feature implementation, and user evaluation remain pending.
- The user’s student ID and other pre-existing changes in the root context are retained.

The pending items above describe the original session. The scoped follow-up below supersedes its runtime/data status. See [implementation sprints](../planning/DEPARTURE_IMPLEMENTATION_SPRINTS.md).

## Sprint 0 follow-up: D0-03, D0-04, D0-05

23 October 2026, Asia/Jakarta. Only potentially changed runtime/data facts and the adapter decision were checked; D0-01/D0-02 were not repeated. No application code, dependencies, database rows, migrations, or commits were changed. Neither `.env` files nor secret values were read. SQL and the import script were inspected as text only, never executed.

| Task | Result |
| --- | --- |
| D0-03 | Fresh runtime and existing check attempts recorded. Both check commands failed before assertions because dependencies are missing. Regression success remains unverified. |
| D0-04 | Checked-in schedule DDL and accessible source workbook inspected read-only, with a sanitized schedule sample saved. Actual live schema/sample acceptance remains **PENDING**, with a fixture-only boundary below. |
| D0-05 | Reuse approach and risk register finalized for handoff. Sprint 1 still owns contract, normalization, confidence, and UX policy decisions. |

Evidence index: [Sprint 0 evidence](../evidence/sprint-0/README.md). Machine-readable outputs: [runtime baseline](../evidence/sprint-0/runtime-baseline.json), [schedule source sample](../evidence/sprint-0/schedule-source.json), and [DDL excerpt](../evidence/sprint-0/schedule-schema.txt).

### D0-03: fresh runtime and checks

Runtime probes use only standard-library package metadata, executable versions, directory existence, and configuration-presence booleans. They do not import the application or load dotenv. Exact probe commands and outputs are retained in the runtime evidence.

| Working directory | Python | Node / npm | Dependencies |
| --- | --- | --- | --- |
| Repository root | 3.12.10, pyenv | 22.18.0 / 10.9.3 | No pytest or Supabase package; selected installed packages differ from backend pins, including FastAPI 0.138.2 vs 0.138.0 and scikit-learn 1.8.0 vs 1.9.0. Not a verified backend environment. |
| `backend` | 3.14.4, Homebrew | 26.0.0 / 11.12.1 | All 13 selected backend packages absent, including pytest, FastAPI, and Supabase. |
| `frontend` | 3.14.4, Homebrew | 26.0.0 / 11.12.1 | `frontend/node_modules` absent. Helper import of TypeScript fails. |

The observed runtime depends on command working directory. Its cause was not investigated. No `.venv`, `backend/.venv`, or `backend/venv` exists. `backend/requirements.txt` and `frontend/package.json` are dependency declarations, not proof of installation. No dependencies were installed to change this baseline.

From `backend`, exact command:

```sh
PYTHON_DOTENV_DISABLED=1 PYTHONDONTWRITEBYTECODE=1 python3 -m pytest -q -p no:cacheprovider tests/test_route_visualization.py tests/test_route_oracle_parity.py tests/test_congestion.py tests/test_road_names.py
```

**Result: exit 1**, `/opt/homebrew/opt/python@3.14/bin/python3.14: No module named pytest`. No test collection or assertions ran. Pass/fail test counts are **unavailable**, not historical counts or assertion failures. The chosen existing suites cover cargo cutoff behavior, dates/midnight, route/Oracle parity, congestion fallbacks, and shared road names when their harness can start. Their dependency seams use mocks/fixtures; no OSRM, database, or AI provider was contacted. `PYTHON_DOTENV_DISABLED=1` prevents the existing database module's dotenv loader from reading files if imports become reachable.

From `frontend`, exact command:

```sh
node scripts/check-route-integration.mjs
```

**Result: exit 1**, `ERR_MODULE_NOT_FOUND: Cannot find package 'typescript'`, Node 26.0.0. Failure occurred during module loading, before helper assertions; no helper pass count exists for this run. The script's intended scope is pure helper/React harness checks and mocked fetch, with no live services. Browser fixture checks, TypeScript compilation, lint, build, and server smoke tests were not run; they are not substituted for this requested helper baseline.

**Unblock:** establish an explicit compatible backend interpreter and dependency environment plus frontend lockfile dependencies, then rerun these exact commands from their recorded directories with dotenv disabled. Keep fresh failures visible until resolved; do not infer a regression from startup failure. No passing regression baseline is claimed by this audit.

### D0-04: schedule schema and sanitized sample

The checked-in `backend/database/schema.sql` defines `id UUID PRIMARY KEY`, required `terminal_id`, `terminal`, `destination`, and `departure_time TIME`; optional `terminal_name`, `vessel_type`, `cutoff_time TIME`, and `cargo_capacity_tons`; and `created_at TIMESTAMPTZ DEFAULT NOW()`. PostgreSQL `TIME` here carries no source timezone or service date. There is an index on `terminal`, but no natural sailing uniqueness constraint, operating-day/date/recurrence fields, source-zone field, or freshness/observation field. `created_at` is an insertion timestamp, not evidence of schedule verification. This describes repository DDL only, not the installed database.

The read-only source sample is `docs/hackathon/data/Batam SmartFlow Data Master (1).xlsx`, `ferry_schedules!A1:H21`. It is the source path referenced by `backend/scripts/prepare_data.py`. The importer was **not run** because it loads dotenv and writes data. A standard-library ZIP/XML reader extracted only the eight schedule columns. Excel clock serials were converted to seconds, eliminating floating-point storage noise; their source format is `hh:mm`, all are fractions of a day, and the sheet contains no formulas. The workbook's SHA-256 is identical before and after inspection.

| Property | Fresh source-workbook observation | Live database status |
| --- | --- | --- |
| Rows | 20 source records, spreadsheet rows 2–21; not confirmed operational sailings | PENDING |
| Terminal keys/IDs | `TM001` → `batu_ampar`; `TM002` → `batam_center`; `TM003` → `sekupang`. No `harbour_bay` row in this source sheet. | Actual keys/IDs PENDING |
| Cutoff nulls | 0/20 blank cutoffs in this source sheet; checked-in DDL permits null | Actual null count PENDING |
| Service labels | 2 `Cargo Vessel / Intermodal`; 18 `Fast Ferry (Passenger/Hand-Carry)` | Actual types and cargo eligibility PENDING; labels do not prove eligibility/capacity availability |
| Dates/recurrence | Neither service dates nor operating-day/recurrence columns exist on the sheet | PENDING; clock rows do not establish daily service |
| Source timezone | Not recorded on the sheet; cannot assume WIB from the terminal or destination name | PENDING; `Asia/Jakarta` is the calculation target zone only |
| Freshness | No source verification/observation/update timestamp on the sheet | PENDING; workbook/file metadata and DB `created_at` do not establish currency |
| Duplicates | No exact duplicate across all eight columns; no repeated `(terminal, destination, vessel_type, departure_time)` tuple within these 20 records | Duplicate UUIDs/natural keys and full-table coverage PENDING |
| Identity | Repeated `terminal_id` identifies a terminal. Workbook has no schedule UUID. | Stable `id` and occurrence identity PENDING |

The importer omits schedule UUIDs and calls `upsert(ferry_data)` without a natural conflict key. Together with repository DDL lacking natural uniqueness, this creates a **potential** duplicate-import risk; no live duplicates are asserted. Different sailings at one terminal are not duplicate schedules merely because they share `terminal_id`.

**Access boundary:** inherited `SUPABASE_URL` and `SUPABASE_ANON_KEY` were absent in all probed directories, as were frontend Supabase configuration variables. No connector for this project's Supabase database is available in this session. `.env` access is forbidden, so no live request or catalog query was attempted. No accessible live sample, current database count, installed RLS, or deployed schema is inferred from historical Oracle evidence.

**Concrete pending work with Chelsea:** obtain an approved read-only catalog/sample or sanitized export with stable sailing IDs, terminal keys, nullable cutoffs, service applicability, explicit dates/recurrence, source timezone, cutoff day offsets, verification timestamps, and full-scope duplicate counts. Record access role, query bounds/truncation, and observation time. Compare the live catalog before proposing additive metadata changes; never execute the reset schema or importer for this check.

**Fixture-only boundary:** until those facts are verified, real rows with unknown date/zone/cutoff/service applicability cannot support a recommendation or invented next-day alternatives. Sprint 1 may design explicitly synthetic fixtures with supplied absolute timestamps, known zones, terminal mappings, positive safety buffers, and adjusted durations, plus missing-data fixtures. Unknown required data remains `UNAVAILABLE`; dependency failures retain transport error semantics. The source sample above is evidence of project input structure, not a substitute for those fixtures or live acceptance. No new application fixtures or Sprint 1 policies were implemented in this task.

### D0-05: final reuse map

**Integration choice:** use typed **in-process adapters** inside this FastAPI application. Do not call the application's own `/route`, `/congestion`, or `/schedules` over HTTP. Keep HTTP at the frontend→backend boundary and at actual upstream I/O (existing OSRM, Supabase, auth). Oracle already calls `calculate_route(RouteRequest(...))` in-process, so this is an existing integration pattern. No new AI dependency is required.

| Boundary | Reuse and adapter responsibility | Shared-change exposure |
| --- | --- | --- |
| Route | Inject a callable around `routers.route.calculate_route` with a validated `RouteRequest`; validate returned `schemas.route.RouteData`. Provide explicit road date/time/day and mapped terminal coordinates, without cargo/ETD overrides. Consume `final_time_min` once. | Preserve `routers/route.py` and `schemas/route.py`; extract a common service only if a demonstrated injection/timeout need requires it, with Khairul and parity regressions. |
| Congestion | Use the route result's `congestion_status`, source/level and duration; do not make a second public congestion call or apply its multiplier again. The route's fallback behavior differs from `/congestion`. | Preserve `routers/congestion.py` and model behavior under Danial's ownership. Conservative departure confidence checks belong in the new adapter/service. |
| Schedules | Use existing Supabase SDK/client helpers in an injected, bounded repository adapter. Preserve UUID, terminal key, raw cutoff, and metadata; normalize into a typed occurrence before calculation. | Reuse `database.get_supabase_client` and request-scoped authenticated DB lifecycle where appropriate. Do not call the unbounded raw schedules endpoint or Oracle schedule presentation tool as the departure repository. |
| Schedule presentation | `services/oracle_tools.py` demonstrates filtered SDK reads with a 20-row limit, but replaces terminal key with display name and omits UUID/source-date metadata. | Preserve Oracle contracts; its result is unsuitable for identity/mapping. New adapter must disclose retrieval bounds and exclusions. |
| Time | Reuse `route_planning.py` validators/zone conversion for compatible inputs. Require explicit date and known schedule source zone before use. | Keep date-inference and clock-only semantics for existing Planner callers; departure occurrence normalization must not inherit those assumptions silently. |
| Locations | Reuse `locations.py` and `data/batam-locations.json`. Candidate joins are `batu_ampar` → `batu_ampar_port`, `batam_center` → `batam_center_terminal`, `sekupang` → `sekupang_terminal`. | Freeze/verify joins in D1-03; source IDs and catalog IDs differ. Batu Ampar is an approximate access point; exact cargo gate is unverified. Harbour Bay remains unsupported until evidence supplies a point/mapping. |
| Authentication | Reuse verified identity and request-scoped transport/client in `auth.py`; preserve existing 401/503 behavior. The departure endpoint will require auth under the sprint plan. | Do not change public route/schedule auth or introduce privileged credentials. Tests inject auth/DB dependencies. |
| Frontend | Reuse route parser/API/draft cancellation and stale-response patterns plus dashboard controls. Add a departure-specific contract/client later. | Existing clock-copy `RecordedSailingPicker.tsx` cannot carry target identity/cutoff/date. Shared shell/navigation/protection changes need the frontend rules and regression checks. |

Future shared files that may need changes are `backend/main.py` (router registration), `frontend/src/components/layout/Sidebar.tsx` (navigation), `frontend/src/components/layout/Topbar.tsx` (only if title mapping requires it), and `frontend/src/utils/supabase/middleware.ts` (explicit `/departure` protection). These are handoff candidates from the retained source audit, not changes made here. Changes to route helpers/schemas or schedule metadata/migrations remain conditional and owner-coordinated; new departure modules should contain the feature-specific decisions. No schedule CRUD, route/congestion replacement, or optional Oracle feature is included.

### Risk register and test harness requirements

| Risk / priority | Evidence and consequence | Resolution / verification gate |
| --- | --- | --- |
| Runtime baseline blocked / high | Missing pytest and TypeScript prevent assertions; directory-dependent runtimes and package drift make historical counts unusable. | Select explicit runtimes, install declared dependencies in the intended environment, rerun recorded commands. Current outputs remain startup failures. |
| Missing occurrence semantics / blocking real-data use | Clock-only source has no service date, recurrence, source zone, or overnight cutoff day offset. | Chelsea supplies verified metadata or Sprint 1 explicitly defines a labeled simulation policy. Otherwise affected records remain unavailable; do not assume daily or next-day sailings. |
| Freshness and live schema unknown / blocking real-data acceptance | Live access absent; source workbook and `created_at` cannot establish operational currency. | Read-only catalog/sample with provenance and verification times. Agree freshness policy in D1-03/D1-04. Keep live acceptance pending. |
| Nullable cutoff / blocking affected records | Repository schema allows null even though the source sample has none. | Missing-cutoff fixture must remain unavailable; never substitute route cargo margins or invented cutoffs. |
| Service and terminal compatibility / blocking affected records | Passenger/hand-carry labels do not prove cargo suitability. Terminal IDs differ from catalog IDs; cargo access point is approximate. | D1-03 freezes supported mappings/service constraints with owners. Unknown compatibility cannot silently enter candidate ranking. |
| Duplicate/unstable identity / high | Workbook lacks UUIDs; natural uniqueness is absent in repository DDL; repeat imports could duplicate records. | Audit actual IDs and natural keys; define duplicate handling and stable tie-breakers before selection. Preserve selected target and disclose truncated candidate sets. |
| Default congestion / high | Route helper can use 1.0 default or missing congestion; it can also assume an urban corridor after a DB problem. Public congestion semantics differ. | Departure confidence policy must evaluate provenance; unknown/default inputs cannot become credible statuses. If corridor lookup failures cannot be distinguished by existing output, coordinate a typed provenance extension with the route owner before accepting them. |
| Duration precision / medium | Route returns `final_time_min` rounded to two decimals after applying congestion. | Treat it as the current service precision; validate finite nonnegative values, do not multiply again, classify before further display rounding, and test fractional boundaries. Any raw-duration contract change requires owner/parity review. |
| Blocking I/O and fallback masking / high | Route uses synchronous requests with OSRM timeout 4 seconds and synchronous DB calls; DB helper configures PostgREST timeout 10 seconds. These are individual limits, not a total budget. OSRM failure can produce Haversine output. | Run synchronous work in an appropriate bounded execution context; D3-03 must bound I/O where it happens and define the total budget. Inject timeout/outage/malformed responses. Freeze Haversine policy explicitly; an outer coroutine timeout alone is insufficient. |
| Error disclosure / high | Existing schedules endpoint exposes exception text as 500 detail and reads all rows. | New repository adapter must bound selection and map safe transport errors at its own boundary. Preserve existing owner's endpoint in this audit. Do not reuse raw exceptions as domain recommendations. |
| Shared regression/protected route / high | New endpoint registration and navigation/protection touch shared files; broad route group membership is insufficient. | Owner review where shared changes arise; existing route/Oracle parity, cargo/date/congestion helpers plus later auth, route-protection, cancellation/stale-result checks. |

For future executable work, inject route callable, schedule repository, clock, positive safety-buffer configuration, and auth/client dependencies. Calculation/contract suites must work without Supabase, OSRM, or AI credentials. Extend the existing pytest/TestClient and Node helper patterns; mock network/DB failures and assert no plausible recommendation. Sprint 1's fixture matrix must cover all four statuses, zero/exact threshold, fractional minutes, midnight/source-zone conversion, invalid cutoffs, duplicate targets, service mismatch, absent metadata, dependency outages, and already-adjusted durations. Browser fixture evidence and live reads must remain separately labeled. No new test framework or model training is needed.

### Sprint 1 entry gate

The Sprint 0 **audit handoff is ready with explicit blockers**, under the plan's allowance for recorded runtime failures and missing live access. This does not establish a passing regression baseline or live schedule acceptance. D0-04 live verification remains pending.

Sprint 1 may begin contract/UX/data-policy and synthetic-fixture work using this evidence, provided the unknown live data remains unavailable. Before calculation implementation, D1-01–D1-06 must freeze identity/mapping, date/recurrence/zone and overnight semantics, positive buffer and exact boundaries, confidence/fallback rules, auth/errors, bounded selection/alternatives, and the usability protocol. Establish a runnable dependency environment and rerun the existing checks before claiming regression preservation. Real-data integration acceptance additionally requires the read-only schema/sample and metadata gaps above to be resolved. Sprint 1 and later implementation were not started here.
