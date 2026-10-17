# Planner–Oracle integration implementation record

17 October 2026. Local implementation extends baseline `c214987`; no application deployment, provider/key change, product-database migration, or model replacement was performed.

**Delivered behavior**

- A shared backend route response model and frontend types/runtime parser serve the Planner API and Oracle results. Existing tool names and saved-result fields remain compatible.
- The Planner supports catalog names/coordinates, explicit date/day checks, WIB departure times, timezone-aware vessel ETDs, and optional cargo/cutoff planning. Recorded sailing selection copies a clock time without inferring cargo compatibility.
- Requests can be stopped; editing or navigating invalidates older requests. Errors and malformed responses do not retain a stale successful recommendation.
- Oracle receives a bounded route reference from validated, paired completed tool records. Instructions define inheritance, explicit replacements, ambiguous plans, route-only estimates, and removal of vessel planning. Natural-language adherence still needs scenario-level evaluation.
- Completed results can open an editable Planner draft. Inputs are validated and account-scoped, expire after 30 minutes, and are cleared on account change/logout. Loading a draft never calculates or rewrites saved chat data.
- Both interfaces use the same map/detail component. New arrival and cutoff-slack fields come from the backend. Zero slack, late departures, inferred dates, origin-area congestion, fallback routing, and missing information remain explicit.
- Date-free deadline calculations that cross midnight require calendar information. Suggested departure remains an estimate based on the requested traffic period; the UI does not claim a search of alternative routes.
- A reproducible evaluation runner supports bounded live calls, deterministic tool fixtures, baseline/enhanced prompt-context variants, metadata/token/timing collection, and explicit human-review verdicts.

**Validation**

The [evidence directory](../evidence/planner-integration-20261017/README.md) separates automated tests, browser fixtures, and live provider samples. The final backend gate passed **349 tests, zero skips**, including actual disposable PostgreSQL lifecycle/RLS tests with simulated claims. Two expected serializer warnings come from deliberately malformed SDK argument fixtures. Product Supabase history was not changed by the test database.

Frontend TypeScript, targeted lint and production build passed. Helper/result/history/stream/Markdown checks passed. Browser checks exercise the real Next UI with synthetic Auth/API data, including map results, request invalidation, handoff, refresh, expiry, logout, and account isolation. See the machine-readable evidence for exact browser counts and environment.

**Live pilot and remaining acceptance**

The configured provider used `gemini-2.5-flash` during the controlled-tool pilot. The original-prompt baseline completed three scenarios; the enhanced variant completed one, then received an actual HTTP 429. Further live requests stopped. The unrun enhanced scenario remains unrun; quota failure is not graded as successful clarification.

Both variants used the same deterministic tool implementations and in-memory persistence. This was a small prompt/context pilot, not a complete old-release comparison or an authenticated production workflow. It does not establish an improvement in accuracy or latency. The recorded answers also informed a subsequent clarification that the matched congestion corridor is near the origin and does not prove the route traverses that road; the final wording was not retested live after quota exhaustion.

The sixty-case final evaluation set is separate from development and used pilot cases. Full repeated live execution, human/domain review, genuine signed-in production persistence, and a representative participant usability study remain pending. They must not be presented as completed BAB IV results.

Use the [evaluation guide](../reports/PLANNER_ORACLE_EVALUATION_GUIDE.md) for diagrams, reproduction commands, scoring and report placement. The [implementation plan](../planning/ROUTE_ORACLE_INTEGRATION_PLAN.md) retains explicit pending acceptance items.
