# Departure Recommendation API v1.0

23 October 2026, Asia/Jakarta. D1-02 frozen design; endpoint and schemas are not implemented. Ananda owns this boundary. Existing route, schedule, congestion, and Oracle APIs remain unchanged. See [schedule/decision policy](../data/SCHEDULE_POLICY.md) for normative normalization, confidence, ranking, and bounds. [Examples](DEPARTURE_API_EXAMPLES.json) are synthetic expected payloads, not captured API responses.

## Request

`POST /departure-recommendation`, JSON, verified `Authorization: Bearer <session token>`. Reuse `backend/auth.py` and the current session token; no new provider, service-role credential, user ID field, or AI call. The new `/departure` page is explicitly protected when implemented in Sprint 5. Request size limit: 8192 UTF-8 bytes. Strict types: no booleans as numbers, string-to-number coercion, NaN/Infinity, duplicate JSON object keys, or unknown properties.

| Field | Type / rule |
| --- | --- |
| `origin` | Required object with exactly numeric `lat`, `lng`. Finite; use existing project envelope `0.7 <= lat <= 1.25`, `103.8 <= lng <= 104.3`. Named origins resolve via the existing catalog before submission. |
| `origin_name` | Optional string/null, trim, 1–256 characters when present; display only, never overrides coordinates. |
| `terminal` | Required enum: `batu_ampar`, `batam_center`, `sekupang`. Backend resolves terminal coordinates; no destination point accepted. |
| `ferry_destination` | Required string, 1–80 characters after trim/whitespace normalization; exact casefolded match. Required in v1 to prevent ambiguous automatic selection. |
| `departure_date` | Required real ISO calendar date `YYYY-MM-DD`; road departure's Jakarta date. No browser-locale parsing. |
| `departure_time` | Required strict `HH:MM` 24-hour road clock in `Asia/Jakarta`; seconds/AM-PM/zone suffixes rejected on this wire boundary. |
| `service_date` | Required real ISO date of ferry departure in Jakarta; same date as road departure or next date only. Explicit one-day horizon; no recurrence inferred. |
| `service_kind` | Required enum `cargo` or `passenger_hand_carry`; never infer it from tonnage or vessel label. |
| `day_type` | Optional enum/null `weekday` or `weekend`; derive from road date (Mon–Fri/Sat–Sun). If supplied, reject mismatch. No holiday classification is invented. |
| `schedule_id` | Optional canonical lowercase hyphenated UUID/null. Present selects that exact target; absent/null requests automatic choice. Occurrence is the tuple of this UUID and `service_date`. |

Unknown/invalid fields, dates, time, UUID, coordinates, or horizon give 422 before dependency calls. No client safety threshold, source zone, arbitrary cutoff, route duration, simulation mode, or auth identity override is accepted. V1 accepts historical dates for reproducible planning scenarios; emit `HISTORICAL_PLAN` when the road instant precedes calculation time. This is an estimate/scenario, not a booking or dispatch authorization.

## Normalized dependency types

These are injected backend inputs, not client fields. Numeric values are finite, strict, with explicit units. All datetimes are aware ISO 8601 instants; serialize normalized response instants with `+07:00`.

| Type | Required fields / meaning |
| --- | --- |
| `ScheduleOccurrence` | `schedule_id: UUID`, `occurrence_id: UUID@YYYY-MM-DD`, `terminal: Terminal`, `destination: string[1..80]`, `service_date: date`, `allowed_service_kinds: ServiceKind[]`, `source_timezone: IANA zone`, `source_departure_at: aware datetime`, `source_cutoff_at: aware datetime`, `departure_at: Jakarta datetime`, `cutoff_at: Jakarta datetime`, `verified_at: aware datetime`, `source: database|synthetic_fixture`. Validate identity/date/offset/cutoff consistency per policy. |
| `ScheduleView` | Same keys as occurrence; unknown metadata values are null, identity/terminal/destination preserved when known. Used only for unavailable selected targets. Do not pretend this is a validated occurrence. |
| `RouteEstimate` | `final_time_min: number[0..1440]`, `routing_source: string[1..80]`, `congestion_status: synthetic_estimate|default_fallback|unavailable|null`, `context_verified: boolean`, `estimated_arrival_at: Jakarta datetime`. Derived adapter evidence is not added to shared `RouteData` by this document. |
| `Config` | `safety_buffer_min: finite number >0`, default 15; `schedule_max_age_min: finite number >0`, default 1440. Both are server simulation parameters, validated at startup. Candidate/alternative limits fixed at 100/3 in v1. |

Absent `ScheduleView` data stays null. Unknown applicability is a null list; known incompatibility is an empty or nonmatching list. Adapters retain raw values privately for normalization, but responses omit arbitrary raw rows and exceptions.

## Successful response

All keys below are required on a 200; missing optional information is explicit null. Reject additional properties in new backend/frontend contracts. Response limit: 65536 UTF-8 bytes, including bounded arrays. No route geometry or personal history is required.

| Field | Type / invariant |
| --- | --- |
| `contract_version` | Literal `1.0`. |
| `status` | `SAFE`, `RISKY`, `MISSED`, or `UNAVAILABLE`. Backend decides. |
| `reason_code`, `reason` | Code from tables below; safe explanation 1–500 characters. |
| `plan` | Canonical request with every defined request field present; `day_type` derived, normalized strings, absent name/target null. Coordinates authoritative. |
| `planned_departure_at` | Required road instant in Jakarta, derived only from the explicit road date/time. |
| `selected_schedule` | Valid `ScheduleOccurrence` for calculated decisions; partial `ScheduleView` or null for UNAVAILABLE. Selected mode never substitutes another UUID. |
| `travel_time_min`, `estimated_arrival_at`, `buffer_min`, `latest_departure_estimate_at` | Calculated decisions: finite duration, aware ETA, signed finite buffer, aware backward estimate. UNAVAILABLE: all four null; any usable route-only estimate appears separately. |
| `safety_buffer_min` | Positive configured simulation threshold, including unavailable outcomes. |
| `route_estimate` | `RouteEstimate` or null; a retained approximate/untrusted estimate does not establish a recommendation. Label its confidence. |
| `alternatives` | 0–3 objects with exactly `schedule`, `status`, `reason_code`, `reason`, `estimated_arrival_at`, `travel_time_min`, `buffer_min`, `latest_departure_estimate_at`. `schedule` is a valid occurrence; status only SAFE/RISKY, with its own arithmetic. Same road plan/threshold. Always empty for an UNAVAILABLE main result in v1. |
| `selection` | Exactly `mode: selected|automatic`, `service_date: date`, `examined_count: integer[0..101]`, `excluded_count: integer[0..101] <= examined_count`, `candidate_limit: 100`, `truncated: boolean`. Counts describe unique bounded occurrences, not total database rows. |
| `exclusions` | 0–101 objects: `schedule_id: UUID|null`, `reason_code: bounded string`. Only safe identity/reason; malformed missing UUID can be null. |
| `sources` | Exactly `schedule`, `route`, `congestion`, `cutoff`: each string[1..80] or null. Examples: `synthetic_fixture`, `database`, `OSRM API`, `synthetic_estimate`. Preserve upstream source names. |
| `data_status` | `simulation` for current calculated decisions, which use synthetic congestion/project points; `unavailable` for unavailable decisions. Never describe these as observed live traffic or guaranteed boarding. |
| `assumptions` | At most 20 strings, each 1–500 characters; include representative terminal point, synthetic congestion, and fixed-duration backward estimate. No silent date/zone/recurrence assumptions. |
| `warnings` | At most 20 objects `{code: string[1..80], message: string[1..500]}`. If more exclusions/warnings arise, aggregate safely and disclose summarization. |
| `calculated_at` | Aware server clock serialized in Jakarta; injected fixed clock for fixtures. |
| `disclaimer` | String 1–1000: planning simulation, no boarding guarantee, no observed-traffic claim. |

Current calculated reason codes are `BUFFER_SUFFICIENT`, `BELOW_SAFETY_BUFFER`, `CUTOFF_MISSED`. Unavailable codes: `NO_SCHEDULES`, `NO_RELEVANT_SCHEDULES`, `NO_EVALUABLE_SCHEDULES`, `MISSING_SERVICE_DATE`, `MISSING_SOURCE_ZONE`, `INVALID_SOURCE_ZONE`, `MISSING_DEPARTURE`, `INVALID_SCHEDULE`, `MISSING_CUTOFF`, `INVALID_CUTOFF`, `SERVICE_UNKNOWN`, `FRESHNESS_UNKNOWN`, `INVALID_FRESHNESS`, `STALE_SCHEDULE`, `AMBIGUOUS_SCHEDULE`, `ROUTE_FALLBACK`, `CONGESTION_UNAVAILABLE`, `ROUTE_CONTEXT_UNKNOWN`, `CANDIDATE_LIMIT`. Exclusions may additionally use `SCHEDULE_MISMATCH` and `SERVICE_MISMATCH`. Unknown required row fields that prevent even identity normalization count as `NO_EVALUABLE_SCHEDULES`, not empty success. Selected-row priority follows the policy.

Warnings include `HISTORICAL_PLAN`, `EXCLUDED_CANDIDATES`, `ALTERNATIVES_TRUNCATED`, `DUPLICATE_RECORD_COLLAPSED`, `POSSIBLE_DUPLICATE_SAILING`, and `BACKWARD_ESTIMATE_FIXED_DURATION`. Examples are authoritative for structure; prose arithmetic/validation invariants also apply. HTTP errors contain no successful recommendation body.

## Transport errors and authentication compatibility

| HTTP | Trigger | Body |
| --- | --- | --- |
| 200 | Successful lookup/calculation or domain-data unavailability | Successful response above; empty success is not a dependency outage |
| 401 | Missing/invalid/expired token | Reuse existing auth `{"detail":"Invalid or expired authentication credentials"}` and `WWW-Authenticate: Bearer` |
| 404 | Explicit target UUID absent | `{"detail":{"code":"SCHEDULE_NOT_FOUND","message":"Selected sailing was not found.","fields":["schedule_id"]}}` |
| 413 | Request exceeds 8192 bytes | Departure detail object with `REQUEST_TOO_LARGE`, safe message, empty `fields` |
| 422 | Structural input validation | Standard FastAPI `detail` array of bounded `loc`, `msg`, `type` entries; the new endpoint must sanitize/omit input/context echo without altering unrelated routes |
| 422 | Known terminal/destination/date conflict or service incompatibility | Departure detail object with `SCHEDULE_MISMATCH` or `SERVICE_MISMATCH` and affected request field names |
| 503 | Auth service outage | Existing auth `{"detail":"Authentication service is temporarily unavailable"}`, `Retry-After: 5` |
| 503 | Required schedule/route exception or timeout; malformed dependency output; response size overflow | Departure detail object with `DEPENDENCY_UNAVAILABLE`, `DEPENDENCY_TIMEOUT`, `INVALID_DEPENDENCY_RESPONSE`, or `RESPONSE_LIMIT`; safe message and empty `fields` |

Departure detail objects have exactly `code`, `message`, `fields` (at most 10 field-name strings); do not include URLs, SQL, tokens, exception strings, or raw payloads. Frontend parser explicitly supports these three failure shapes: auth string, validation array, departure detail object. Surface a bounded safe message, expire state on 401, and never retain a successful card after error. Reuse auth's response shape rather than silently promising a new auth error envelope. Request-scoped transport and blocking I/O budgets are implemented and verified in D3-03; this sprint makes no latency claim.

## Design refinements and follow-up

V1 makes destination, service kind, and separate service date required to remove selection ambiguity. It uses UUID identity and explicitly dated occurrences rather than inferring real dates from clock rows. Haversine is unavailable for decisions; synthetic OSRM/model estimates require established corridor context. These resolve the planning defaults without modifying team services. Future support for recurrence, terminal-specific SOPs, or observed traffic needs a versioned policy update and evidence.

Selected and automatic synthetic 200 examples, missing-cutoff 200, dependency 503, and validation 422 are in the examples file and checked against the fixture matrix. No endpoint was called to obtain them. Implementation is assigned to D2-01–D2-05 (models/calculation), D3-01–D3-05 (adapters/auth/API), D4-01–D4-05 (selection), and D5-02/D5-05 (parser/lifecycle).
