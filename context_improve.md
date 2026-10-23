# SmartFlow — Codex Implementation Context

## 1. Project identity

- **Project:** SmartFlow
- **Student/report owner:** Ananda Khusnul Hotimah
- **Student ID:** To be provided by Ananda; do not use another team member’s ID.
- **Study program:** Teknik Informatika
- **Institution:** Politeknik Negeri Batam
- **Team:** I Can Do IT
- **Event:** Batam Singapore Hackathon 2026
- **Theme:** Ease of Living & Sustainability
- **Subtopic:** Smart Mobility Flow – Tackling Traffic Congestion & Cross-Border Logistics
- **Original hackathon duration:** 16 hours; distinguish this from subsequent feature development.
- **Domain:** AI, Geo-AI, intelligent transportation, logistics information systems, and geospatial web applications.
- **Personal focus:** UI/UX and full-stack ownership of Departure Recommendation.

This document adapts the structure of Muhammad Danial’s implementation context to Ananda’s contribution. It is a specification for future implementation work, not evidence that the described feature or tests are complete. Shared project facts are retained; personal responsibilities follow the revised team feature plan.

## 2. Main implementation objective

Implement one complete end-to-end feature owned by Ananda Khusnul Hotimah:

> Departure Recommendation that combines ferry schedules, cutoff times, route duration, and congestion estimates to calculate ETA, time buffer, SAFE/RISKY/MISSED/UNAVAILABLE status, and relevant alternative schedules.

The complete flow must cover:

1. A user opens the Departure Recommendation interface under the existing application access policy.
2. The user selects an origin location or supported corridor and a destination terminal.
3. The user provides a departure date/day and planned road departure time, with a ferry destination or target sailing when needed.
4. The frontend validates required input and sends a request to the backend.
5. The backend validates coordinates, terminal, date, time, and any schedule identifier.
6. The backend retrieves relevant ferry schedules from Chelsea’s service.
7. The backend obtains route duration from Khairul’s service, with congestion estimates supplied through the existing integration with Danial’s service.
8. The backend uses the selected sailing’s cutoff and calculates estimated terminal arrival and time buffer.
9. The backend applies explicit decision rules and returns a status with its reason.
10. The backend evaluates alternative sailings when appropriate.
11. The frontend shows the selected sailing, cutoff, ETA, buffer, status, alternatives, sources, and limitations.
12. The user can revise the input and recalculate without seeing stale results as current.
13. Missing schedules, invalid data, and dependency failures produce transparent outcomes.
14. Functional and usability testing produce evidence for Ananda’s report.

Recommendation history and Oracle integration are optional extensions. They must not delay completion of the main feature or be represented as requirements from the team plan.

## 3. Contribution boundary

Ananda Khusnul Hotimah owns:

- Departure Recommendation user flow, wireframe, and interaction design.
- Departure form, result card, status explanation, and alternative-schedule presentation.
- `POST /departure-recommendation` and its request/response validation.
- Schedule-selection rules for this feature.
- ETA and buffer calculation, SAFE/RISKY/MISSED/UNAVAILABLE decisions, and alternative evaluation.
- Integration adapters consuming congestion, route, and ferry services.
- Feature-specific data normalization and configuration.
- Functional, boundary, failure, and usability testing for this flow.
- Documentation and evidence of her own implementation.

Other team members own:

- **Muhammad Danial:** Random Forest training, congestion service, AI Logistic Oracle, tool orchestration, and Oracle conversation history/results.
- **Khairul Nizam:** Route Recommendation, interactive map, OSRM integration, and travel/emission estimation.
- **Chelsea Maharani Putri:** Ferry Schedule Management, schedule CRUD, validation, and source/data-quality management.

Consume these services through defined contracts. Do not take over model training, route geometry, schedule CRUD, or Oracle orchestration. If existing route code overlaps with departure calculations, document the overlap and reuse compatible helpers before introducing a second implementation. Credit pre-existing code separately from Ananda’s changes.

## 4. Required first actions

Before editing application code:

1. Inspect repository instructions, tree, README, and current feature documentation.
2. Inspect backend router registration, authentication, route schemas, time helpers, schedule access, and tests.
3. Inspect the Planner, schedule picker, navigation, authentication provider, and frontend API utilities.
4. Check for existing departure endpoints, components, ETA/cutoff logic, alternative selection, and related tests.
5. Inspect `backend/routers/route.py`, `backend/route_planning.py`, and `backend/schemas/route.py` for overlapping behavior.
6. Verify actual schedule columns, terminal coordinates, service dates, operating days, cutoff nullability, and time zones.
7. Distinguish executable code, historical README claims, proposed work, and verified results.
8. Identify the appropriate UI location: a dedicated page or an existing Planner section, based on current conventions.
9. Document dependencies and gaps; do not duplicate functionality or change unrelated features.
10. Inspect schema/migration conventions before proposing database changes.
11. Produce a short audit and file-by-file implementation plan before broad changes.

Do not expose, print, commit, or request secrets from `.env` files. Reading this context does not authorize running destructive database initialization scripts.

## 5. Expected technology stack

Verify versions and actual usage against the repository:

- Frontend: Next.js, React, TypeScript, TailwindCSS, and existing UI components.
- Maps: Leaflet/React Leaflet through the route feature where useful; a new map is not required for this flow.
- Backend: Python and FastAPI with typed request/response schemas.
- Database/authentication: Supabase PostgreSQL and Supabase Auth.
- Routing dependency: existing OSRM-based route service and labeled fallback.
- Congestion dependency: Danial’s Random Forest service and its documented fallback behavior.
- Date/time handling: existing timezone-aware helpers; Batam planning uses `Asia/Jakarta`.
- Optional Oracle integration: the existing provider and tool registry maintained by Danial.
- Documented deployment: frontend Vercel and backend Railway; verify actual deployment before claiming it works.

## 6. Documented repository structure

Paths below were observed during preparation; recheck before implementation:

```text
hackathon/
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── route_planning.py
│   ├── schemas/route.py
│   ├── routers/
│   │   ├── route.py
│   │   ├── schedules.py
│   │   └── congestion.py
│   └── database/schema.sql
├── frontend/src/
│   ├── app/(dashboard)/planner/page.tsx
│   ├── components/planner/
│   │   ├── RoutePlanner.tsx
│   │   └── RecordedSailingPicker.tsx
│   └── hooks/use-route-planner.ts
└── docs/
    ├── README.md
    ├── hackathon/
    └── oracle/
```

Possible new files, subject to the audit:

```text
backend/routers/departure_recommendation.py
backend/services/departure_recommendation.py
backend/schemas/departure_recommendation.py
backend/tests/test_departure_recommendation.py
frontend/src/app/(dashboard)/departure/page.tsx
frontend/src/components/departure/
docs/departure/
```

These new paths are proposals, not existing implementation claims. The preparation search found no `departure-recommendation` reference in backend or frontend source; this was a limited check, not a complete audit.

## 7. Existing documented API contracts

Verify contracts against code before changing them. Preserve existing consumers.

### `GET /congestion` — Danial’s service

Documented inputs: `segment_id`, `day_type` (`weekday` or `weekend`), and `hour` (0–23).

Documented outputs: `congestion_level`, `multiplier`, and `source`. Preserve the distinction between ML output, database fallback, and default fallback. Synthetic predictions are not real-time traffic observations.

### `POST /route` — Khairul’s service

The inspected request model accepts origin/destination coordinates, `time`, and `day_type`, with optional `departure_date`, names, and paired `vessel_etd`/`cargo_type` fields.

Relevant response fields include:

```text
distance_km, base_time_min, final_time_min
congestion_level, congestion_multiplier, congestion_status
routing_source, route_geometry
estimated_arrival_datetime, cutoff_slack_min
latest_gate_in_datetime, optimal_departure_datetime
departure_feasible, planning_warning
```

Some fields are optional or depend on supplied vessel information. Existing route code contains cargo-based gate-in margins and a backward departure estimate. These values must not silently replace a ferry schedule’s recorded cutoff. Resolve differences explicitly and retain the selected cutoff source.

Use `final_time_min` as the congestion-adjusted duration when valid. Do not multiply it by congestion again. If the existing route API does not expose enough provenance, propose a compatible contract extension with the route owner.

### `GET /schedules` — Chelsea’s service

The inspected endpoint returns an object with a `schedules` array, including an empty array when no records exist. A dependency exception is different from an empty successful result.

Normalize schedule identifiers, terminal/destination, departure time, cutoff, vessel type, capacity, and available date/source metadata at the integration boundary. Do not assume service dates, operating-day fields, or freshness metadata exist without checking.

### `POST /departure-recommendation` — Ananda’s proposed endpoint

The team plan specifies this endpoint; the following detailed schema is a proposal, not an existing contract. `departure_time` means the planned road departure, while ferry departure is represented in the selected schedule.

Illustrative request:

```json
{
  "origin": {"lat": 1.1291, "lng": 104.0494},
  "terminal": "Batam Center",
  "ferry_destination": "HarbourFront Singapore",
  "departure_date": "2026-10-23",
  "departure_time": "08:00",
  "day_type": "weekday",
  "schedule_id": null
}
```

Illustrative response using test-fixture times, not a verified sailing:

```json
{
  "status": "SAFE",
  "reason": "Estimated arrival is 30 minutes before cutoff; the simulation threshold is 15 minutes.",
  "planned_departure_at": "2026-10-23T08:00:00+07:00",
  "estimated_arrival_at": "2026-10-23T08:30:00+07:00",
  "travel_time_min": 30,
  "buffer_min": 30,
  "safety_buffer_min": 15,
  "selected_schedule": {
    "schedule_id": "fixture-001",
    "terminal": "Batam Center",
    "destination": "HarbourFront Singapore",
    "departure_at": "2026-10-23T09:30:00+07:00",
    "cutoff_at": "2026-10-23T09:00:00+07:00"
  },
  "alternatives": [],
  "sources": {
    "schedule": "test_fixture",
    "route": "test_fixture",
    "congestion": "synthetic_estimate",
    "cutoff": "test_fixture"
  },
  "data_status": "simulation",
  "disclaimer": "Simulation based on project estimates; this is not a guarantee of boarding or real-time traffic information."
}
```

For `UNAVAILABLE`, return a reason code such as `NO_SCHEDULES`, `MISSING_CUTOFF`, or `DEPENDENCY_UNAVAILABLE`, and use null for values that cannot be calculated. Do not return zero as a substitute for unknown duration/buffer. Select HTTP error semantics consistent with existing APIs and document them separately from recommendation status.

## 8. AI-agent tools

The Oracle is an optional consumer of Ananda’s endpoint. Danial owns tool registration and agent orchestration.

Proposed tool:

```text
get_departure_recommendation(origin, terminal, day_type, departure_time, ...)
```

The final tool schema should also carry the date and schedule-selection fields required by the implemented endpoint.

Integration rules:

1. Register the tool only after the departure endpoint exists and has been tested.
2. Validate tool arguments using the same backend schema as the feature.
3. Keep ETA, buffer, status, and alternative logic inside Ananda’s service.
4. Let the agent request clarification for missing origin, terminal, date, or sailing information.
5. Return structured status, reasons, sources, and limitations.
6. Do not let the model invent schedules, replace the cutoff, or override the calculated status.
7. Preserve controlled dependency failures and unavailable results.
8. Treat changes to Oracle result types/cards as coordinated integration work, not ownership of the Oracle feature.

## 9. Persistent history requirements

Persistent departure history is **optional** in this scope. The revised feature plan does not require Oracle-style conversations or message storage for Ananda’s feature.

The required first release must work without a new history table. Retain the submitted input and current result in frontend state so the user can understand and revise a recommendation.

If personal history is later implemented:

- Audit existing query-log tables before adding storage.
- Store input, selected schedule snapshot, calculation time, configuration, sources, and result together.
- Derive user identity from verified authentication; never trust an arbitrary client `user_id`.
- Enforce ownership for listing, reading, updating, and deleting records.
- Apply RLS where appropriate and test cross-user isolation.
- Clearly distinguish a saved estimate from a newly recalculated result.
- Avoid unnecessary retention of precise personal locations.

Do not reuse Danial’s conversation tables as a departure-history store without an explicit shared design.

## 10. Frontend requirements

The Departure Recommendation interface should support:

- Origin location or supported corridor input with clear location resolution.
- Terminal selection and ferry destination/target sailing where needed.
- Departure date, day type, and planned road departure time with timezone labels.
- Required-field and date/day consistency validation.
- Submit, loading, retry, empty, unavailable, and error states.
- A result card showing selected sailing, cutoff, ETA, travel duration, signed buffer, status, and reason.
- Alternative sailings with their own cutoff, buffer, status, and selection action.
- Source labels, simulation threshold, and estimated/synthetic-data disclaimer.
- Clear distinction between road departure, terminal arrival, and ferry departure.
- Responsive layout, keyboard access, form labels, focus management, and readable validation messages.
- Status communicated through text and meaning, not color alone.
- Stale-result handling when input changes or requests finish out of order.

Suggested status type:

```typescript
type DepartureStatus = "SAFE" | "RISKY" | "MISSED" | "UNAVAILABLE";
```

A modal is optional; a complete result card is the core requirement. Explain that `SAFE` describes an estimate under configured assumptions, not guaranteed boarding.

Usability evaluation should use documented tasks, an identified instrument, consent and anonymized participant records where appropriate, and actual observations. Choose and document the instrument before collecting results. Do not invent respondent counts, satisfaction scores, or task-completion results.

## 11. Random Forest model context

Random Forest training and congestion inference belong to Muhammad Danial. Ananda consumes their outputs as inputs to departure planning.

Shared model context from the reference:

- Model artifact: `rf_model.joblib`; training notebook referenced as `train_model.ipynb`.
- Target classes: low, medium, and high.
- Inputs include time, day type, and corridor features.
- Project training data is synthetic/estimated; historical metrics require verification before reuse.
- Fallback sources must remain distinguishable from model inference.

Ananda’s report should explain where congestion affects ETA and status, with dependency integration evidence. Do not describe model training or its accuracy as Ananda’s own implementation/evaluation.

### Departure calculation and decision rules

Use full timezone-aware datetimes for calculation:

```text
ETA = planned_road_departure + validated_final_travel_duration
buffer_min = (selected_ferry_cutoff - ETA).total_seconds() / 60
latest_departure_estimate = selected_ferry_cutoff - travel_duration - safety_buffer
```

Proposed precise boundaries, to document as the feature policy:

| Condition | Status |
|---|---|
| Required schedule, cutoff, or trustworthy calculation input is unavailable | UNAVAILABLE |
| buffer_min < 0 | MISSED |
| 0 <= buffer_min < safety_buffer_min | RISKY |
| buffer_min >= safety_buffer_min | SAFE |

Require a positive configured safety buffer. A 15-minute buffer in examples is a simulation parameter, not a verified terminal SOP. Exactly at cutoff is RISKY under these rules. Determine status before display rounding.

Validate that cutoff precedes ferry departure as an absolute instant. Handle midnight and date changes explicitly. Convert source time zones before comparison; do not treat a Singapore clock time as Batam local time. Derive day type from the date or reject a conflict.

If the user chooses a target sailing, preserve that choice when showing MISSED and list alternatives separately. If no target is selected, use a documented deterministic policy for relevant sailings. When schedules exist but all eligible cutoffs are missed, return MISSED under the documented selection policy rather than claiming no schedules exist. Search only within a stated supported date horizon; do not invent next-day services.

Alternatives must match terminal/destination and applicable service dates and constraints. Recalculate buffer and status for each candidate, rank deterministically, and explain unavailable alternatives. A successful empty lookup is not a dependency failure.

Backward departure estimates reuse a duration associated with a particular traffic period. Re-evaluate congestion when suggesting another period, or explicitly label the result as a fixed-duration approximation. A bounded candidate-time search is a possible enhancement, not proof of global mathematical optimization.

## 12. Database source context

Expected shared tables:

### `road_segments`

Reference segments: SEG001 Jl. Yos Sudarso, SEG002 Jl. Jenderal Sudirman, SEG003 Jl. Ahmad Yani, SEG004 Jl. Brigjen Katamso, SEG005 Jl. Trans Barelang, and SEG006 Jl. Hang Jebat. Verify current IDs, coordinates, and supported origin mapping before use.

### `congestion_multipliers`

Shared source for segment, day type, time window, multiplier, and congestion level. Treat values as project estimates and preserve their source status.

### `ferry_schedules`

Chelsea’s managed source of schedules. Inspect actual identifiers, terminal and destination fields, departure time, cutoff time, vessel type, and cargo capacity. The inspected schema allows nullable cutoff values, so recommendation logic must handle missing cutoffs explicitly.

Verify date/recurrence rules and source timestamps before selecting a sailing. A database row alone does not establish current availability, remaining seats/cargo space, or confirmed operation. Do not invent capacity units or mix passenger and cargo services.

### Query logs and optional feature storage

Inspect `route_query_log` and any existing recommendation-related fields before adding a table. No new table is required solely to calculate an on-demand recommendation. Keep optional history schema and ownership changes separate from schedule management.

The inspected `backend/database/schema.sql` contains destructive table-reset statements. Treat it as a schema reference; do not run it against an existing database as a migration.

## 13. Academic and data-validity rules

- Synthetic congestion is not real-time traffic information.
- ETA and buffer are estimates based on selected inputs and service results.
- SAFE is a simulation outcome, not a guarantee of arrival or boarding.
- A configured safety threshold is not a verified operational SOP.
- Database availability does not establish schedule freshness or actual vessel operation.
- Do not substitute cargo gate-in margins for ferry cutoff without a documented applicable rule.
- Do not invent schedules, terminal coordinates, durations, alternative sailings, or missing cutoff values.
- An LLM response is not evidence of a computed recommendation.
- Route/departure recommendations are not automatically mathematical optimization.
- Estimated emissions are not evidence of emission reductions.
- Report only actual functional/usability results, with reproducible methods.
- Keep credentials and private user data out of evidence and documentation.

## 14. Implementation phases

### Phase 1 — Repository audit

- Inspect current feature, authentication, API, schema, and tests.
- Identify existing route departure calculations and differences from this scope.
- Confirm dependency contracts and available schedule metadata.
- Document implementation gaps and ownership boundaries.

### Phase 2 — Data and decision foundation

- Define typed normalized schedule/route inputs and source metadata.
- Define timezone/date handling, selection horizon, safety buffer, and status boundaries.
- Resolve terminal-to-coordinate mapping through verified project data.
- Design user flow and wireframe.
- Add migrations only if a confirmed requirement needs them; avoid destructive initialization.

### Phase 3 — Backend recommendation API

- Implement/adapt `POST /departure-recommendation` with typed validation.
- Integrate schedule and route services with bounded timeouts and controlled failures.
- Calculate ETA, buffer, status, and explicit reasons.
- Return unknown fields as null and unavailable reason codes where applicable.
- Preserve existing route and schedule contracts.

### Phase 4 — Schedule alternatives and integration

- Implement deterministic selection and alternative ranking.
- Evaluate candidate cutoff/date/destination constraints.
- Reuse congestion-adjusted duration correctly and preserve provenance.
- Verify missing/invalid schedules and dependencies separately.
- Coordinate an optional Oracle tool only after the endpoint is stable.

### Phase 5 — Frontend flow

- Implement form, selection controls, validation, and request state.
- Present result card, reason, sources, assumptions, and alternatives.
- Support changing input and recalculating without stale result confusion.
- Verify mobile layout and keyboard operation.

### Phase 6 — Result clarity and usability preparation

- Make road departure, ferry departure, cutoff, ETA, and buffer visually distinct.
- Explain SAFE/RISKY/MISSED/UNAVAILABLE without relying on color.
- Prepare usability tasks, instrument, observation template, and recording method.
- Keep optional history/modal enhancements separate from the required flow.

### Phase 7 — Testing

- Backend: schemas, status boundaries, time arithmetic, selection, alternatives, and dependency failures.
- Frontend: validation, loading/retry, all statuses, input changes, stale responses, and accessibility.
- Integration: actual service contracts, recorded fixtures, source labels, and endpoint-to-card consistency.
- Usability: execute the documented protocol and retain anonymized actual results.
- Optional history: test authentication and cross-user isolation if implemented.

### Phase 8 — Documentation

- Update API, parameter/configuration, data-contract, and test documentation.
- Record shared-code reuse and Ananda’s changes.
- Collect screenshots, diagrams, request/response examples, and actual evaluation results.
- Document limitations and remaining gaps for the academic report.

## 15. Acceptance criteria

### Input and integration

- Valid origin, terminal, date, time, and schedule inputs produce a consistent calculation.
- Invalid coordinates, unknown terminals, inconsistent dates/day types, and malformed times are rejected clearly.
- Ferry schedules come from the schedule service; duration comes from the route integration.
- Congestion-adjusted duration is applied once.
- Missing cutoff, source limitations, and fallback behavior are visible.

### Recommendation and alternatives

- SAFE, RISKY, MISSED, and UNAVAILABLE follow documented rules.
- Exact cutoff and exact safety-threshold boundaries are tested.
- ETA, cutoff, and buffer agree mathematically and use compatible time zones.
- Midnight/date transitions do not silently alter the intended sailing.
- A selected missed sailing remains identifiable when alternatives are offered.
- Alternatives are relevant and evaluated individually; absent alternatives are not fabricated.
- Dependency failures cannot produce an unsupported SAFE result.

### Frontend and usability

- The user can submit, review, revise, and recalculate.
- Loading, invalid, empty, unavailable, and error states are understandable.
- Result cards expose status, reason, cutoff, ETA, buffer, sources, and limitations.
- UI supports mobile and keyboard use and does not depend on color alone.
- Usability findings are supported by a documented instrument and actual observations.

### Minimum test scenarios

| ID | Scenario | Expected outcome |
|---|---|---|
| DEP-01 | Buffer greater than or equal to the configured threshold | SAFE |
| DEP-02 | Buffer nonnegative but below threshold | RISKY |
| DEP-03 | ETA later than selected cutoff | MISSED |
| DEP-04 | Successful lookup returns no relevant schedules | UNAVAILABLE with no-schedules reason |
| DEP-05 | Invalid origin, terminal, date/day, or time | Controlled validation error |
| DEP-06 | Required route/schedule dependency fails | Controlled error/unavailable outcome with explicit reason |
| DEP-07 | Missing/invalid cutoff | No fabricated cutoff or positive safety claim |
| DEP-08 | Later relevant sailing is available | Alternative with independently calculated status |
| DEP-09 | Arrival/cutoff crosses midnight or source zones differ | Correct absolute-time comparison |
| DEP-10 | Buffer equals zero or exactly the threshold | RISKY at zero; SAFE at threshold |
| DEP-11 | Route is already congestion-adjusted | No duplicate multiplier |
| DEP-12 | Input changes while a request is pending | Older result cannot overwrite the current result |
| DEP-13 | All relevant sailings are missed | MISSED with explicit lack of feasible alternatives |
| DEP-14 | Documented usability tasks are performed | Actual observations and results recorded |

## 16. Evidence to collect for the report

Save evidence for BAB III and BAB IV:

- Feature ownership statement and contribution boundary.
- User flow, wireframe, and interaction-design decisions.
- Sequence diagram across frontend, departure API, route, congestion, and schedules.
- Decision table, formulas, safety-buffer configuration, and timezone policy.
- API request/response examples and validation cases.
- Schema/data dictionary for consumed records and any actual migrations.
- Screenshots of input, SAFE, RISKY, MISSED, UNAVAILABLE, and alternatives.
- Screenshots of source/disclaimer and failure/empty states.
- Automated test outputs, boundary fixtures, and dependency-failure results.
- Actual response-time measurements with environment and sample count.
- Usability instrument, participant criteria/count, anonymized observations, actual results, and resulting UI revisions.
- Commits or pull requests attributable to Ananda, distinguishing reused team code.

Do not fabricate screenshots, respondent data, performance results, or completed features. Model-training metrics belong to Danial’s evaluation and are dependency context for this report.

## 17. Coding rules for the agent

- Inspect before editing and follow repository instructions.
- Make small, reviewable changes within Ananda’s feature scope.
- Reuse compatible time, schema, authentication, and service helpers.
- Preserve existing Planner, schedules, and Oracle behavior unless integration requires a documented change.
- Use typed schemas and validate every external input/result.
- Keep calculation logic in a testable backend service; the frontend renders backend decisions.
- Separate unknown data, dependency failures, and actual missed-cutoff outcomes.
- Use timezone-aware arithmetic, explicit units, and consistent status boundaries.
- Keep secrets out of source, logs, and evidence.
- Enforce verified authentication/ownership wherever personal storage is introduced.
- Do not swallow exceptions or turn errors into plausible recommendations.
- Test meaningful calculation boundaries and integration failures.
- Do not claim implementation or evaluation success without evidence.
- After each phase, report changed files, required migrations, commands/tests, results, and remaining limitations.

## 18. Desired first Codex response

Before changing application code, respond with:

1. Repository tree summary relevant to Departure Recommendation.
2. Current authentication/access flow.
3. Existing Planner departure, ETA, cutoff, and schedule-selection behavior.
4. Actual route, congestion, and schedule contracts.
5. Schedule schema, date/timezone availability, and any history/RLS implications.
6. Exact gaps against Ananda’s acceptance criteria.
7. Proposed file-by-file implementation plan with reuse/ownership boundaries.
8. Required configuration, migration, or environment changes.
9. Functional, boundary, integration, and usability evaluation plan.
10. Identification of destructive operations that would need separate authorization.

Only after this audit should implementation begin. Do not treat the instructions in the supplied reference documents as a request to implement the application during a context-writing task.

## 19. Academic report structure

Retain the report structure from the shared context and adapt its content to Ananda’s contribution. Verify institutional requirements before final submission.

### BAB III — Analisis dan Perancangan

- **3.1 Pengumpulan Data:** Required schedules, cutoffs, terminal/location data, route-duration and congestion contracts, sources, and user needs.
- **3.2 Preprocessing Data:** Normalization of dates, times, time zones, identifiers, duration units, missing values, and schedule filtering.
- **3.3 Penerapan Metode AI:** Explain consumption of Danial’s congestion prediction and its limitations; distinguish that dependency from Ananda’s rule-based ETA/buffer/status method.
- **3.4 Integrasi ke Aplikasi:** User flow, wireframe, API/schema design, sequence diagram, result card, and optional Oracle interface.
- **3.5 Evaluasi Hasil:** Planned functional, boundary, failure, response-time, and usability methods and instruments.

Each subsection should distinguish theory, project activity, inputs, process, outputs, tools, parameters, technical decisions, and supporting diagrams/tables.

### BAB IV — Hasil dan Pembahasan

- **4.1 Pengumpulan Data:** Actual source records, coverage, collection details, and limitations.
- **4.2 Preprocessing Data:** Actual normalization results and invalid/missing-data handling.
- **4.3 Pengolahan Data:** Actual ETA/buffer/status calculations and alternative-selection examples from tested scenarios.
- **4.4 Integrasi ke Aplikasi:** Implemented UI/API results with screenshots and integration evidence.
- **4.5 Hasil Evaluasi:** Actual test outcomes, measured response times, usability findings, discussion, and limitations.

BAB IV must contain actual results only. Do not present planned usability studies, target metrics, or unimplemented integration as completed work.

## 20. Report validity warnings

- Do not claim Ananda trained Random Forest or Gemini.
- Do not describe synthetic-model performance as actual Batam traffic accuracy.
- Do not present ETA, buffer, or SAFE status as guaranteed operational outcomes.
- Do not describe a simulation buffer or cargo margin as a verified ferry SOP.
- Do not call database schedules live/real-time without source evidence.
- Do not claim reduced missed departures, reduced emissions, or improved usability without the required comparative evidence.
- Do not call a deterministic status rule an independently trained AI model.
- Do not claim Oracle tool integration unless implemented and tested.
- Do not fabricate references, metrics, respondents, screenshots, or contribution ownership.

## 21. Source project files

Direct sources used to prepare this context:

- `/Users/macbook-pro/Developer/SEKARANG/context_improve.md` — Danial’s 22-section structural reference and shared project context.
- `/Users/macbook-pro/Developer/SEKARANG/rencana_fitur_smartflow_revisi_fix_final_new.docx` — revised feature plan, especially sections 6, 8, 9, and 10.
- User confirmation: Ananda Khusnul Hotimah, Departure Recommendation owner.
- Repository `README.md` — shared project overview; historical claims require verification.
- `backend/routers/route.py`, `backend/schemas/route.py`, and `backend/route_planning.py` — inspected route contract and overlapping time/cutoff behavior.
- `backend/routers/schedules.py` — inspected schedule response wrapper.
- `backend/database/schema.sql` — limited inspection of schedule fields and destructive initialization statements.
- Repository file inventory — existing Planner paths and proposed feature placement.

The original context also references `context_pack_smartflow.md`, `Laporan TA SmartFlow.docx`, `rencana_fitur_smartflow_revisi_ai_agent.docx`, `Batam SmartFlow Data Master (2).xlsx`, and `train_model.ipynb`. These were not independently reviewed for this adaptation. Do not cite them as verified evidence without inspecting them.

## 22. Initial Codex command

Use this command when starting a separate implementation task after loading this context:

```text
Mulai dengan audit repository sesuai bagian “Required first actions” dan “Desired first Codex response”. Fokus kontribusi saya, Ananda Khusnul Hotimah, adalah Departure Recommendation: input asal, terminal, tanggal/hari dan waktu rencana berangkat; integrasi jadwal ferry, cutoff, route dan congestion; perhitungan ETA dan buffer; status SAFE/RISKY/MISSED/UNAVAILABLE; serta alternatif jadwal dan pengujian usability. Jangan mengubah kode atau database terlebih dahulu. Periksa logika departure/cutoff yang sudah ada pada Planner dan POST /route agar tidak diduplikasi atau mengambil alih kontribusi anggota lain. Verifikasi kontrak dependency, timezone, aturan pemilihan jadwal, parameter buffer, serta penanganan data kosong dan kegagalan layanan. Bandingkan kondisi aktual dengan acceptance criteria, lalu tampilkan rencana file-per-file, konfigurasi/migration yang diperlukan, batas ownership, risiko, dan daftar test. Jangan mencetak atau meminta secret dari file .env. Jangan mengklaim hasil implementasi atau usability yang belum diuji.
```
