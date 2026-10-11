# Oracle evidence map for BAB III and BAB IV

Updated 11 October 2026. Use implemented contracts and measured evidence for the
report. Original `docs/hackathon/` content remains historical background.

| Report topic | Design reference for BAB III | Actual implementation/evidence for BAB IV | Claim boundary |
| --- | --- | --- | --- |
| Authentication and ownership | [API contract](../contracts/ORACLE_API_CONTRACT.md), [migration workflow](../../../supabase/README.md) | [Sprint 1](../sprints/SPRINT_1_IMPLEMENTATION.md), [Sprint 6 live roles/claims](../evidence/sprint-6/live-database.json) | Live installed RLS/RPC verification is not a real JWT login. |
| Conversation lifecycle | [History/SSE contract](../contracts/ORACLE_API_CONTRACT.md) | [Sprint 3](../sprints/SPRINT_3_IMPLEMENTATION.md), [Sprint 6 backend tests](../evidence/sprint-6/backend-tests.xml) | Actual disposable PostgreSQL with synthetic Auth/provider transport. |
| Gemini orchestration | [Provider record](../providers/GEMINI_PROVIDER_MIGRATION.md) | [Prior successful provider probes](../evidence/gemini-provider/README.md), [Sprint 6 attempted turns](../evidence/sprint-6/live-provider.json), [429 diagnostic](../evidence/sprint-6/provider-diagnostic.json) | Sprint 6 live completion failed; do not present failed latency samples as successful answer performance. |
| History after refresh/later login | [Sprint 4 design/behavior](../sprints/SPRINT_4_IMPLEMENTATION.md) | [Browser history checks](../evidence/sprint-6/browser-history.json), [desktop screenshot](../evidence/sprint-6/history-desktop.png) | Real Chromium/Next with synthetic accounts/API. Real signed-in Supabase persistence remains pending. |
| Result details and trust | [Result contract](../contracts/ORACLE_API_CONTRACT.md), [Sprint 5](../sprints/SPRINT_5_IMPLEMENTATION.md) | [Result browser checks](../evidence/sprint-6/browser-results.json), [desktop dialog](../evidence/sprint-6/result-desktop.png), [mobile dialog](../evidence/sprint-6/result-mobile.png) | Screenshots show labelled synthetic fixture data; no unsupported result is a recommendation. |
| Congestion model | [Verified methodology](../ml/CONGESTION_MODEL_VALIDATION.md) | [Current source/artifact audit](../evidence/sprint-6/model-audit.json) | 95.0694% synthetic row-split accuracy, with repeated-input train/test overlap; not real-traffic accuracy. |
| Failure handling | [Failure matrix](../sprints/SPRINT_6_IMPLEMENTATION.md#failure-matrix) | [282-test backend gate](../evidence/sprint-6/backend-tests.xml), [35 browser scenarios](../evidence/sprint-6/README.md), [actual rate limit](../evidence/sprint-6/provider-diagnostic.json) | Distinguish controlled injected failures from the observed Google 429. |
| Local execution | [Deployment order](../sprints/SPRINT_6_IMPLEMENTATION.md#deployment-and-remaining-live-acceptance) | [Local smoke](../evidence/sprint-6/app-smoke.json), [validation summary](../evidence/sprint-6/validation.json) | Running local services does not prove deployment or signed-in acceptance. |

Only use completed checks with their environment and sample count. Keep plans,
notebook saved output, source inspection, controlled tests, current live probes,
and pending acceptance distinguishable in the prose and figure captions.
