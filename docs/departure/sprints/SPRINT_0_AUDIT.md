# Departure Recommendation source audit

23 October 2026, Asia/Jakarta. Owner: Ananda Khusnul Hotimah, 3312401044.

This is a source-inspection baseline for sprint planning. Application tests, live database inspection, authenticated browser checks, deployment, and participant testing were not performed during this planning session. Historical verification counts in Oracle documentation belong to their dated runs.

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

Shared Oracle documentation specifies local FastAPI port **8080** and frontend port **3000**. No server was started here. Follow the repository’s installed Next.js documentation before authoring frontend code, as required by `frontend/AGENTS.md`.

## Planning-session result

- Personal context, original PRD, shared current-state/contracts, relevant source, and test-file inventory reviewed.
- Original PRD assumptions reconciled in the proposed sprint plan.
- Source overlap and missing schedule semantics identified.
- Runtime baseline, live schema/data checks, feature implementation, and user evaluation remain pending.
- The user’s student ID and other pre-existing changes in the root context are retained.

Next work: finish Sprint 0 runtime/data baseline, then freeze the Sprint 1 contracts and UX. See [implementation sprints](../planning/DEPARTURE_IMPLEMENTATION_SPRINTS.md).
