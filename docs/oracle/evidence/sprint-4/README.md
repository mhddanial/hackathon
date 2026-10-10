# Sprint 4 evidence

Captured 10 October 2026 (Asia/Jakarta). See the
[implementation report](../../sprints/SPRINT_4_IMPLEMENTATION.md).

| Artifact | Scope |
| --- | --- |
| [validation.json](validation.json) | 20 API/history, 8 stream, 19 browser checks; TypeScript/lint/build; explicit live-service limits. |
| [browser-summary.json](browser-summary.json) | 17 complete UI/lifecycle scenarios with local synthetic Auth/API services. |
| [browser-edge-summary.json](browser-edge-summary.json) | Uppercase UUID bookmark and UTF-8 punctuation checks. |
| [app-smoke.json](app-smoke.json) | Normal local frontend/backend restored; process health, public database reference read, anonymous redirect. |
| [Desktop screenshot](desktop.png), [mobile screenshot](mobile.png) | Inspected synthetic UI samples; no real user or provider data. |
| [final-validation.json](final-validation.json) | Diff, syntax/JSON, documentation links, credential scan, branch, and historical-doc preservation. |

Raw browser output and synthetic cookie files remain under ignored
`output/playwright/`; retained screenshots and summaries are sanitized. The
browser fixture is in-memory and loopback-only. No live Supabase JWT/RLS or
provider response is proven by the browser checks. The real-auth/provider check
remains pending. Prior Sprint 3 backend results are identified as prior evidence,
not newly executed Sprint 4 tests.
