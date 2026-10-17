# SmartFlow Planner–Oracle integration implementation plan

Date: 17 October 2026 (Asia/Jakarta). Status: **implementation delivered; automated verification passed; live semantic/release acceptance remains partial**. See the [implementation record](../sprints/PLANNER_ORACLE_INTEGRATION.md) and [evaluation guide](../reports/PLANNER_ORACLE_EVALUATION_GUIDE.md).
Source baseline: `c214987` on the current checkout. The working tree was clean before this plan was added.

The report focuses on building a route estimator/planner and integrating a chatbot through tool calling. The intended contribution is a complete, testable application workflow: natural-language input, validated planning parameters, the existing estimator, explanatory results and map, editable planning, and saved conversations.

This plan extends the [original requirements](../context/context_improve.md) and [current implementation record](../context/CURRENT_STATE.md). Historical evidence remains unchanged. Checked acceptance items were exercised through source/controlled integration checks. Unchecked items still require live semantic evaluation. Do not treat implementation or simulated accounts as completed production or participant acceptance.

**1. Observable outcome**

A user can ask for a route using supported place names, supply missing details through follow-up messages, inspect the route and its assumptions, and open the same inputs in the Planner for editing. With identical normalized inputs and controlled routing/congestion data, the Planner and Oracle must produce equivalent calculation results.

Example acceptance journey:

1. Ask: “Estimate a route from Batamindo Industrial Park to Batu Ampar Port on a weekday at 10 AM.”
2. Receive an estimate using supported catalog locations and 10:00 Asia/Jakarta, without fabricated vessel information.
3. Add: “It is fast freight; the vessel ETD is 2024-01-01T12:00:00Z.”
4. Preserve the ISO timestamp, disclose any inferred departure date, and calculate date-aware cutoff feasibility.
5. Ask: “Change my road departure to 11 AM.” Preserve the other resolved inputs and calculate a new result.
6. Choose “Edit in Route Planner.” Review the populated inputs before explicitly recalculating.
7. Reopen the original conversation. Its saved result remains a historical snapshot; editing in the Planner does not overwrite it.

**2. Current implementation and concrete gaps**

| Area | Existing implementation | Work required |
| --- | --- | --- |
| Shared calculation | Oracle calls `calculate_route`; `/route` exposes the same function to the Planner. | Preserve this reuse and prove parity. Do not introduce a second estimator. |
| Natural locations | Shared location catalog, aliases, backend resolution, coverage and ambiguity errors. | Reuse them in all new paths and clarification scenarios. |
| Calendar handling | Backend and Oracle support departure dates and timezone-aware ETDs. | The Planner currently submits clock time/day/cargo/ETD without a departure date. Align the form. |
| Frontend contracts | Oracle validates structured results at runtime. Planner stores the route response as `any`. | Share route types and response validation. |
| Follow-up context | Completed tool history is bounded and passed to the provider. | Supply an explicit context from the most recent valid route call, with clear replacement and clarification rules. |
| Results | Oracle already has a wide map/result dialog and provenance labels. | Add editable handoff and consistent calculation insights in both interfaces. |
| Agent evidence | Existing automated checks and limited live provider probes exist. | Add Planner/tool parity tests and a labeled, repeatable integration evaluation. |

Primary source files: `backend/routers/route.py`, `backend/route_planning.py`, `backend/services/oracle_tools.py`, `backend/services/oracle_turns.py`, `frontend/src/app/(dashboard)/planner/page.tsx`, `frontend/src/components/oracle/RouteEstimateDetails.tsx`, and `frontend/src/lib/oracle-results.ts`.

**3. Scope and compatibility decisions**

- Reuse the existing Gemini provider, three registered tools, location catalog, map, shadcn/Base UI components, and conversation lifecycle.
- Keep the public tool name `get_optimal_route` for compatibility. The interface and report describe its behavior as a route estimate and suggested departure. Renaming it would also affect saved tool calls and the database tool allowlist.
- Keep existing API fields, including `optimal_departure`. New result fields are additive and optional for historical results.
- Keep existing SSE event types and save-before-success behavior, request IDs, cancellation, and retry replay.
- No new provider, agent framework, state table, or database migration is expected for the core work. Partial user input remains in existing messages; validated completed route context is reconstructed from existing owned tool records.
- Do not treat model-generated arguments as proof of what the user explicitly supplied. Show resolved inputs for review; distinguish inferred dates and inherited values.
- Preserve project limitations: synthetic congestion, recorded schedules with unverified freshness, representative location points, approximate routing fallback, and simplified emissions.
- Alternative-route optimization, live traffic collection, model retraining, schedule booking, cargo-capacity verification, and persistent partial drafts are separate extensions.

**4. Phase 0 — freeze acceptance and baseline**

Work:

- Record the source SHA, dependency versions, current request/response examples, and the exact estimator formulas and assumptions.
- Capture representative Planner and Oracle results with fixed OSRM/congestion fixtures before changing behavior.
- Preserve existing original and UI regression checks. Separate simulated transport, real database tests, live provider tests, and authenticated browser evidence.
- Create the evaluation schema and development/test split before prompt tuning. Capture the current agent baseline before changing its prompt/context handling.
- Read the installed Next.js guidance required by `frontend/AGENTS.md` before implementation. Use the project's existing dependency versions.

Acceptance:

- [x] Baseline fixtures cover a normal estimate, deadline planning, unknown location, date conflict, fallback, and unavailable data.
- [x] Existing focused checks have recorded outcomes and environment descriptions.
- [x] Any existing failure is documented before being attributed to this work.

**5. Phase 1 — establish shared route contracts**

Work:

- Define a backend route response model matching the current output. Reuse its route fields in the Oracle contract rather than maintaining two definitions that drift.
- Keep different input shapes where necessary: Oracle accepts names; `/route` accepts validated points. Both use the existing clock/date/planning helpers and the same estimator.
- Introduce shared frontend route types and a runtime parser. Use them in the Planner and the Oracle route-result parser; replace the Planner's `any` route state.
- Preserve the existing calculation function location initially. Extracting the estimator into a service is justified only if the implementation requires it; relocation alone is not a feature.
- Add explicit ignore exceptions for any new helper files under `frontend/src/lib/`, because the current `.gitignore` ignores that directory except selected files.

Expected files:

| Change | Files |
| --- | --- |
| Backend route response contract | New `backend/schemas/route.py`; update `backend/schemas/oracle.py`, `backend/routers/route.py`, `backend/services/oracle_tools.py` |
| Shared frontend contract | New `frontend/src/types/route.ts` and `frontend/src/lib/route-contract.ts`; update `frontend/src/types/oracle.ts`, `frontend/src/lib/oracle-results.ts` |
| Compatibility checks | Existing Oracle contract/result checks; new `backend/tests/test_route_contracts.py`; `.gitignore` exceptions |

Acceptance:

- [x] Existing API fields and old saved results remain usable.
- [x] Invalid numeric values, malformed geometry, impossible dates, and inconsistent input pairs are rejected explicitly.
- [x] Missing optional values remain absent; zero values remain visible.
- [x] Planner and Oracle agree on calculation fields under the same fixtures. Calculation timestamps and interface envelopes are compared separately.

**6. Phase 2 — align the Planner with backend planning rules**

Work:

- Extract request/form behavior into `frontend/src/hooks/use-route-planner.ts` and a small typed API helper, keeping page composition readable.
- Add departure-date input, explicit Asia/Jakarta labeling, and clear vessel-date/timezone handling. Retain the backend's ability to accept an ISO ETD without stripping its offset.
- Derive weekday/weekend when a date is chosen. When a user-supplied date and day type disagree, require correction rather than silently changing the request's meaning.
- Allow a route-only estimate without cargo/ETD. Enable vessel-cutoff planning when the user supplies the required pair; request calendar information when necessary for an overnight calculation.
- Make default selections visible and editable. Resolve API errors into useful field or availability messages.
- Stop inferring cargo compatibility from a vessel-name substring. Let users select the planning cargo category; clearly distinguish that planning category from verified vessel capacity.
- Use explicit submit, bounded loading, cancellation/stale-response protection, and runtime response validation. An older request must not replace the result of a newer request.
- Reuse the existing shadcn controls and map. Keep mobile inputs usable, map sizing bounded, and validation accessible by keyboard and assistive technology.

Expected files: Planner page, new Planner hook, new `frontend/src/lib/route-api.ts`, location helpers, and existing UI components.

Acceptance:

- [x] Planner can represent the same supported planning request as Oracle, including historical ISO examples and midnight boundaries.
- [x] Invalid/ambiguous planning information produces a correction path.
- [x] Server errors and aborts clear loading without showing a stale successful recommendation.
- [x] Desktop and mobile views display the same normalized inputs and warnings.

**7. Phase 3 — make follow-up planning explicit**

Work:

- Build a compact route context from the most recent completed, validated route call within the owned conversation. Include its turn identifier and resolved inputs, not a fabricated summary of the entire chat.
- Make context selection explicit and bounded. If the relevant previous route is unavailable or there are multiple plausible plans, ask which plan to update.
- Pass this context to the provider as reference data. Stored text and tool output never become system instructions.
- Define rules for replacing a field, retaining unchanged fields, clearing vessel planning, starting a new route, and handling date/day conflicts.
- Clarify only what is needed for the requested action. A travel-time estimate does not require cargo or vessel ETD; a vessel-cutoff recommendation does.
- Every complete new tool call still passes backend validation and produces a new saved result. Schema validation cannot establish semantic faithfulness to user text; evaluate that separately.
- Keep partial information in normal conversation history for this phase. Do not claim unlimited memory or durable structured partial drafts. Add such persistence only if later acceptance requires it.

Expected files: `backend/services/oracle_turns.py`, new `backend/services/oracle_route_context.py`, `backend/agent_config.py`, provider context adapter where necessary, and focused context/provider tests. Frontend changes are limited to showing resolved inputs or clarification affordances when useful.

Acceptance:

- [x] Native SDK fixtures reconstruct the previous route context for “Change the departure to 11 AM” and save a new validated estimate. Actual enhanced-agent follow-up remains pending after quota exhaustion.
- [ ] “Use Harbour Bay instead” triggers clarification if the intended origin/destination is unclear.
- [ ] Unknown places and missing information never produce fabricated successful result cards.
- [x] Conversation switching, reload, account change, and retry preserve current isolation rules.
- [ ] Inherited or inferred values are distinguishable from explicit user selections.

**8. Phase 4 — add Oracle-to-Planner handoff**

Work:

- Add “Edit in Route Planner” to a valid, completed route result.
- Transfer input fields only, using a versioned, bounded session-storage draft with an opaque identifier in `/planner?draft=...`. Do not transfer answer HTML, model instructions, credentials, or trusted calculated results.
- Set a documented expiry, initially 30 minutes; validate every field on hydration. Scope draft reuse to the signed-in account and clear drafts on logout/account change. Client account scoping is hygiene, not a replacement for server authorization.
- Keep the draft available until expiry so a refresh can restore the input review. Handle missing, malformed, expired, and unavailable-storage cases visibly without applying arbitrary fallback inputs.
- Prefill the Planner, show that the values came from an Oracle estimate, and wait for the user to press Calculate. Merely opening a draft must not call Gemini or rerun the route.
- For historical results without sufficient planning inputs, explain why handoff is unavailable instead of inventing values.

Expected files: `RouteEstimateDetails.tsx`, `OracleResults.tsx` if needed for completed-result eligibility, new `frontend/src/lib/route-draft.ts`, Planner hook/page, logout cleanup seam if required, and dedicated handoff checks.

Acceptance:

- [x] Supported names, coordinates, cargo, ETD offsets, dates, and planning times survive handoff.
- [x] Original saved chat results remain unchanged after Planner edits.
- [x] Invalid drafts cannot trigger calculation or override validated results.
- [x] Old/failed/incomplete results and storage failures have clear UI behavior.

**9. Phase 5 — unify actionable insights and provenance**

Work:

- Compute deadline-related values in the backend: estimated arrival and cutoff slack, with additive optional fields such as `estimated_arrival_datetime` and `cutoff_slack_min`.
- Define slack consistently as latest gate-in minus estimated arrival. Positive/zero slack meets the estimated cutoff; negative slack misses it. Missing date or unavailable inputs must not create invented absolute timestamps.
- Share frontend insight derivation and presentation between Planner and Oracle: travel time, distance, arrival/cutoff, slack, congestion basis, routing source, assumptions, and warnings.
- Label `optimal_departure` as a back-calculated latest departure estimate. The current calculation evaluates congestion at the requested departure hour; if the back-calculated suggestion crosses a traffic period, disclose that assumption and offer recalculation at the selected time.
- Do not describe the suggestion as a globally optimal or guaranteed-safe departure. Searching departure candidates and recalculating congestion for each is a separate estimator enhancement.
- Render critical numbers directly from validated data. Ask the agent to explain those results without inventing arithmetic or claiming observed savings. Evaluate answer consistency rather than claiming that formatting or schemas eliminate hallucinations.
- Distinguish calculation time from observation freshness, synthetic congestion from recorded data, and fallback geometry from a road-following route.

Expected files: route response/calculation, Oracle contracts/types/parser, new shared route insight helper/component, Planner page, and Oracle detail component. Reuse `MapView` and the established UI palette.

Acceptance:

- [x] Planner and Oracle display equivalent insights for equivalent data.
- [x] Clock/date boundaries, zero slack, infeasible departures, unknown values, and fallback sources are explicit.
- [x] Ferry cutoff feasibility is presented as an estimate, not a booking or cargo-capacity guarantee.
- [x] New fields are optional for old saved results, and old responses still render safely.

**10. Phase 6 — verification and report evaluation**

Automated checks:

- Backend: canonical contract validation, route arithmetic, midnight and offset handling, location resolution, route-context selection, tools, replay, and persistence regressions.
- Add `backend/tests/test_route_oracle_parity.py`: call the HTTP route path and the Oracle tool adapter with equivalent inputs and fixed dependencies; compare normalized calculation results, warnings, sources, and geometry.
- Frontend: shared response parsing, draft expiry/account isolation, calendar controls, stale requests, map/result rendering, and all existing Oracle progress/Markdown/history/result regressions.
- Browser: route-only planning, date-aware cutoff planning, handoff/reload/edit/recalculate, failed API calls, invalid drafts, mobile layout, keyboard operation, and old saved results.
- Run TypeScript, targeted lint, and production build after the integration changes. Run existing authentication/lifecycle checks without modifying live data or schema for this feature.

Proposed agent evaluation:

| Test category | Held-out scenarios |
| --- | ---: |
| Complete requests covering route, congestion, and schedules | 10 |
| Missing fields and ambiguous/unknown locations | 10 |
| Multi-turn updates and corrections | 10 |
| Dates, timezones, conflicting days, and invalid coordinates | 10 |
| Empty data, tool errors, and provider failure behavior | 10 |
| Unrelated requests and misleading instructions | 10 |
| Total | 60 |

These are proposed pilot counts, not a statistical-power claim or completed measurements. Keep a separate development set for prompt/context tuning. Annotate expected tools, normalized parameters, required clarification, allowed alternative trajectories, numeric tolerances, and the task outcome; avoid exact prose matching.

Compare the source-baseline agent with the enhanced agent using the same fixtures, provider/model configuration, and held-out scenarios. Where possible, repeat each scenario three times per version. That is up to 360 conversation runs, potentially more model requests because of tool rounds. Begin with a small quota-aware pilot; record unavailable runs and do not extrapolate them into successful results. Injected provider failures are controlled reliability tests and must be reported separately from live semantic quality.

Measures:

- Tool selection: correct tool behavior among scenarios requiring tool decisions, including cases where no tool is appropriate.
- Argument accuracy: schema validity and semantic correctness against the annotated normalized inputs.
- Clarification: appropriate questions when required, and unnecessary clarification when sufficient data exists.
- Task success: all required scenario conditions satisfied, not merely receipt of a completed SSE event.
- Answer grounding: factual/numeric claims supported by the returned data; manually review explanations against a defined rubric.
- Reliability: repeated-run success and scenarios passing every repetition, reporting both scenario and attempt counts.
- Performance: first visible progress, first answer text, completion latency, tool/provider requests, and available token usage. Report median/p95 descriptively with sample sizes and failed turns separately.

Create a sanitized evaluation runner and fixture dataset, for example `backend/scripts/evaluate_oracle_integration.py` and `backend/tests/fixtures/oracle_integration_cases.json`. Save actual run manifests, test outputs, case-level failures, and summaries under a dated `docs/oracle/evidence/` directory. Record model/configuration, source SHA, fixture version, and environment. Do not log real credentials or unrestricted production chat content.

For usability, use representative logistics tasks and counterbalance Planner/chat order. Record the participant group and count, task completion, completion time, corrections, and understanding of estimates. If representative participants are unavailable, label the work as a technical scenario evaluation; do not report simulated browser checks as user research.

Genuine signed-in browser persistence and live Gemini/tool acceptance remain separate gates. Use available authorized sessions and record their actual outcomes. Historical provider quota incidents do not establish current availability.

**11. Report deliverables**

| Report section | Planned material |
| --- | --- |
| BAB III 3.1–3.2 | Location/schedule/congestion sources, normalization, coverage, feature/data limitations |
| BAB III 3.3 | Existing estimator formulas, Random Forest role, external Gemini role, tool selection/validation and clarification design |
| BAB III 3.4 | Architecture and sequence diagrams, shared route contracts, map integration, handoff and saved-history flow |
| BAB III 3.5 | Test categories, baselines, scoring rubric, controlled fixtures, repetitions and usability procedure |
| BAB IV 4.3–4.4 | Implemented behavior, request/response examples, sanitized traces, screenshots, and integration outcomes |
| BAB IV 4.5 | Actual parity results, agent outcomes, latency samples, failure analysis, usability results if collected, and limitations |

Update the API contract, current-state record, and report evidence map after the relevant phase passes. Keep the original context snapshot unchanged. The existing synthetic congestion accuracy must not be presented as agent accuracy or independently observed Batam traffic performance.

**12. Delivery order and completion gate**

Recommended implementation batches:

1. **Contracts and Planner parity:** Phases 0–2. Reviewable result: both entry points accept equivalent planning inputs and consume validated outputs.
2. **Conversational integration:** Phases 3–4. Reviewable result: reliable follow-ups and editable handoff, preserving saved results.
3. **Insights and evidence:** Phases 5–6. Reviewable result: consistent explanations and a reproducible evaluation package.

Each batch should have focused validation and a separate reviewable commit. Keep schema changes out of the core scope. If additive payload validation or a future tool change actually requires a migration, document the exact compatibility issue and revised rollout before expanding the work.

Completion requires all core acceptance items to pass, existing critical Oracle behavior to remain intact, and evidence to state its environment and limitations. A failed live dependency stays an open acceptance item; mocked success is not a replacement. Do not add unrelated features after the agreed gates pass.

Rollback uses the batch commits and additive-contract compatibility. Keep existing saved history and reference data intact. New UI helpers and draft storage can be removed without rewriting conversations. Implementation was authorized after this plan was created. No application deployment, product-database change, or estimator-model replacement occurred. Limited controlled-tool live provider pilots are recorded separately.
