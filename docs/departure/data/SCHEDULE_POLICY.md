# Departure schedule and decision policy v1.0

23 October 2026, Asia/Jakarta. Owner: Ananda Khusnul Hotimah, 3312401044. Frozen design for D1-03/D1-04; implementation and live acceptance remain pending. This policy and the [API contract](../contracts/DEPARTURE_API_CONTRACT.md) supersede the sprint plan's proposed defaults where they are more specific. Neither document changes existing Planner behavior.

## Evidence and supported mappings

Use the [Sprint 0 audit](../sprints/SPRINT_0_AUDIT.md) and its sanitized source sample. The source workbook and checked-in DDL establish project field names, not current sailings, operating days, timezone, freshness, cargo permission, or an installed live schema. D0-04 live acceptance remains open.

| Schedule terminal key | Source terminal grouping | Catalog ID | Permitted interpretation |
| --- | --- | --- | --- |
| `batu_ampar` | `TM001` in the source sample | `batu_ampar_port` | Representative approximate access point; exact cargo gate unverified |
| `batam_center` | `TM002` in the source sample | `batam_center_terminal` | Mapped terminal point; service/cargo permission still requires metadata |
| `sekupang` | `TM003` in the source sample | `sekupang_terminal` | Mapped terminal point; service/cargo permission still requires metadata |
| `harbour_bay` or any other key | Not established by this sample | None | Reject with 422 terminal-field validation; never borrow another terminal's point |

These are frozen **project mappings** backed by the catalog and source labels, not verified physical gates or confirmation from Chelsea. Resolve coordinates on the backend using the catalog ID; do not accept destination coordinates from the client. Preserve raw terminal keys and schedule UUIDs. `terminal_id` groups terminals and is not a sailing ID. A live row whose key/grouping conflicts with this mapping is unavailable until reviewed. Destination matching trims leading/trailing whitespace, collapses internal whitespace, and casefolds; there is no fuzzy match, alias invention, or wildcard matching. Display the recorded destination label.

## Occurrence normalization

V1 accepts explicitly dated occurrences only. Required metadata is: stable schedule UUID, terminal key, destination, explicit allowed service kinds, source timezone, offset-aware ferry departure and recorded cutoff instants, source verification time, and provenance. The adapter must also establish that the date is applicable for that sailing. Raw database clock rows without this evidence remain unavailable. No recurrence expansion, clock-to-selected-date assignment, or next-day copying is enabled in v1.

The request contains a road departure date/time in `Asia/Jakarta` and a separate required `service_date`, defined as the ferry departure's calendar date **after conversion to Asia/Jakarta**. The service date may equal the road date or the following date, selected explicitly. This allows a road departure before midnight for an evidenced next-day sailing. Only that one service date is searched. It does not establish recurrence. Unknown occurrence dates are not silently filtered as nonexistent schedules; record `MISSING_SERVICE_DATE`.

Retain source timestamps and IANA source zone. Validate each source UTC offset against that zone at its stated local instant; reject naive timestamps, unknown zones, and inconsistent zone/offset pairs. Convert known zones to `Asia/Jakarta` before comparing times or service dates. For example, synthetic `2026-10-23T10:00:00+08:00` in `Asia/Singapore` is `2026-10-23T09:00:00+07:00`; that conversion is not permission to assume Singapore time for other rows.

Require `cutoff_at < departure_at` as absolute instants. A cutoff at or after sailing departure is `INVALID_CUTOFF`; absent cutoff is `MISSING_CUTOFF`. Explicit dated cutoffs may be on the preceding day. If the source offers only clocks/day offsets, this version cannot normalize it without separately evidenced absolute occurrence metadata. Do not infer a preceding day merely because a cutoff clock is later than a departure clock. No cargo-derived 60/120-minute margin replaces the recorded cutoff.

Absent ferry departure is `MISSING_DEPARTURE`; an invalid departure/calendar value or internally inconsistent occurrence is `INVALID_SCHEDULE`. A naive timestamp or source offset/zone conflict is `INVALID_SOURCE_ZONE`; an unparseable cutoff is `INVALID_CUTOFF`, and an unparseable verification time is `INVALID_FRESHNESS`. These are row-level domain failures with unavailable decision values, distinct from a structurally malformed dependency envelope (503). Unknown stable row identity is excluded and contributes to `NO_EVALUABLE_SCHEDULES`. Detect datetime/timedelta range overflow during validation/calculation; it is `INVALID_SCHEDULE`, never an invented date, wrapped clock, or uncaught successful result.

## Applicability and freshness

`service_kind` is required: `cargo` or `passenger_hand_carry`. A normalized record contains an explicit `allowed_service_kinds` list from trusted metadata. Null means unknown (`SERVICE_UNKNOWN`); an empty or nonmatching list is known incompatibility. Vessel labels and tonnage alone do not establish permission or remaining capacity. For a selected incompatible sailing return 422 `SERVICE_MISMATCH`; automatic mode filters it and reports the exclusion.

`verified_at` records schedule verification, not insertion/import time. It must be an aware instant no later than `calculated_at`. Require age in minutes in `[0, DEPARTURE_SCHEDULE_MAX_AGE_MIN]`, inclusive. The frozen default is **1440 minutes**, finite and positive, explicitly a conservative project parameter rather than a terminal SOP. Unknown, future, and older verification times produce `FRESHNESS_UNKNOWN`, `INVALID_FRESHNESS`, and `STALE_SCHEDULE` respectively. DB `created_at`, file modification time, and source-workbook age cannot fill this field.

The operational adapter has no browser-selectable simulation switch. Offline fixtures use an injected `synthetic_fixture` repository with explicit absolute times, service metadata, verification times, and a fixed clock. They are always labeled synthetic; they do not enrich live rows or establish schedule freshness in the real world. Existing raw rows may therefore remain unavailable even though synthetic scenarios calculate correctly. Chelsea's verified export/catalog is still needed before real-data acceptance.

## Route confidence and calculation

Reuse `RouteRequest`, `RouteData`, catalog/time helpers, verified auth, and in-process dependencies. Call the route service without its cargo/ETD pair. Route duration must be finite numeric minutes in `[0, 1440]`, excluding booleans; this is the project's bounded road-planning scope. Zero is valid. Negative/nonfinite/oversized or structurally malformed dependency output is a 503 `INVALID_DEPENDENCY_RESPONSE`, not a fabricated zero.

For decision eligibility require `routing_source == "OSRM API"`, `congestion_status == "synthetic_estimate"`, and adapter evidence `context_verified == true` that the corridor/input context was established without hidden defaults. The last flag belongs to the new dependency boundary, not the existing shared response model and not the request. Existing route provenance cannot prove it when a corridor query fails and silently assumes an urban corridor. The adapter must obtain evidence or coordinate a compatible provenance extension with Khairul/Danial; until then use `ROUTE_CONTEXT_UNKNOWN`.

Haversine results are `UNAVAILABLE / ROUTE_FALLBACK`. Default/unavailable congestion is `UNAVAILABLE / CONGESTION_UNAVAILABLE`. A validated duration and ETA may appear only in the separately labeled `route_estimate` for these cases; the decision's ETA/buffer/latest-departure fields stay null. Do not make a second public congestion call or multiply congestion again. OSRM/DB/auth timeouts and exceptions remain 503 transport errors even if an owner service can hide an upstream failure behind an otherwise plausible result. A known Haversine fallback is an unavailable estimate, not a successful calculated decision.

```text
ETA = planned_road_departure_at + final_time_min minutes
buffer_min = (recorded_cutoff_at - ETA).total_seconds() / 60
latest_departure_estimate_at = recorded_cutoff_at - final_time_min minutes - safety_buffer_min minutes
```

`DEPARTURE_SAFETY_BUFFER_MIN` defaults to **15 minutes for project simulation**; require a finite positive number at startup, excluding booleans. Also validate the positive freshness configuration at startup; bad server configuration prevents startup, not a user 422 or an unavailable recommendation. No client override is accepted.

| Unrounded buffer / required data | Decision |
| --- | --- |
| Required occurrence/confidence data unavailable | `UNAVAILABLE` with the first applicable reason below |
| `< 0` | `MISSED / CUTOFF_MISSED` |
| `>= 0` and `< safety_buffer_min` | `RISKY / BELOW_SAFETY_BUFFER` |
| `>= safety_buffer_min` | `SAFE / BUFFER_SUFFICIENT` |

Preserve signed/zero values and classify before display rounding. Route `final_time_min` already has two-decimal source precision; do not reconstruct unrounded duration from a multiplier. Maintain that precision, calculate timestamps with microseconds where needed, and return the computed buffer without further decision rounding. UI may round buffer to two decimals only after status selection, disclosing subminute boundaries. Latest departure is a fixed-duration backward estimate using the requested road traffic period, not a search/optimization. Recalculate when the user adopts it; it may be in the past.

## Selection, duplicates, and bounds

For a selected UUID: read that target independently, preserve it even when MISSED or unavailable, and never silently substitute a different sailing. No target gives 404 `SCHEDULE_NOT_FOUND`; a target with a known conflicting terminal/destination/service date/service gives 422 `SCHEDULE_MISMATCH` or `SERVICE_MISMATCH`. Unknown required metadata gives a 200 unavailable result preserving whatever target identity is known.

For automatic mode, filter known terminal/destination/service/date mismatches first, retaining exclusion reasons. Evaluate candidates whose date/applicability/confidence can be established. Choose earliest SAFE by `(departure_at, schedule_id)`; otherwise earliest RISKY by the same order; otherwise MISSED with the latest cutoff, breaking equal cutoffs by `(departure_at, schedule_id)` ascending. If no candidate is evaluable, return UNAVAILABLE. If some are excluded as unknown, disclose the exclusions; selection is among evaluable candidates only. A successful empty lookup uses `NO_SCHEDULES`; known records but none applicable use `NO_RELEVANT_SCHEDULES`; records whose metadata cannot be established use `NO_EVALUABLE_SCHEDULES` with per-record reasons.

Alternatives exclude the selected main occurrence, match all request constraints and the same explicit service date, and include only evaluated SAFE/RISKY occurrences. Sort by `(departure_at, schedule_id)` regardless of status and return at most **3**. Each has its own cutoff, buffer, status, and backward estimate. Reuse one validated route estimate for identical origin/terminal/road-departure inputs. Choosing an alternative keeps the road plan, sets its UUID, and explicitly recalculates. An UNAVAILABLE main result returns no alternatives in v1; the user may explicitly revise the target or request automatic selection. Do not attach calculated alternatives to an unavailable decision whose required inputs are unresolved.

Bound repository reads to **100** candidate rows plus **one overflow sentinel**, ordered by stable UUID before normalization; selected-target lookup is separately bounded to detect conflicting duplicate occurrences. Maximum unique evaluations per request: **101**, including the selected target. At overflow, automatic mode fails closed as `200 UNAVAILABLE / CANDIDATE_LIMIT`; do not claim best/earliest across a truncated set. Selected mode may retain its independently evaluated target, but omit alternatives and warn `ALTERNATIVES_TRUNCATED`. `selection.truncated` is true; examined/excluded counts describe the bounded retrieved set, not the table total.

For repeated `(schedule_id, service_date)` with identical normalized fields, collapse and warn `DUPLICATE_RECORD_COLLAPSED`. Conflicting content under that same identity is `AMBIGUOUS_SCHEDULE`: selected mode unavailable, automatic mode excludes the conflicting group. Distinct UUIDs sharing a departure clock remain distinct candidates with a stable tie-break; if their full terminal/destination/time/service tuple also matches, warn `POSSIBLE_DUPLICATE_SAILING` and make no claim that they are distinct physical vessels. A clock match alone never proves a duplicate. Real natural-key duplicates still require Chelsea's data review.

## Reason priority and error boundary

Authenticate before dependency reads; reject structurally invalid requests before domain reads. Reuse existing auth 401/503 responses. Dependency exceptions/malformed envelopes use controlled transport errors; they take precedence over issuing a calculated result from that failed dependency. For a selected row, known mismatch errors precede domain classification. Then test metadata in this order: ambiguous identity, service date, source timezone, departure presence/validity, cutoff presence/validity, applicability, freshness, route confidence, arithmetic. Detailed exclusions retain the individual reasons; automatic top-level reasons summarize selection rather than arbitrarily choosing the first bad row.

Missing data is unavailable. Missing target is 404. Failed I/O is 503. These are different outcomes. Use the safe code/message contract, not raw exception strings. No database migration, schedule CRUD change, service refactor, or live write is authorized by this design document. Dependencies on Chelsea and route provenance remain open in the [Sprint 1 report](../sprints/SPRINT_1_DESIGN.md).
