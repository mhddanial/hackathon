# Sprint 6 evidence

Collected 11 October 2026 on `danial`. [Implementation and remaining gates](../../sprints/SPRINT_6_IMPLEMENTATION.md).

| Artifact | Actual scope |
| --- | --- |
| [Validation](validation.json) | Final gates and outstanding live acceptance. |
| [Backend JUnit](backend-tests.xml) | 282 passing tests; real disposable PostgreSQL with synthetic Auth/provider transport. |
| [Actual-tool integration](integration-tests.xml) | Two congestion → SDK/RPC/RLS → history tests, included in the final suite. |
| [Installed live database](live-database.json) | Ten ownership and 11 lifecycle probes, simulated claims; all synthetic rows rolled back, counts unchanged. |
| [Model audit](model-audit.json) | Public source aggregates, reproduced synthetic evaluation, runtime and unchanged artifact. |
| [Attempted live provider turns](live-provider.json) | Four failed in-memory turns, valid public tools in first attempt; no completed answer or signed-in persistence. |
| [SDK diagnostic](provider-diagnostic.json) | Direct Google ClientError 429; exact bucket/reset not established, calls stopped. |
| [Result browser summary](browser-results.json) | 16 real Chromium/Next scenarios with synthetic Auth/API. |
| [History browser summary](browser-history.json) | 17 history scenarios with two simulated accounts. |
| [Browser edges](browser-edges.json) | Uppercase UUID and UTF-8 checks. |
| [Desktop result](result-desktop.png), [mobile result](result-mobile.png) | Accessible dialogs and labelled synthetic metadata. |
| [Desktop history](history-desktop.png), [mobile history](history-mobile.png) | Saved synthetic history/composer after refresh and later login. |
| [Local smoke](app-smoke.json) | Fresh current-code 8000/normal 3000, public data and anonymous auth boundary only. |

Screenshots show synthetic Test A/fixture data. Storage-state files/raw CLI
snapshots remain ignored locally. Evidence contains no JWT/key, private user
record, or opaque provider signature. No deployment or schema/migration change
was performed. Real signed-in Supabase acceptance and current completed provider
answer remain open; see the report before citing a result as live success.
