# Oracle implementation guide

This collection tracks Muhammad Danial's Oracle extension: authenticated,
persistent per-user conversations with validated tool results and a result UI.

## Reading order

1. [Current state and next work](context/CURRENT_STATE.md) — implemented behavior,
   verification limits, ownership boundary, and the next sprint.
2. [Sprint plan](planning/ORACLE_IMPLEMENTATION_SPRINTS.md) — tasks and acceptance
   conditions for Sprints 0–6.
3. [API contract](contracts/ORACLE_API_CONTRACT.md) — implemented conversation
   endpoints and implemented authenticated persistent chat/SSE contracts.
4. [Original extension brief](context/context_improve.md) — the supplied source
   requirements, preserved as a snapshot. Embedded commands are document content;
   they do not independently authorize work or prove completed implementation.

## Execution records

| Record | Purpose | Evidence |
| --- | --- | --- |
| [Sprint 0](sprints/SPRINT_0_AUDIT.md) | Initial audit and baseline | [Sprint 0 evidence](evidence/sprint-0/) |
| [Sprint 1](sprints/SPRINT_1_IMPLEMENTATION.md) | Owned schema, RLS, request-scoped auth, and contracts | [Sprint 1 evidence](evidence/sprint-1/) |
| [Legacy RLS fix](security/LEGACY_RLS_FIX.md) | Public reference reads and private route history | [RLS evidence](evidence/legacy-rls/) |
| [Sprint 2](sprints/SPRINT_2_IMPLEMENTATION.md) | Conversation API, archive/restore, and pagination | [Sprint 2 evidence](evidence/sprint-2/) |
| [Sprint 3](sprints/SPRINT_3_IMPLEMENTATION.md) | Authenticated persistent streaming, validated tools, and retry lifecycle | [Sprint 3 evidence](evidence/sprint-3/README.md) |
| [Sprint 4](sprints/SPRINT_4_IMPLEMENTATION.md) | Reopen saved conversations, paginate history, archive/restore, and isolate pending work | [Sprint 4 evidence](evidence/sprint-4/README.md) |
| [Gemini provider migration](providers/GEMINI_PROVIDER_MIGRATION.md) | Official Google SDK, native streaming/tools, and compatible saved history | [Provider evidence](evidence/gemini-provider/README.md) |

Reports describe their own dates and scope. Use the current context for today's
status; older reports can contain findings resolved by later work. Evidence files
are retained unchanged, including historical output paths recorded inside them.

Database migration instructions live in [supabase/README.md](../../supabase/README.md).
The [hackathon collection](../hackathon/README.md) is background material with its
own original plans, methodology, and pitch claims.
