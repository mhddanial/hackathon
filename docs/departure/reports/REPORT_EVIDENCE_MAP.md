# BAB III / BAB IV evidence map — partial Sprint 6

24 October 2026, Asia/Jakarta. D6-06 preparation, **not completed academic/live/usability acceptance**. Ananda Khusnul Hotimah — 3312401044 owns departure calculation, integration, interface and evaluation. Danial owns congestion/model training, Khairul route/maps, Chelsea schedule data/CRUD. This report does not attribute their services/model accuracy to Ananda.

| Report part | Claim that current evidence supports | Source | Limit / missing evidence |
| --- | --- | --- | --- |
| BAB III — requirements/scope | Defined departure flow and DEP-01–DEP-14 acceptance criteria | [Context](../context/context_improve.md), [sprint plan](../planning/DEPARTURE_IMPLEMENTATION_SPRINTS.md) | Design/ownership evidence, not user-study outcomes |
| BAB III — flow/wireframe | Designed input/result/error/mobile flow | [User flow](../design/USER_FLOW.md), [wireframe](../design/WIREFRAME.md) | Design dated 23 October; actual screenshots are separately captured below |
| BAB III — sequence/integration | Implemented request handling and owner-service boundaries | Sequence below; backend router/dependency/calculation source | Executed with injected fake I/O; signed-in live chain pending D6-02 |
| BAB III — formulas/status | Aware ETA, recorded cutoff buffer and exact threshold policy | [Contract](../contracts/DEPARTURE_API_CONTRACT.md), [policy](../data/SCHEDULE_POLICY.md) | Positive project simulation threshold; no invented SOP or booking guarantee |
| BAB III — data/provenance | Three project terminal mappings and explicit metadata requirements | Schedule policy; shared catalog; contract | Real occurrence/service/freshness/route-context evidence remains open |
| BAB III — API examples | Frozen expected request/response shapes | [Synthetic examples](../contracts/DEPARTURE_API_EXAMPLES.json) | Authored simulation examples, not real endpoint captures |
| BAB IV — functional behavior | Fresh synthetic passes for DEP-01–DEP-13 | [Matrix](../evidence/sprint-6/ACCEPTANCE_MATRIX.md), [actual backend outputs](../evidence/sprint-6/backend-acceptance.json), [browser outputs](../evidence/sprint-6/browser-acceptance.json) | DEP-14 pending genuine participants; no real sailing inference |
| BAB IV — regressions | 431 backend assertions, 26 headless UI groups, 18/8 helpers, typecheck/scoped lint/build pass | [Acceptance report](../sprints/SPRINT_6_ACCEPTANCE.md), Sprint 6 logs/XML | Initial full lint failed 7 errors/19 warnings; after evidenced fixes it passes 0 errors/16 warnings. Follow-up: 5 U4, 5 shared and 13 Planner browser groups passed; earlier 431 backend results were not rerun |
| BAB IV — interface screenshots | Actual headless Next UI at 1440 px and 375 px, inspected | [Synthetic desktop](../evidence/sprint-6/departure-desktop.png), [synthetic mobile](../evidence/sprint-6/departure-mobile-375.png) | Fake Auth/API; not real login/backend or physical-device usability evidence |
| BAB IV — duration measurements | Actual wall time of 63 in-process ASGI requests and 9 injected errors, three synthetic catalog scenarios | [Timing samples](../evidence/sprint-6/synthetic-latency.json) | Mock I/O/model; no network/production latency, model accuracy, dispatch-time or traffic measurement claim |
| BAB IV — usability | Protocol, moderator guide, readiness status and blank observation form prepared | [Protocol](USABILITY_PROTOCOL.md), [moderator guide](USABILITY_SESSION_GUIDE.md), [pending results](USABILITY_RESULTS.md) | 0 sessions recorded; institutional/participant readiness pending; U4 fixture preparation verified synthetically; no approval, scores, observations or benefits invented |
| BAB IV — fixes/limitations | Seven lint errors and one observed schedules hydration error fixed/retested; U4 fixture gap closed synthetically | [Issue register](../evidence/sprint-6/issues.json), acceptance report | D6-05 complete for current observed issues; new actual integration/usability findings can reopen it |
| Contribution/revision evidence | Current worktree is tested; prior staged Sprint 5 work preserved | [Initial source context](../evidence/sprint-6/source-context.json), [follow-up source hashes/results](../evidence/sprint-6/follow-up-verification.json) | No new commit created; base HEAD hash is not a commit containing this uncommitted evidence. Add actual attributable revisions later if authorized. |

## Implemented sequence (offline boundary exercised)

```mermaid
sequenceDiagram
    actor Operator
    participant UI as Departure UI
    participant API as Departure API
    participant Auth as Existing verified auth
    participant Schedules as Schedule adapter/repository
    participant Route as Existing owner route/congestion
    Operator->>UI: Origin, terminal, destination, service, aware road plan, optional target
    UI->>UI: Validate inputs, clear old result, create cancellable generation
    UI->>API: POST /departure-recommendation with current bearer token
    API->>API: Strict JSON/schema/size validation and shared request budget
    API->>Auth: Verify credentials for structurally valid request
    Auth-->>API: Auth context or controlled 401/503
    opt Explicit target
        API->>Schedules: Independent bounded target lookup and binding validation
        Schedules-->>API: Target assessment or controlled 404/422/503
    end
    API->>Schedules: Bounded candidate lookup and metadata assessment
    Schedules-->>API: Candidate set, exclusions and truncation
    alt Automatic empty or incomplete candidate set
        API-->>UI: 200 UNAVAILABLE with reasons/limits
    else Route estimate required
        API->>Route: Same origin/terminal/road period, without cargo cutoff override
        Route-->>API: Already-adjusted final_time_min and confidence, or transport failure
        API->>API: Compare aware ETA with recorded cutoff, evaluate/rank candidates
        API-->>UI: Typed result/alternatives or controlled 503
    end
    UI->>UI: Parse/bind response, recheck account, ignore aborted/older generation
    UI-->>Operator: Status, reasons, signed buffer, dates, sources and simulation limits
```

The diagram describes implemented boundaries, not a captured live sequence. Structural validation may return 422 before auth; auth precedes schedule/route reads. Selected mode never silently substitutes a different target. One validated route estimate is reused for matching candidates. Empty automatic lookups/overflow can skip routing. HTTP outages are not successful UNAVAILABLE calculations.

## Calculation table for BAB III

```text
ETA = aware road departure + validated route final_time_min
buffer_min = (recorded cutoff - ETA).total_seconds() / 60
latest_departure_estimate = recorded cutoff - travel duration - configured safety buffer
```

| Required data / unrounded buffer | Backend status |
| --- | --- |
| Required occurrence or confidence data missing | UNAVAILABLE |
| buffer < 0 | MISSED |
| 0 <= buffer < positive configured threshold | RISKY |
| buffer >= threshold | SAFE |

Congestion is already included in `final_time_min`; it is not multiplied again. Known source zones are converted to Asia/Jakarta with full dates. Zero and negative values are meaningful; display rounding does not choose status. The latest-departure value reuses the submitted traffic-period duration and requires recalculation if adopted; it is not global traffic optimization.

Do not conclude reduced missed departures/emissions, observed traffic accuracy, real schedule reliability, improved usability, production latency or a population success rate from this evidence. Real integration and actual participant findings must be added separately with their actual limitations and denominators. D6-06 remains partial until those results exist or the final report explicitly records their incomplete status under the agreed academic scope.
