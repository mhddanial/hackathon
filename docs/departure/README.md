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
| [Original product requirements](../hackathon/PRD.md) | Target users and historical product scope |
| [Oracle current state](../oracle/context/CURRENT_STATE.md) | Shared integration context and documented verification limits |

Sprint 1 supplies 66 synthetic fixture definitions and five expected API examples. Sprint 2's calculation core and Sprint 3's selected-sailing API are implemented and tested offline; the final Sprint 3 run passed 376 checks. The user approved a temporary 422 when `schedule_id` is omitted or null until Sprint 4 adds automatic selection. D3-06 live verification and actual usability collection remain open. No fixture establishes a real sailing or observed traffic. Checkboxes in the sprint plan track this feature only; completed Oracle sprints do not establish completion here.

During implementation, add a dated report under `sprints/` and sanitized evidence under `evidence/sprint-N/`. Update task status only when its acceptance checks have passed. Personal history and the Oracle departure tool are optional follow-up work.
