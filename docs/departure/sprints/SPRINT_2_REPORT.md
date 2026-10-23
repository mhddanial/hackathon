# Sprint 2 — Calculation core

Date: 23 October 2026, Asia/Jakarta. Scope: **D2-01–D2-05 only**, all acceptance checks passed. Evidence uses synthetic fixtures and fixed clocks; no real sailing or live-data acceptance is claimed.

## Files changed

| File | Purpose |
| --- | --- |
| `backend/departure_config.py` | Immutable positive finite safety/freshness settings, defaults 15/1440 minutes; explicit environment factory with no dotenv reads |
| `backend/schemas/departure_recommendation.py` | Typed request, occurrence/view, route input/estimate, result, alternatives, provenance, reasons, bounded metadata; arithmetic and response invariants |
| `backend/services/departure_recommendation.py` | Pure injected single-row assessment and single-occurrence calculation; explicit unavailable reasons and mismatch errors |
| `backend/tests/test_departure_calculation.py` | Fixture arithmetic, confidence, date/zone, freshness, overflow, and backward-estimate checks |
| `backend/tests/test_departure_contracts.py` | Fixture loader/deep merge, strict schema/config validation, bounds, required response fields, and invalid-duration rejection |
| `docs/departure/planning/DEPARTURE_IMPLEMENTATION_SPRINTS.md` | Only D2-01–D2-05 checkboxes ticked; Sprint 2 evidence linked |
| `docs/departure/sprints/SPRINT_2_REPORT.md` | This report |
| `docs/departure/evidence/sprint-2/verification.json` | Sanitized commands, results, fixture scope, and remaining gates |

The frozen API contract, schedule policy, fixture JSON, `main.py`, route router, other owners' services, and frontend were not edited. No migration, deployment, live write, or commit was performed.

## Implementation and acceptance

- **D2-01:** Strict finite numeric inputs reject booleans/string coercion. Reuse `locations.in_planning_area`, catalog resolution, `route_planning.planning_date`, `planning_context`, and `PLANNING_ZONE`. Validate terminal/service/UUID identifiers, date/clock/day/horizon, configured positive thresholds, occurrence identity and source offsets. Separate partial unavailable views from validated occurrences. Result and alternative models enforce signed-buffer arithmetic and confidence invariants. All 22 response keys are required.
- **D2-02:** `ETA = road departure + final_time_min`; `buffer = (recorded cutoff - ETA).total_seconds() / 60`. No second congestion adjustment or cargo cutoff derivation. Original source timestamps/zone are retained; normalized times use Jakarta. Cutoff must strictly precede sailing departure as an absolute instant.
- **D2-03:** Before any display rounding: negative buffer is MISSED, zero through less than the configured threshold is RISKY, threshold and above is SAFE. Unknown required metadata/confidence is UNAVAILABLE, with null decision duration/ETA/buffer/latest fields. A separately labeled route estimate may remain. Invalid dependency duration fails validation for the future adapter to map to 503; no transport behavior is claimed here.
- **D2-04:** Latest departure subtracts validated duration and safety buffer from recorded cutoff. Every calculated result includes `BACKWARD_ESTIMATE_FIXED_DURATION` and a recalculation instruction. Past estimates are preserved. No traffic-window search is implemented.
- **D2-05:** All **43 in-scope fixture cases** pass: 29 domain, 7 request, 3 configuration, and 4 invalid-duration dependency cases. Additional checks cover subminute/custom thresholds, malformed/naive metadata, original source retention, freshness priority, strict types, required response fields, provenance, alternatives' schemas, and datetime/timedelta overflow.

The other **23 of 66 fixture cases** are intentionally outside Sprint 2: auth (2), target lookup (5), selection (12), repository contract (2), and actual dependency failures/timeouts (2). These are not represented as passing HTTP/integration tests. Arrays are replaced, objects deep-merged, and explicit nulls retained per the frozen fixture merge rule.

## Runtime and exact commands

All commands ran from the repository root. Project-local Python **3.12.10**, pytest **9.1.1**. System Python and requirements were not modified; `.venv` is untracked and covered by the existing `.gitignore`.

```sh
python3.12 --version
python3.12 -m venv .venv
git check-ignore .venv/pyvenv.cfg
.venv/bin/python -m pip install -r backend/requirements.txt
.venv/bin/python -m pip check
.venv/bin/python -m pytest --version
```

Venv creation and ignore verification exited 0. Installation attempt 1 (sandbox) exited 1: package-index DNS resolution failed (`[Errno 8] nodename nor servname provided, or not known`), followed by misleading no-distribution output for `annotated-doc==0.0.4`. Attempt 2 used the same install command with approved network access and exited 0; all backend requirements installed. `pip check` exited 0: `No broken requirements found.` The pip cache warning is unrelated to dependency compatibility.

Final verification command (dotenv disabled before imports; network connections fail the run):

```sh
PYTHON_DOTENV_DISABLED=1 .venv/bin/python -c 'import socket, pytest; block = lambda *a, **k: pytest.fail("Network blocked for offline Sprint 2 verification"); socket.socket.connect = block; socket.create_connection = block; raise SystemExit(pytest.main(["backend/tests/test_departure_calculation.py", "backend/tests/test_departure_contracts.py", "backend/tests/test_route_visualization.py", "backend/tests/test_route_oracle_parity.py", "-q"]))'
```

**Exit 0: 180 passed, 1 warning in 3.84s** — 143 new checks plus 37 existing route/Oracle parity and visualization checks. The warning is the existing FastAPI/Starlette test client's deprecation of `httpx` in favor of `httpx2`; no owner dependency was changed.

Earlier diagnostic runs:

```sh
.venv/bin/python -m pytest backend/tests/test_departure_calculation.py backend/tests/test_departure_contracts.py -q
.venv/bin/python -m pytest backend/tests/test_route_visualization.py backend/tests/test_route_oracle_parity.py -q
git diff --check
```

The first new-test run had 118 passed and one float-equality assertion failure (`29.990000000000002` versus `29.99`). The test now uses an absolute tolerance; calculation and classification remain unrounded. Its corrected run passed 119 checks; subsequent schema additions bring the final new-check count to 143. The initial route run passed 37 checks but imported the existing `database.py`, which invokes `load_dotenv()`; this run was not guarded against dotenv loading. No secret values were printed. Subsequent combined runs disabled dotenv before imports and blocked outbound connections; the final guarded result above is the acceptance evidence. `git diff --check` exited 0.

## Blockers and Sprint 3 entry gate

No remaining Sprint 2 runtime/calculation blocker and no source-of-truth conflict was found. Sprint 3 may begin with injected synthetic data and the tested core. `calculate_departure` evaluates one supplied occurrence; it does not fetch targets, select automatically, search alternatives, or catch dependency I/O failures. `PlanMismatch` and dependency validation exceptions still require controlled transport mapping.

Sprint 3 must wire validated configuration into application startup, implement adapters/auth/transport limits, and retain failure-versus-unavailable distinctions. Real-data acceptance still requires verified explicit occurrence/date/source-zone/cutoff/service/freshness metadata from Chelsea and positive route-context provenance evidence from the route integration. Existing route output alone must not be treated as `context_verified=true`; until evidence exists, return `ROUTE_CONTEXT_UNKNOWN`. No live schedule, observed traffic, endpoint, or frontend claim is established by this report.
