# Departure Recommendation

Owner: **Ananda Khusnul Hotimah — 3312401044**. Planning baseline: 23 October 2026, Asia/Jakarta.

This collection covers Ananda’s Departure Recommendation feature: schedule-aware ETA, cutoff buffer, SAFE/RISKY/MISSED/UNAVAILABLE decisions, alternatives, interface, and evaluation.

| Document | Purpose |
| --- | --- |
| [Personal context](context/context_improve.md) | Ownership, requirements, academic boundaries, and the original 22-section brief |
| [Source audit](sprints/SPRINT_0_AUDIT.md) | What the inspected repository already provides and what remains missing |
| [Implementation sprints](planning/DEPARTURE_IMPLEMENTATION_SPRINTS.md) | Ordered tasks, proposed files, dependencies, tests, and completion gates |
| [Sprint 1 design report](sprints/SPRINT_1_DESIGN.md) | Frozen API/data/decision policies, user flow, wireframes, fixtures, usability plan, and Sprint 2 entry gate |
| [API contract v1.0](contracts/DEPARTURE_API_CONTRACT.md) | Typed fields, validation, authentication/error semantics, and synthetic examples |
| [Schedule and decision policy](data/SCHEDULE_POLICY.md) | Explicit occurrence semantics, project mappings, confidence, thresholds, selection, and live-data limits |
| [Sprint 3 implementation report](sprints/SPRINT_3_REPORT.md) | Selected-sailing API, read-only adapters, I/O budgets, offline verification, and pending live gate |
| [Sprint 4 implementation report](sprints/SPRINT_4_REPORT.md) | Automatic selection, bounded alternatives, optional target, fixture coverage, and remaining release gate |
| [Sprint 5 interface report](sprints/SPRINT_5_REPORT.md) | Controlled headless interface verification and known release limits |
| [Sprint 6 acceptance (in progress)](sprints/SPRINT_6_ACCEPTANCE.md) | Fresh functional matrix, synthetic timings/regressions, pending live/usability gates |
| [BAB III/BAB IV evidence map](reports/REPORT_EVIDENCE_MAP.md) | Traceable artifacts and explicit evidence limits |
| [Original product requirements](../hackathon/PRD.md) | Target users and historical product scope |
| [Oracle current state](../oracle/context/CURRENT_STATE.md) | Shared integration context and documented verification limits |

Sprint 1 supplies 66 synthetic fixture definitions and five expected API examples. Sprints 2–4 backend behavior and Sprint 5 UI are implemented and tested under the documented offline/synthetic boundary. Sprint 6 started on **24 October 2026, Asia/Jakarta**: a fresh run passed **431 backend checks**, captured **66/66 fixture definitions**, passed **26 headless UI groups** plus **18/8 helper groups**, and measured three explicitly synthetic in-process API scenarios. The [functional matrix](evidence/sprint-6/ACCEPTANCE_MATRIX.md) records **DEP-01–DEP-13 as synthetic passes; DEP-14 pending actual participant evidence**.

**Sprint 6 remains incomplete.** The user confirmed that approved real read-only integration access and institutional/participant readiness are not yet available. D3-06/D6-02 live verification, D6-04 usability collection, and final report/release readiness remain open. The ordered follow-up fixed the 7 lint errors and an evidenced schedules hydration bug; full lint now passes with 0 errors/16 warnings. U4 overnight/source-zone fixture preparation passed 5 headless groups, shared regressions 5, departure regressions 26, and Planner regressions 13. D6-05 is checked for the currently evidenced fixes; other D6 tasks remain incomplete. Omitted/null `schedule_id` supports automatic selection; an explicit UUID is preserved and may return up to three evaluated matching alternatives. No fixture or synthetic timing establishes a real sailing, observed traffic, live login/backend integration, production latency or usability benefit. Optional history and Oracle departure integration remain Sprint 7.

During implementation, add a dated report under `sprints/` and sanitized evidence under `evidence/sprint-N/`. Update task status only when its acceptance checks have passed. Personal history and the Oracle departure tool are optional follow-up work.

**Current priority, 24 October 2026:** the user explicitly deferred supervisor/institution confirmation and D6-04 participant testing to focus on finishing the core feature. These are deferred evaluation activities, not prerequisites for further implementation. Core implementation and controlled checks are available; the remaining technical verification is D6-02 against an approved real non-production setup, followed by any evidenced fixes and release-readiness checks. Access remains unavailable. Keep D6-04/DEP-14 unchecked and distinguish implementation readiness from live verification and study completion. No Sprint 7 extension is included in this priority change.

**Current local handoff:** the user will start backend/frontend in their own terminals and run [D6-02 manually](reports/D6_02_MANUAL_CHECKLIST.md), then paste sanitized results. The `.env` read/load prohibition remains; no exception was granted. The assistant-owned backend on 8080 has been stopped to release the port. Health/OpenAPI startup was observed, but D6-02 remains pending and unchecked until the supplied signed-in evidence is reviewed. No further services or browser checks will be started for this handoff.

**25 October update:** the user reports sign-in is blocked; its cause remains unconfirmed. [Operator triage](reports/VALIDATION_ENVIRONMENT.md#current-sign-in-blocker--operator-triage) needs only diagnostic booleans, auth method and a sanitized request error. D6-06 revision references are now supplied: [three existing commits and nine recorded source hashes verified](evidence/sprint-6/revision-traceability.json). The [work-availability table](sprints/SPRINT_6_ACCEPTANCE.md#25-october--work-available-while-sign-in-is-blocked) distinguishes work possible now from full acceptance gates. No new full task checkbox is closed; actual sign-in, integration and deferred participant evidence remain pending.
