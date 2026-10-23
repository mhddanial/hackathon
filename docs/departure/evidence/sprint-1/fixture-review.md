# Sprint 1 fixture expectation review

Synthetic authored expectations checked offline; no departure application was executed.

| ID | Stage | HTTP / status | Reason | Arithmetic / policy trace |
| --- | --- | --- | --- | --- |
| SAFE-30 | domain | 200 / SAFE | BUFFER_SUFFICIENT | 08:00 + 30 min = 08:30; recorded 09:00 cutoff leaves 30 min. |
| RISKY-5 | domain | 200 / RISKY | BELOW_SAFETY_BUFFER | 08:35 - 08:30 = 5; 0 <= 5 < 15. |
| MISSED-5 | domain | 200 / MISSED | CUTOFF_MISSED | 08:25 - 08:30 = -5; selected UUID retained. |
| ZERO-BUFFER | domain | 200 / RISKY | BELOW_SAFETY_BUFFER | Exactly cutoff is RISKY, not feasible-as-SAFE. |
| EXACT-THRESHOLD | domain | 200 / SAFE | BUFFER_SUFFICIENT | Exactly 15 min is SAFE. |
| FRACTION-BELOW | domain | 200 / RISKY | BELOW_SAFETY_BUFFER | 14 min 59.9 sec stays RISKY even if display rounds to 15.00. |
| FRACTION-NEGATIVE | domain | 200 / MISSED | CUTOFF_MISSED | 0.1 second late remains MISSED; never erase the negative sign. |
| ZERO-DURATION | domain | 200 / SAFE | BUFFER_SUFFICIENT | Zero duration is known zero, not absent data. |
| APPLY-CONGESTION-ONCE | domain | 200 / SAFE | BUFFER_SUFFICIENT | 20 base minutes times 1.5 is already 30 final minutes; using 45 would be wrong. |
| MISSING-CUTOFF | domain | 200 / UNAVAILABLE | MISSING_CUTOFF | Known target kept; MISSING_CUTOFF; decision arithmetic remains null. |
| CUTOFF-AFTER-SAILING | domain | 200 / UNAVAILABLE | INVALID_CUTOFF | Known target kept; INVALID_CUTOFF; decision arithmetic remains null. |
| CUTOFF-EQUAL-SAILING | domain | 200 / UNAVAILABLE | INVALID_CUTOFF | Known target kept; INVALID_CUTOFF; decision arithmetic remains null. |
| UNKNOWN-SERVICE-DATE | domain | 200 / UNAVAILABLE | MISSING_SERVICE_DATE | Known target kept; MISSING_SERVICE_DATE; decision arithmetic remains null. |
| UNKNOWN-SOURCE-ZONE | domain | 200 / UNAVAILABLE | MISSING_SOURCE_ZONE | Known target kept; MISSING_SOURCE_ZONE; decision arithmetic remains null. |
| INVALID-SOURCE-ZONE | domain | 200 / UNAVAILABLE | INVALID_SOURCE_ZONE | Known target kept; INVALID_SOURCE_ZONE; decision arithmetic remains null. |
| OFFSET-ZONE-CONFLICT | domain | 200 / UNAVAILABLE | INVALID_SOURCE_ZONE | Known target kept; INVALID_SOURCE_ZONE; decision arithmetic remains null. |
| UNKNOWN-SERVICE-KIND | domain | 200 / UNAVAILABLE | SERVICE_UNKNOWN | Known target kept; SERVICE_UNKNOWN; decision arithmetic remains null. |
| UNKNOWN-FRESHNESS | domain | 200 / UNAVAILABLE | FRESHNESS_UNKNOWN | Known target kept; FRESHNESS_UNKNOWN; decision arithmetic remains null. |
| STALE-SCHEDULE | domain | 200 / UNAVAILABLE | STALE_SCHEDULE | Known target kept; STALE_SCHEDULE; decision arithmetic remains null. |
| FUTURE-VERIFICATION | domain | 200 / UNAVAILABLE | INVALID_FRESHNESS | Known target kept; INVALID_FRESHNESS; decision arithmetic remains null. |
| SOURCE-SINGAPORE | domain | 200 / SAFE | BUFFER_SUFFICIENT | Singapore 10:00 cutoff converts to Jakarta 09:00; buffer 30. |
| MIDNIGHT-ARRIVAL | domain | 200 / RISKY | BELOW_SAFETY_BUFFER | 23:50 + 30 = next day 00:20; cutoff 00:30 leaves 10. |
| EXPLICIT-PREVIOUS-DAY-CUTOFF | domain | 200 / SAFE | BUFFER_SUFFICIENT | Ferry is next day; recorded absolute cutoff remains on the road date. |
| ZONE-CHANGES-SERVICE-DATE | domain | 200 / MISSED | CUTOFF_MISSED | Source Oct 24 00:30 is Jakarta Oct 23 23:30; service_date stays Oct 23. |
| FRESHNESS-EXACT-LIMIT | domain | 200 / SAFE | BUFFER_SUFFICIENT | Exactly 1440 minutes old is within the inclusive project threshold. |
| HAVERSINE-FALLBACK | domain | 200 / UNAVAILABLE | ROUTE_FALLBACK | Known estimate may be shown separately, never as a calculated decision. |
| DEFAULT-CONGESTION | domain | 200 / UNAVAILABLE | CONGESTION_UNAVAILABLE | Known estimate may be shown separately, never as a calculated decision. |
| MISSING-CONGESTION | domain | 200 / UNAVAILABLE | CONGESTION_UNAVAILABLE | Known estimate may be shown separately, never as a calculated decision. |
| UNVERIFIED-CORRIDOR | domain | 200 / UNAVAILABLE | ROUTE_CONTEXT_UNKNOWN | Known estimate may be shown separately, never as a calculated decision. |
| NEGATIVE-DURATION | dependency | 503 / None | INVALID_DEPENDENCY_RESPONSE | Malformed dependency value; string NaN represents an invalid upstream value without invalid JSON. |
| NONFINITE-DURATION | dependency | 503 / None | INVALID_DEPENDENCY_RESPONSE | Malformed dependency value; string NaN represents an invalid upstream value without invalid JSON. |
| BOOLEAN-DURATION | dependency | 503 / None | INVALID_DEPENDENCY_RESPONSE | Malformed dependency value; string NaN represents an invalid upstream value without invalid JSON. |
| OVERSIZED-DURATION | dependency | 503 / None | INVALID_DEPENDENCY_RESPONSE | Malformed dependency value; string NaN represents an invalid upstream value without invalid JSON. |
| SCHEDULE-OUTAGE | dependency | 503 / None | DEPENDENCY_UNAVAILABLE | No successful recommendation body on dependency failure. |
| ROUTE-TIMEOUT | dependency | 503 / None | DEPENDENCY_TIMEOUT | No successful recommendation body on dependency failure. |
| AUTH-EXPIRED | auth | 401 / None | existing auth shape | Reuse existing auth detail string and WWW-Authenticate, no synthetic detail.code. |
| AUTH-OUTAGE | auth | 503 / None | existing auth shape | Reuse existing auth detail string and Retry-After: 5. |
| INVALID-DAY-TYPE | request | 422 / None | VALIDATION_ERROR | Validate before route/schedule reads; native bounded detail array. |
| OUTSIDE-BATAM | request | 422 / None | VALIDATION_ERROR | Validate before route/schedule reads; native bounded detail array. |
| INVALID-CLOCK | request | 422 / None | VALIDATION_ERROR | Validate before route/schedule reads; native bounded detail array. |
| INVALID-DATE | request | 422 / None | VALIDATION_ERROR | Validate before route/schedule reads; native bounded detail array. |
| UNSUPPORTED-HORIZON | request | 422 / None | VALIDATION_ERROR | Validate before route/schedule reads; native bounded detail array. |
| UNSUPPORTED-TERMINAL | request | 422 / None | VALIDATION_ERROR | Validate before route/schedule reads; native bounded detail array. |
| CLIENT-THRESHOLD-OVERRIDE | request | 422 / None | VALIDATION_ERROR | Validate before route/schedule reads; native bounded detail array. |
| TARGET-NOT-FOUND | target | 404 / None | SCHEDULE_NOT_FOUND | Do not silently select UUID 1. |
| TARGET-TERMINAL-MISMATCH | target | 422 / None | SCHEDULE_MISMATCH | Known target constraint conflict is distinct from unknown metadata. |
| TARGET-DESTINATION-MISMATCH | target | 422 / None | SCHEDULE_MISMATCH | Known target constraint conflict is distinct from unknown metadata. |
| TARGET-DATE-MISMATCH | target | 422 / None | SCHEDULE_MISMATCH | Known target constraint conflict is distinct from unknown metadata. |
| TARGET-SERVICE-MISMATCH | target | 422 / None | SERVICE_MISMATCH | Cargo permission is not invented from the vessel label. |
| EMPTY-SUCCESS | selection | 200 / UNAVAILABLE | NO_SCHEDULES | Successful empty lookup is domain unavailability. |
| ONLY-UNKNOWN-CANDIDATES | selection | 200 / UNAVAILABLE | NO_EVALUABLE_SCHEDULES | Record MISSING_CUTOFF exclusion; not empty success. |
| ONLY-INCOMPATIBLE-CANDIDATES | selection | 200 / UNAVAILABLE | NO_RELEVANT_SCHEDULES | Known mismatch filters records; no cargo guess. |
| AUTO-EARLIEST-SAFE-TIE | selection | 200 / SAFE | BUFFER_SUFFICIENT | Equal departures break by stable UUID, independent of input order. |
| AUTO-RISKY-WHEN-NO-SAFE | selection | 200 / RISKY | BELOW_SAFETY_BUFFER | Earliest RISKY is chosen; each alternative has its own 10-minute buffer. |
| AUTO-ALL-MISSED | selection | 200 / MISSED | CUTOFF_MISSED | Latest missed cutoff is 08:25, despite UUID 2 departing later; alternatives empty. |
| PRESERVE-MISSED-TARGET | selection | 200 / MISSED | CUTOFF_MISSED | UUID 1 remains MISSED; UUID 2 is a separate SAFE alternative with 90 minutes. |
| AUTO-SAFE-BEFORE-RISKY | selection | 200 / SAFE | BUFFER_SUFFICIENT | Later SAFE UUID 2 wins over earlier RISKY UUID 1; alternative remains RISKY. |
| ALTERNATIVES-CAP-THREE | selection | 200 / SAFE | BUFFER_SUFFICIENT | Four feasible alternatives are ranked; only UUIDs 2, 3, 4 are returned. |
| CONFLICTING-DUPLICATE-ID | selection | 200 / UNAVAILABLE | AMBIGUOUS_SCHEDULE | Same identity with conflicting cutoff cannot be resolved by first row. |
| IDENTICAL-DUPLICATE-ID | selection | 200 / SAFE | BUFFER_SUFFICIENT | Collapse exact duplicate occurrence, not two different sailings. |
| EXCLUDE-UNKNOWN-KEEP-VALID | selection | 200 / SAFE | BUFFER_SUFFICIENT | Choose among evaluable records, disclose UUID 1 missing cutoff. |
| AUTO-CANDIDATE-OVERFLOW | repository_contract | 200 / UNAVAILABLE | CANDIDATE_LIMIT | Injected repository sentinel metadata means more than 100 candidates; no earliest claim. Row list is the bounded example subset, not full query evidence. |
| SELECTED-CANDIDATE-OVERFLOW | repository_contract | 200 / SAFE | BUFFER_SUFFICIENT | Selected UUID independently evaluated; alternatives omitted because repository reports overflow. |
| ZERO-SAFETY-CONFIG | configuration | None / None | INVALID_CONFIGURATION | Reject configuration at startup, not a request recommendation. |
| NEGATIVE-SAFETY-CONFIG | configuration | None / None | INVALID_CONFIGURATION | Reject configuration at startup, not a request recommendation. |
| INVALID-FRESHNESS-CONFIG | configuration | None / None | INVALID_CONFIGURATION | Reject configuration at startup, not a request recommendation. |
