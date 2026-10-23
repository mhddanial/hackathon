# Sprint 4 — Automatic selection and alternative sailings

Date: 23 October 2026, Asia/Jakarta. **D4-01–D4-05 checks passed offline.** D3-06 remains pending; no real sailing or observed traffic acceptance is claimed.

## Behavior and files

The existing authenticated `POST /departure-recommendation` now accepts the frozen v1 request directly. An omitted or null `schedule_id` requests automatic selection; a supplied UUID is independently resolved and preserved, including MISSED and UNAVAILABLE results. The user-approved Sprint 3 staging restriction has been removed. A calculated main result can include up to three evaluated SAFE/RISKY alternatives; an unavailable main result has none.

| File | Change |
| --- | --- |
| `backend/services/departure_recommendation.py` | Pure candidate normalization fingerprints, duplicate/conflict grouping, exact filtering, deterministic automatic selection, alternatives and bounded metadata; reuse existing occurrence arithmetic |
| `backend/schemas/departure_recommendation.py` | Internal typed candidate/batch models; additional request/selection, selected identity, main applicability, exclusion count and alternative ordering/uniqueness invariants |
| `backend/services/departure_dependencies.py` | Reuse row normalization for independent target lookup and bounded candidate retrieval; preserve repository provenance and unknown metadata |
| `backend/routers/departure_recommendation.py` | Restore optional target, fetch candidates, reuse one route estimate, preserve earlier domain reasons on arithmetic overflow, assemble complete result |
| `backend/tests/test_departure_alternatives.py` | 55 new checks for frozen fixtures/examples, ranking, filtering, bounds, duplicate conflicts and recalculation |
| `backend/tests/test_departure_api.py` | Extend injected read-only repository harness for candidate queries; replace temporary missing-target rejection assertions with automatic-mode assertions |
| `backend/tests/test_departure_dependencies.py` | Update missed-target regression to expect its later matching alternative while preserving the original target |
| `docs/departure/README.md` | Current implementation status and report link |
| `docs/departure/planning/DEPARTURE_IMPLEMENTATION_SPRINTS.md` | D4-01–D4-05 ticked and acceptance evidence linked |
| `docs/departure/sprints/SPRINT_4_REPORT.md` | This report |
| `docs/departure/evidence/sprint-4/verification.json` | Sanitized commands, results, scope and release gate |

The frozen API contract, schedule policy, fixture JSON and example JSON were **not changed**. They already define optional targets and the implemented selection policy, so the sprint plan's proposed contract/example update was unnecessary and the user's freeze remains respected. All three successful example payloads validate against the resulting response schema. No shared auth, route/congestion service, main registration, I/O budget implementation, schedule CRUD or frontend changes were made in Sprint 4. No migration, deployment, live write or commit was performed by this work.

## Acceptance by task

- **D4-01:** Match known terminal, normalized exact casefolded destination, explicit Jakarta service date and allowed service kind before evaluation. Known mismatches are excluded with `SCHEDULE_MISMATCH`/`SERVICE_MISMATCH`; unknown required metadata retains its domain reason. Distinguish `NO_SCHEDULES`, `NO_RELEVANT_SCHEDULES`, `NO_EVALUABLE_SCHEDULES`, and evaluated all-MISSED results. No recurrence, fuzzy destination aliases or next-day copying is inferred. Explicit evidenced next-day sailings remain supported.
- **D4-02:** Choose earliest SAFE by `(departure_at, schedule_id)`, otherwise earliest RISKY by that order. If all evaluated candidates are MISSED, choose the latest cutoff, breaking ties by earliest departure then UUID. Explicit targets are never substituted. Group identical UUID/date occurrences and warn on collapse; conflicting normalized content is `AMBIGUOUS_SCHEDULE`. Internal SHA-256 fingerprints distinguish invalid raw values that would otherwise normalize to identical nulls; fingerprints/raw rows never enter responses. Exclusions and candidate ordering are stable across input permutations.
- **D4-03:** Each alternative has its own recorded cutoff, unrounded signed buffer, status and fixed-duration backward estimate. Include only matching SAFE/RISKY occurrences, exclude the main occurrence, sort by departure/UUID regardless of status, and cap at three. Reuse one route estimate for the common origin/terminal/road instant. `POSSIBLE_DUPLICATE_SAILING` requires a full matching terminal/destination/departure/cutoff/service tuple under distinct UUIDs; a shared clock alone is insufficient. Warnings are aggregated by code, and exclusions remain bounded.
- **D4-04:** A follow-up request selecting an alternative preserves road inputs and sets only its UUID. HTTP tests verify a fresh backend calculation and route call for that request. A separate test adopts the latest-departure estimate with a newly injected traffic-period duration: the result changes to RISKY, demonstrating that the previous estimate is not reused as a guarantee. The existing fixed-duration warning and recalculation instruction remain present.
- **D4-05:** All 14 remaining frozen selection/repository cases pass in pure and HTTP tests. Additional checks cover exact zero/threshold automatic choice, all-missed ties, duplicate clocks versus full duplicates, conflicting malformed values, destination normalization, missing date versus explicit next day, unknown congestion, unavailable selected targets, 100 exclusions, candidate overflow, route-call count, alternative adoption and authoritative examples. Existing route/Oracle parity, visualization, congestion and auth checks also pass.

## Bounds and failure behavior

Candidate repository reads use `select('*').order('id').limit(101)`. Selected mode adds `neq('id', selected_uuid)`, because its main target was independently read and validated first. The repository normalizes at most the first **100** candidate rows; row 101 is only an overflow sentinel and is never evaluated. With a separately selected target there are at most **101 unique occurrence evaluations**. The independent target lookup retains Sprint 3's separate 101-row conflict bound. Counts describe bounded normalized unique occurrences, including unknown records as separate unevaluable entries, not total table size.

Date/destination filters are applied in the pure core rather than SQL: a SQL date filter would hide missing metadata and could reference columns absent from the clock-only schema; a raw destination equality filter would violate whitespace/case normalization. The global bounded set can therefore include irrelevant records. Overflow fails closed even if some retrieved rows look usable; no exhaustive best-sailing claim is made.

Automatic overflow returns `UNAVAILABLE / CANDIDATE_LIMIT`, sets `selection.truncated=true` and does not require a route call. Selected overflow can retain its independently evaluated main result, sets truncation, omits alternatives and warns `ALTERNATIVES_TRUNCATED`. Normal selected/automatic requests make **at most one** route call. Choosing an alternative or changing the road plan makes a new request and recalculates. Existing per-I/O deadlines, no-retry policy, safe transport errors, auth and byte limits remain in force. Candidate-read failures are 503, not plausible empty recommendations.

## Executed verification

Existing ignored `.venv`: Python 3.12.10, pytest 9.1.1. No dependency installation or requirements change was needed. Commands ran from the repository root with dotenv disabled before imports and external socket connections blocked. Existing local socketpair and resolver-cleanup tests remain offline; all sailing data and traffic responses are synthetic.

```sh
PYTHON_DOTENV_DISABLED=1 .venv/bin/python -c 'import socket,pytest; block=lambda *a,**k: pytest.fail("Network blocked in departure tests"); socket.socket.connect=block; socket.create_connection=block; raise SystemExit(pytest.main(["backend/tests/test_departure_alternatives.py","backend/tests/test_departure_api.py","backend/tests/test_departure_contracts.py","backend/tests/test_departure_calculation.py","backend/tests/test_departure_dependencies.py","backend/tests/test_route_visualization.py","backend/tests/test_route_oracle_parity.py","backend/tests/test_congestion.py","backend/tests/test_oracle_auth.py","-q","--tb=short"]))'
```

**Exit 0: 431 passed, 1 warning in 6.10s.** This includes 55 new selection/alternative checks plus the 376 existing checks (two staging assertions and one missed-target assertion updated for intended Sprint 4 behavior). All 66 frozen fixture definitions now have executable coverage: 63 HTTP scenarios plus three configuration scenarios. The 14 selection/repository scenarios additionally run through the pure core. Three successful frozen API examples validate unchanged; the other two examples are error payloads, covered through their corresponding timeout/validation HTTP fixtures.

The single warning is the existing FastAPI/Starlette TestClient `httpx` deprecation; it is not a failing check. An intermediate collection attempt used an incorrect relative path for the new example-validation test and exited 2; the test path was corrected before the final acceptance run. Earlier 301- and 428-check runs passed before the last example checks were added.

```sh
.venv/bin/python -m pip check
git diff --check
```

Both exited 0 (`No broken requirements found`; no whitespace errors). A targeted `git diff --numstat` showed no changes to the frozen source-of-truth files or shared auth/main/route/I/O files in this sprint.

## Blockers and Sprint 5 entry gate

No Sprint 4 calculation/API blocker remains. Sprint 5 may build the interface against the tested selected/automatic endpoint, including independent alternative selection and explicit recalculation. No frontend or usability completion is claimed here.

**D3-06 remains open before real-data release.** These tests do not establish verified live occurrence/date/source-zone/cutoff/service/freshness metadata, working live credentials, real route-context evidence or measured production latency. Missing real metadata must remain UNAVAILABLE; existing clock rows must not be expanded or assigned dates to make a demonstration look successful.
