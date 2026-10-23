# SmartFlow documentation

The documentation has three collections:

| Collection | Purpose | Start here |
| --- | --- | --- |
| Oracle implementation | Current authenticated chat/history extension, sprint work, API contracts, security changes, and verification evidence | [Oracle guide](oracle/README.md) |
| Departure Recommendation | Ananda’s feature context, repository source audit, and task-per-sprint implementation plan | [Departure guide](departure/README.md) |
| Original hackathon | Original product/technical plans, 16-hour task lists, methodology, pitch materials, and source workbook | [Hackathon archive](hackathon/README.md) |

For continued development, read the [current Oracle context](oracle/context/CURRENT_STATE.md)
first. The original hackathon documents retain their historical decisions and
claims; their task checkboxes and proposed APIs do not establish the current
implementation status.

```text
docs/
  README.md
  departure/
    README.md
    planning/      Departure implementation backlog and acceptance gates
    sprints/       Source audit and subsequent execution reports
  oracle/
    README.md
    context/       Current state and original extension brief
    planning/      Sprint backlog and contribution boundaries
    contracts/     API, persistence, and streaming contracts
    sprints/       Dated execution reports
    security/      Applied legacy RLS repair
    evidence/      Captured checks grouped by sprint/change
  hackathon/
    README.md
    PRD.md, TECH.md, TASK.md, DESIGN.md
    BUILDER_A.md, BUILDER_B.md, NEXT_STEPS.md
    methodology_notes.md
    pitch-deck/
    data/
```

New Oracle reports and evidence belong under `oracle/`. Preserve the dated
reports as snapshots; update `oracle/context/CURRENT_STATE.md` and the sprint
backlog when implementation status changes. Original hackathon materials stay
under `hackathon/` and are linked as background when needed.
