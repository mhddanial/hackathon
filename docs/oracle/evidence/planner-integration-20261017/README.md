# Planner–Oracle integration evidence

17 October 2026. Application changes are local. Automated tests, synthetic browser transport, live provider samples, and pending human/production acceptance are separate evidence.

| Artifact | Result and scope |
| --- | --- |
| [Validation summary](validation.json) | 349 backend tests, 72 frontend helper/check groups, 46 Chromium scenarios; TypeScript, targeted lint and production build passed |
| [Initial baseline tests](baseline-tests.xml), [baseline manifest](baseline.json) | 94 mocked checks before backend/prompt changes; source revision and dependency/formula record |
| [Final backend gate](backend-tests.xml) | 349 passed, zero failures/errors/skips, actual isolated PostgreSQL with simulated Auth/provider transport; two expected malformed-argument serializer warnings |
| [Frontend helpers](frontend-helpers.txt) | 18 result, 14 stream, 22 API/history, 10 Markdown and 8 route integration groups; controlled data |
| [Planner/handoff browser checks](browser-planner_handoff.json) | 13: named inputs, dates, ETD/cargo, failures, stale requests, handoff/reload, old/incomplete results, mobile, expiry, logout and account isolation |
| [History browser regressions](browser-history.json) | 17 saved-history, pagination, replay, account-change and later-login scenarios; synthetic accounts/API |
| [Route-modal regressions](browser-route_modal.json) | 8 layout, feasibility, missing data, zero values, dates and mobile scenarios |
| [Progress regressions](browser-progress.json) | 8 progress/terminal/cancellation/switching/surface scenarios |
| [Final-set manifest](evaluation-manifest.json) | Sixty authored cases validated/listed without provider execution; source/dataset hashes and explicit unrun status |
| [Original pilot source catalog](pilot-source-catalog.json) | Retained to reproduce the dataset hash in the actual pilot records; three used cases were replaced in the final set |
| [Live original-prompt pilot](live-baseline-pilot.json) | Three completed Gemini conversations with deterministic synthetic tools and in-memory persistence |
| [Live enhanced pilot](live-enhanced-pilot.json) | One completed conversation, one failed actual HTTP 429, one unrun scenario; subsequent calls stopped |
| [Desktop figure](planner-integration-desktop.png), [mobile figure](planner-integration-mobile.png) | Real Next UI with deliberately synthetic route/Auth/API data; development-browser screenshots, not actual traffic or usability findings |

The provider pilot used the configured `gemini-2.5-flash`. Baseline means original `c214987` system prompt with explicit route reference disabled; both variants used the same integration tool fixtures. These records are not a full earlier-release comparison. Their limited samples do not support a quality or performance improvement claim. Human verdicts remain pending. The origin-corridor wording was subsequently clarified after reviewing the pilot, and that final wording has not been retested live because of quota exhaustion.

Backend parity fixtures use a 1.5 congestion multiplier and the agent-evaluation fixtures use 1.2; their 15-minute and 12-minute examples are controlled values with different purposes. Do not aggregate them into real-traffic accuracy. Public map tiles may load during browser checks; route and Auth/API responses remain fixture data.

Tests used an isolated loopback PostgreSQL cluster and uniquely named disposable databases; no product Supabase migration/history change was performed. Browser tests ran on isolated Next/API ports 3010/9010. FastAPI was not restarted on a production/local user port. Fixture accounts, cookies and temporary test services are excluded from Git and are not application credentials.

Still pending: final-set repeated live evaluation, domain/human review, genuine signed-in production persistence, and participant usability research. Use the [implementation record](../../sprints/PLANNER_ORACLE_INTEGRATION.md) and [evaluation procedure](../../reports/PLANNER_ORACLE_EVALUATION_GUIDE.md) when writing BAB III/IV.

The owned browser and temporary services were stopped and their test ports verified closed. Automatic command review blocked recursive deletion of the temporary PostgreSQL directory, so that inactive directory remains in Windows Temp. The workspace marker was removed; no product database or unrelated service was stopped.
