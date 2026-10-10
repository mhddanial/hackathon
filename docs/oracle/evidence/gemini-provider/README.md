# Gemini provider evidence

Captured 10 October 2026 (Asia/Jakarta). Implementation/configuration/rollback:
[provider record](../../providers/GEMINI_PROVIDER_MIGRATION.md).

| Artifact | Actual scope |
| --- | --- |
| [live-direct.json](live-direct.json) | Actual Google API direct-answer stream; native SDK/model; no user history write. |
| [real-connection-response.json](real-connection-response.json) | Latest live connection test with actual answer text, requested/reported model, timing, and token counts. Requested `gemini-3.5-flash`; Google reported `gemini-3.6-flash`. |
| [live-tools.json](live-tools.json) | Actual native ferry tool round trip with public reference data; later saved-context follow-up with no tool refetch; in-memory turn store. |
| [app-smoke.json](app-smoke.json) | Restarted local backend, public reference read, anonymous UI redirect, and unauthorized chat rejection. |
| [validation.json](validation.json) | 195 existing backend and 19 new SDK checks, stream-parser regression, dependency/diff/credential/link checks, local restart and smoke. |

Provider tests use real SDK serialization/deserialization over synthetic HTTP
transports. PostgreSQL lifecycle/RLS tests use actual disposable local databases
with simulated claims. Live provider probes use a real Google key and model but
do not authenticate a real Supabase user or persist their conversation. The
signed-in HTTP/browser acceptance check remains pending. No real secrets or
provider thought signatures are retained in evidence.
