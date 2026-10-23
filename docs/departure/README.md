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
| [Original product requirements](../hackathon/PRD.md) | Target users and historical product scope |
| [Oracle current state](../oracle/context/CURRENT_STATE.md) | Shared integration context and documented verification limits |

Sprint 1 design tasks D1-01–D1-06 are recorded, with 66 synthetic fixture definitions and five expected API examples checked offline. No departure application has been implemented. Sprint 0's requested application checks stopped before assertions because dependencies are missing; a passing regression baseline, live schedule verification, route-context provenance, and actual usability collection remain open. Sprint 2 may implement the pure calculation core under the frozen policy and fixture boundary; it must establish its own executable results. Checkboxes in the sprint plan track this feature only; completed Oracle sprints do not establish completion here.

During implementation, add a dated report under `sprints/` and sanitized evidence under `evidence/sprint-N/`. Update task status only when its acceptance checks have passed. Personal history and the Oracle departure tool are optional follow-up work.
