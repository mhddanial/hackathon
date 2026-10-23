# Sprint 3 — Selected-sailing API and service adapters

Date: 23 October 2026, Asia/Jakarta. **D3-01–D3-05 checks passed. D3-06 remains pending.** All successful calculation evidence is synthetic, with fixed clocks and injected network responses; it is not a real sailing or observed traffic result.

## Scope and approved intermediate behavior

`POST /departure-recommendation` now verifies authentication, reads the selected schedule, calls the existing route service in-process, and runs the Sprint 2 calculation core. It returns typed decisions or controlled errors. There is no frontend, automatic selection, alternatives search, deployment, database migration, live write, or commit in this sprint.

The user explicitly approved: **“Build selected-sailing only; temporarily return a clear 422 when schedule_id is omitted, and document full v1 support as pending Sprint 4.”** Null also receives the selected-sailing validation error. `SelectedDepartureRequest` applies that staging restriction only at the new endpoint; the frozen base request, API contract, schedule policy, and fixture JSON are unchanged. All alternatives remain empty. Full automatic-mode v1 support is not claimed.

## Files and shared-code attribution

| File | Change |
| --- | --- |
| `backend/routers/departure_recommendation.py` | Selected request schema, startup config validation, authenticated endpoint, strict JSON/size guards, safe endpoint-local errors, injected calculation clock |
| `backend/services/departure_dependencies.py` | Read-only selected lookup, row normalization, duplicate/conflict detection, typed route adapter, provenance evidence, failure recording |
| `backend/services/departure_io.py` | Request-local hooks, monotonic deadlines, bounded HTTP client, socket/TLS deadlines, killable DNS resolution, bounded response reads |
| `backend/tests/test_departure_api.py` | 78 HTTP checks, including 49 frozen fixtures, auth, malformed requests, transport errors, sizes, startup, registration, and provenance |
| `backend/tests/test_departure_dependencies.py` | 34 adapter/deadline checks, including duplicate targets, unknown corridors, actual local socket timeout, and resolver process cleanup |
| `backend/main.py` | Import and register the new router; its lifespan validates server config at startup |
| `backend/auth.py` | Optional request-local transport factory; existing verified identity logic, error shapes, and other endpoints' default transport remain unchanged |
| `backend/routers/route.py` | Optional request-local hooks at three existing I/O call sites; route arithmetic, cargo behavior, schemas, default services, and congestion logic remain unchanged |
| `docs/departure/README.md` | Current implementation status and report link |
| `docs/departure/planning/DEPARTURE_IMPLEMENTATION_SPRINTS.md` | D3-01–D3-05 ticked; D3-06 left unchecked and staging limitation recorded |
| `docs/departure/sprints/SPRINT_3_REPORT.md` | This report |
| `docs/departure/evidence/sprint-3/verification.json` | Sanitized command/results and gate record |

The small shared hooks allow Ananda's departure boundary to reuse Khairul's route service and Danial's congestion outputs without changing their default Planner/Oracle behavior. Chelsea's schedules endpoint/CRUD and the database schema were not modified. Sprint 2 config, models, calculation core, and its tests were not modified.

## Acceptance evidence

- **D3-01:** Use the verified user's request-owned database client. Select `ferry_schedules` by its `id` UUID, independently of terminal/destination/date filters, order by stable ID, and bound retrieval to 101 rows. `terminal_id` remains a grouping, never a sailing ID. Empty target lookup is 404; known target mismatches are 422; missing row metadata is 200 UNAVAILABLE; malformed envelopes and failed reads are controlled 503 errors. Identical normalized records collapse with a warning. Conflicting target content or a full 101-row sentinel lookup fails closed as `AMBIGUOUS_SCHEDULE`. Raw clock fields, `created_at`, vessel labels, and request dates never enrich missing occurrence metadata.
- **D3-02:** Resolve terminal coordinates from the existing catalog. Pass origin/date/time/day to `RouteRequest` with no cargo/ETD pair. Call `calculate_route` once in-process, validate strict final duration before the legacy response model can coerce it, validate `RouteData`, and verify its echoed inputs. Consume `final_time_min` once. Observe the owner's actual corridor read and require a known model corridor and matching multiplier provenance before setting `context_verified=true`. Missing/unknown/defaulted corridor context stays unavailable. No extra public congestion call is made.
- **D3-03:** Start one **30-second monotonic request budget** before body/auth work. Cap auth operations at **10 seconds**, each DB operation at **5 seconds**, and OSRM at **4 seconds**, further shortened to the remaining total budget. Transport streams clamp each blocking read/write/TLS operation to the current deadline. Standard socket timeouts do not bound DNS lookup, so hostname resolution runs in an isolated Python child (`-I -S`) that is killed and reaped on timeout, including expiry during child startup. Numeric addresses bypass that resolver; at most 16 resolved addresses are tried under the same deadline. Each upstream body is capped at **1 MiB**. HTTP transport retries are zero, and PostgREST `.retry(False)` prevents SDK retry/backoff from escaping the budget. Local socket and resolver-cleanup tests verify blocking bounds without an external service. This is not a measured production latency guarantee; live transport behavior and load remain unverified under D3-06.
- **D3-04:** Reuse `get_authenticated_context`; preserve 401 bearer headers and the existing auth-outage 503 shape/Retry-After. Authenticate before schedule/route reads. Reject invalid requests before domain reads. Parse UTF-8 JSON with duplicate-key/nonfinite rejection, require the selected UUID, enforce 8192 request bytes and 65536 successful response bytes, and omit raw validation inputs/context. Departure-specific safe errors use the frozen detail shape. Positive safety/freshness config is validated by the included router lifespan at application startup; invalid configuration stops startup.
- **D3-05:** TestClient exercises all four statuses, zero/fractional boundaries, timezone/midnight cases, invalid duration, auth failures/outage, target mismatches/absence, DB and route outages/timeouts, owner-swallowed failures, unknown route context, malformed responses, source labels, byte limits, startup, and main registration. A DB 503 executes only one request; neither raw diagnostics nor a successful recommendation body escapes on dependency failure. Arithmetic overflow remains `UNAVAILABLE / INVALID_SCHEDULE`.

The new HTTP matrix executes **49 frozen cases**: 29 domain, 7 request, 5 target, 6 dependency, and 2 auth. Three configuration fixture cases remain covered by Sprint 2 tests. The remaining 14 frozen cases (12 selection and 2 repository-contract cases) belong to Sprint 4; they are not claimed as passing here.

## Runtime and exact verification command

Existing ignored `.venv`, Python **3.12.10**, pytest **9.1.1**; no new installation or requirements change was needed. All verification commands ran from the repository root. Dotenv was disabled **before imports**, and external socket connections were blocked. The socketpair test uses only local AF_UNIX endpoints. Resolver timeout tests start an isolated sleeping child, then verify it has been killed; they do not perform DNS/network lookup.

```sh
PYTHON_DOTENV_DISABLED=1 .venv/bin/python -c 'import socket, pytest; block=lambda *a, **k: pytest.fail("Network blocked in departure tests"); socket.socket.connect=block; socket.create_connection=block; raise SystemExit(pytest.main(["backend/tests/test_departure_api.py", "backend/tests/test_departure_dependencies.py", "backend/tests/test_departure_calculation.py", "backend/tests/test_departure_contracts.py", "backend/tests/test_route_visualization.py", "backend/tests/test_route_oracle_parity.py", "backend/tests/test_congestion.py", "backend/tests/test_oracle_auth.py", "-q", "--tb=short"]))'
```

**Exit 0: 376 passed, 1 warning in 5.26s.** Breakdown: 112 new API/adapter checks, 143 Sprint 2 checks, 37 route/Oracle parity and visualization checks, 68 congestion checks, 16 existing auth checks. The single warning is the existing FastAPI/Starlette test client's `httpx` deprecation in favor of `httpx2`; dependencies were not changed.

```sh
.venv/bin/python -m pip check
git diff --check
git check-ignore .venv/pyvenv.cfg
```

These checks exited 0: no broken requirements, no whitespace errors, and `.venv/pyvenv.cfg` matched the existing ignore rule. `git diff --numstat` over the frozen contract/policy/fixture and Sprint 2 production files produced no changes.

Earlier diagnostics found two test-assumption failures: FastAPI's included-router representation lacked `.path`, so the registration test now checks generated OpenAPI and starts the real app; a test hardcoded rounded terminal coordinates, so it now compares against the authoritative catalog. Both were corrected before the final acceptance run.

## D3-06 and Sprint 4 entry gate

The current process has neither a configured live connection nor a dedicated read-only token. Presence-only checks printed booleans, never values; no `.env` file was read and no live request was attempted. **D3-06 stays unchecked.** A synthetic clock-only database row demonstrates `200 UNAVAILABLE / MISSING_SERVICE_DATE`, preserving its UUID and `database` provenance, without borrowing `created_at`, road date, or clock values as missing metadata. This is explicitly not a production capture.

Sprint 4 may begin against the passing selected-sailing boundary and injected fixtures. It must add automatic selection, relevant alternatives, bounded candidate retrieval, and the remaining selection/repository tests, then remove the temporary selected-only restriction. Before real-data release, D3-06 still needs a read-only authenticated request, verified occurrence/date/source-zone/cutoff/service/freshness metadata from Chelsea, and actual route-context evidence. Current calculated results remain planning simulations, not boarding guarantees.
