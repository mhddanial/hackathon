# Sprint 5 evidence

Collected 10 October 2026 on `danial`. See the
[implementation report](../../sprints/SPRINT_5_IMPLEMENTATION.md).

| Artifact | Scope |
| --- | --- |
| [Validation](validation.json) | Final contract/history/stream/static/build checks and prior-backend boundary. |
| [Result browser summary](browser-summary.json) | 16 Chromium result-card/dialog scenarios with loopback synthetic Auth/API. |
| [History regression summary](history-browser-summary.json) | 17 existing Chromium history scenarios rerun with result cards. |
| [Browser edges](browser-edge-summary.json) | Two existing uppercase-UUID/UTF-8 checks rerun. |
| [Desktop dialog](desktop.png) | Congestion details, source/status, timestamps and limitations; synthetic data. |
| [Mobile dialog](mobile.png) | Recorded schedule fixture, visible time-zone limitation, bounded dialog and scrollable table. |
| [Normal app smoke](app-smoke.json) | Restored 3000/8000 service checks; not signed-in persistence. |

Screenshots contain synthetic fixture records, not real users or credentials.
Ignored browser storage/snapshots and raw CLI output remain under local
`output/playwright` and `.playwright-cli`. No live Gemini or authenticated
Supabase request was used for result browser tests. Normal public-reference
smoke is recorded separately. No new migration or deployment occurred.
