# Sprint 1 — Contracts, data policy, and UX

23 October 2026, Asia/Jakarta. Owner: **Ananda Khusnul Hotimah — 3312401044**. Scope: **D1-01–D1-06 only**. This report records design artifacts and offline expectation checks, not a running feature, successful application regression suite, real sailing, or participant result.

## Entry and resulting decisions

Sprint 0 supplied fresh failed check attempts, a source-only schedule sample, a reuse map, and a fixture-only entry gate. That audit was not repeated. The missing pytest/TypeScript runtime and D0-04 live schema/sample verification remain open. During this work the personal context moved from the repository root to `docs/departure/context/context_improve.md`; the relocation is preserved and maintained README/plan links follow it.

The frozen v1 design uses typed in-process adapters, verified existing auth, route `final_time_min` applied once, a positive 15-minute simulation safety buffer, and exact SAFE/RISKY/MISSED boundaries before display rounding. Raw clock-only schedules remain unavailable without date/zone/applicability/freshness metadata. Haversine/default congestion cannot establish a calculated status. A usable OSRM/synthetic-congestion estimate also needs evidence that its corridor context did not use hidden defaults.

The request explicitly requires destination, service kind, and a separate Jakarta ferry service date (road date or following date). Only that one date is searched; recurrence is not expanded. Selected targets remain selected when missed. Automatic choice uses earliest SAFE, then earliest RISKY, then latest missed cutoff, with stable identity tie-breaks. Alternatives are individually evaluated, capped at three. Candidate retrieval is bounded to 100 plus one sentinel; automatic mode fails closed on truncation. Unknown values stay null and I/O failures remain transport errors.

## Task evidence

| Task | Artifact and acceptance |
| --- | --- |
| D1-01 | [User flow](../design/USER_FLOW.md) and [desktop/mobile wireframes](../design/WIREFRAME.md): explicit time meanings, target preservation, alternatives, revision, keyboard order, focus, empty/error/unavailable states, cancellation/races and account changes. Low-fidelity design only; no screenshot/browser claim. |
| D1-02 | [API contract v1.0](../contracts/DEPARTURE_API_CONTRACT.md) and [five synthetic examples](../contracts/DEPARTURE_API_EXAMPLES.json): strict typed field dictionaries, UUIDs, aware timestamps, nulls, request/response bounds, auth compatibility, validation and transport semantics. No endpoint implementation. |
| D1-03 | [Schedule policy](../data/SCHEDULE_POLICY.md): three project terminal joins, explicit dated-occurrence requirement, source zones, cutoff ordering, no recurrence expansion, service applicability, freshness, duplicate identity rules, and Chelsea's unresolved live-data dependencies. |
| D1-04 | Same policy: configuration defaults/validation, classification, route confidence, backward-estimate limitations, deterministic selection/ranking and truncation behavior. Defaults are project parameters, not terminal SOPs. |
| D1-05 | [66 synthetic fixture definitions](../../../backend/tests/fixtures/departure_cases.json), [expectation review](../evidence/sprint-1/fixture-review.md), and independent arithmetic/example checks. No fixtures are presented as real sailing records or executed API responses. |
| D1-06 | [Usability protocol](../reports/USABILITY_PROTOCOL.md): planned five adults with relevant experience, tasks, consent/anonymization, timing/error/outcome measures and custom ease/clarity questions. Supervisor/institution confirmation is required before actual collection; no participant results exist. |

## Acceptance coverage and ownership

| Criterion | Sprint 1 evidence | Implementation / actual verification |
| --- | --- | --- |
| DEP-01 SAFE | SAFE-30, EXACT-THRESHOLD; decision table | D2-02–D2-05, D3-05, D5-06, D6-01 |
| DEP-02 RISKY | RISKY-5, FRACTION-BELOW | D2-03/D2-05, D3-05, D5-06, D6-01 |
| DEP-03 MISSED | MISSED-5, FRACTION-NEGATIVE, PRESERVE-MISSED-TARGET | D2-03/D2-05, D3-05, D4-05, D6-01 |
| DEP-04 empty/relevant lookup | EMPTY-SUCCESS, ONLY-INCOMPATIBLE-CANDIDATES, AUTO-CANDIDATE-OVERFLOW | D3-01/D3-05, D4-01/D4-05, D6-01 |
| DEP-05 invalid input | Request/target fixtures; strict contract and field-error flow | D2-01, D3-05, D5-03/D5-06, D6-01 |
| DEP-06 dependencies/confidence | Outage, timeout, malformed duration, auth, fallback/context/freshness fixtures | D3-02–D3-05, D5-05/D5-06, D6-01–D6-02 |
| DEP-07 missing/invalid cutoff | MISSING-CUTOFF, invalid cutoff, conflicting duplicate and unknown-data fixtures | D2-02/D2-05, D3-01/D3-05, D6-01 |
| DEP-08 alternatives | PRESERVE-MISSED-TARGET, AUTO-SAFE-BEFORE-RISKY, ALTERNATIVES-CAP-THREE | D4-01–D4-05, D5-04/D5-06, D6-01 |
| DEP-09 midnight/zones | MIDNIGHT-ARRIVAL, EXPLICIT-PREVIOUS-DAY-CUTOFF, SOURCE-SINGAPORE, ZONE-CHANGES-SERVICE-DATE | D2-02/D2-05, D3-05, D6-01 |
| DEP-10 zero/threshold | ZERO-BUFFER, EXACT-THRESHOLD, fractional and invalid-config fixtures | D2-03/D2-05, D5-06, D6-01 |
| DEP-11 no duplicate multiplier | APPLY-CONGESTION-ONCE, ZERO-DURATION; route-only contract | D2-02/D2-05, D3-02/D3-05, D6-01 |
| DEP-12 stale responses | User-flow state table: generations, aborts, edits, logout; protocol U4 | D5-05/D5-06 delayed fixture-browser checks, D6-01; no UI execution in Sprint 1 |
| DEP-13 all missed | AUTO-ALL-MISSED, preserved target and empty-alternative copy | D4-02/D4-05, D5-06, D6-01 |
| DEP-14 usability | Protocol U1–U5, consent, observation fields, questionnaire and analysis plan | D6-04–D6-06 actual participant evidence; no data collected in Sprint 1 |

Ananda owns the departure decisions/interface/integration. Danial's congestion/Oracle, Khairul's route/maps, and Chelsea's schedules remain their services. No shared router, schema, model, auth, database, navigation, middleware, or frontend code was changed. The new backend file is synthetic JSON test data only. Possible later shared changes remain those recorded in Sprint 0; route provenance may need compatible owner coordination before real integration can establish decision confidence.

## Verification and limitations

Exact offline command from repository root:

```sh
python3 docs/departure/evidence/sprint-1/verify_design.py
```

The checker validates authored expectations with independent aware-datetime arithmetic and strict JSON/field consistency. It checks request-invalid and unavailable preconditions, source-zone/midnight/freshness boundaries, alternative identity/order/bounds, preserved targets, and five example payloads. The [machine-readable result](../evidence/sprint-1/design-validation.json) records the actual completed run. Selection policy traces were also reviewed in the expectation table; this is not execution of a future selection service. Overflow scenarios inject repository sentinel state rather than simulate a real database query.

The first verification attempt stopped on a broken personal-context link after the context relocation; fixture/example checks had completed before link validation. README/plan links were corrected without restoring or editing the moved context. The successful rerun is recorded in evidence. `git diff --check` and file-scope validation are separate documentation gates. No existing application tests were rerun, dependencies installed, live records queried/written, `.env` files read, deployments made, or commits created.

## Completion and Sprint 2 entry gate

D1-01–D1-06 are design/fixture deliverables. Their closure requires the offline review command to pass and the linked artifacts to agree; it does not close D0-04, application regressions, usability collection, or live-data acceptance. See [Sprint 1 evidence](../evidence/sprint-1/README.md) for exact results and limitations.

Sprint 2 can implement typed pure calculation/configuration modules against these synthetic inputs without inventing schedule semantics. Before claiming its executable gate, establish an explicit compatible Python environment with the required packages and run the new calculation/schema suite plus applicable recorded regressions. Preserve the frozen positive buffer, exact signs/boundaries, aware datetimes, and no-double-congestion rules. Do not start adapters, HTTP endpoint, automatic-selection implementation, UI, or optional Oracle/history work under Sprint 2's calculation-only scope.

Open gates: (1) D0-04 read-only live catalog/sample and Chelsea's date/zone/applicability/freshness/identity evidence; (2) runnable backend/frontend regression environments; (3) route corridor-context provenance for real integration; (4) supervisor/institution confirmation before usability collection. These do not block the offline calculation design, but they prevent claims of verified real recommendations or completed evaluation. No migrations or new credentials are required by Sprint 1. Sprint 2 has not been started.
