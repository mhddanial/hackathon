# Sprint 5 — Departure interface

Implementation: 23 October 2026; D5-06 verification completed 24 October 2026, Asia/Jakarta. Owner: **Ananda Khusnul Hotimah — 3312401044**. Scope: **Sprint 5 only, frontend**. D5-01–D5-06 are checked complete against **synthetic simulation** evidence. The D5-06 follow-up ran isolated headless Chromium, synthetic sign-in/API flows, desktop/mobile screenshot inspection, and real keyboard traversal. No real login, live backend, real sailing, observed traffic, or usability-participant result is claimed. **Sprint 6 was not started.**

## Entry and source policy

Read `docs/departure/README.md` first, then the Sprint 4/5 plan sections, Sprint 1 design report, frozen API contract, wireframe/user flow, schedule policy, and context sections 11/17. All five Sprint 4 tasks are checked complete in the plan, with an offline implementation result. Automatic selection and alternatives are therefore enabled. The temporary selected-only 422 restriction is not applicable. D3-06 remains open for real-data acceptance.

Before frontend edits, read `frontend/AGENTS.md` and installed Next.js 16.3.1 guides: `03-layouts-and-pages.md`, `05-server-and-client-components.md`, `01-directives/use-client.md`, and `16-proxy.md` under `frontend/node_modules/next/dist/docs/01-app/`. Retained the existing middleware convention; its deprecation does not authorize a shared authentication migration under Sprint 5.

No conflict requiring a contract change was found. The source-of-truth design/policy/contract files were not edited. D5-01–D5-05 were checked after implementation; D5-06 was checked only after the 24 October headless checks and screenshot inspection passed.

## Delivered behavior and task evidence

| Task | Implementation and passed checks | Remaining boundary |
| --- | --- | --- |
| D5-01 | `/departure` uses the dashboard shell; exactly one sidebar entry and one explicit protected-route entry; one Topbar title mapping. Helper asserts both entry counts; scoped lint, typecheck and production build pass. | Synthetic auth protection/sign-in and existing route browser regression passed in D5-06. |
| D5-02 | Typed authenticated client, strict runtime response parser, request bounds and streamed response-size limits. Validates exact fields/nulls/enums, real dates/aware timestamps, source-zone conversions, positive threshold, durations, plan/target binding, arithmetic/status consistency, candidate counts, alternative limits/order/identity and sources. All three frozen 200 examples and malformed/error cases pass offline. | Mocked HTTP is not a live API call. |
| D5-03 | Shared origin catalog/coordinates, terminal, exact recorded destination, explicit service, road date/time and separate sailing date in WIB. Derived day type. Actual UUID picker retains terminal/destination/cutoff identity and shows unknown occurrence metadata as unverified. Inline errors and linked summary. Form validation and rendered label/DOM-order checks pass. | Catalog bindings and actual Tab/Shift-Tab behavior passed in headless Chromium. |
| D5-04 | Backend status/reason, sailing identity/departure, recorded cutoff, road departure, ETA, signed buffer, configured simulation threshold, fixed-duration latest estimate, provenance/verification/assumptions/warnings. Separate unavailable route estimate; at most three independent alternatives; explicit choose/recalculate; no alternatives on UNAVAILABLE. Status/zero/negative/boundary and rendered markup checks pass. | 1440 px desktop and 375 px mobile screenshots captured and inspected; no clipping or horizontal overflow observed. |
| D5-05 | Edits clear results and abort old requests; generations ignore late completions. Stop/retry, validation/422, 404, auth/503, empty/unavailable/malformed and timeout states. API checks current account before and after I/O. Workspace identity keys clear state on account changes/logout; 401 clears plan/results and requires sign-in. Actual hook source passes deterministic dispatcher tests, including delayed completion, stop, competing requests, unmount, alternative and road-time actions, outage and 401. | Headless checks now verify real React/browser lifecycle, focus and keyboard actions as well as the earlier dispatcher/SSR checks. |
| D5-06 | **Passed:** 26 departure headless groups, 13 existing route browser groups, desktop/mobile screenshot inspection, real keyboard traversal/focus, 18 helper groups, typecheck, scoped lint and rebuilt production bundle. Two minimal frontend accessibility fixes described below. | Synthetic loopback services only. No Computer Use or user Chrome was used for this verification. Full-project lint still has 7 unrelated existing errors. |

The UI renders server decisions and fails closed on inconsistent responses. It does not apply congestion again, choose a replacement cutoff, supply a safety margin, add real occurrence metadata, or infer service permission/capacity. Unknown decision values remain unavailable. Tiny negative buffers retain their negative meaning; displayed rounding cannot change status. Choosing another sailing preserves the road plan and explicitly recalculates. Adopting the fixed-duration estimate fills road date/time and requires another calculation.

All browser fixture sailings are explicitly synthetic scenarios. The application has no demo-data switch or fixture fallback. Real catalog clocks are displayed as recorded source values, without assigning a timezone/date. Mobile CSS uses the same form/result reading order and stacked alternative cards, with 44 px control targets; these layouts were inspected in the final synthetic desktop/375 px screenshots, and keyboard/touch targets were checked headlessly.

## Files changed

New frontend files:

- `frontend/src/app/(dashboard)/departure/page.tsx`
- `frontend/src/components/departure/DepartureRecommendation.tsx`
- `frontend/src/components/departure/DepartureForm.tsx`
- `frontend/src/components/departure/DepartureResult.tsx`
- `frontend/src/hooks/use-departure-recommendation.ts`
- `frontend/src/types/departure.ts`
- `frontend/src/lib/departure-api.ts`
- `frontend/src/lib/departure-contract.ts`
- `frontend/src/lib/departure-form.ts`
- `frontend/scripts/check-departure.mjs`
- `frontend/scripts/check-departure-ui.js`
- `frontend/scripts/departure-ui-fixture.mjs`
- `frontend/scripts/prepare-departure-check.mjs`
- `frontend/scripts/run-departure-headless.mjs` (added for D5-06)

Minimal shared edits: `frontend/src/components/layout/Sidebar.tsx` (one entry), `frontend/src/components/layout/Topbar.tsx` (one title), `frontend/src/utils/supabase/middleware.ts` (one protected route), and `.gitignore` (three specific exceptions required because new frontend lib helpers were otherwise ignored).

Original implementation evidence: five initial plan checkboxes, this report, and six sanitized logs under [`../evidence/sprint-5/`](../evidence/sprint-5/): `departure-helpers.log`, `route-helpers.log`, `typecheck.log`, `scoped-lint.log`, `full-lint.log`, `build.log`.

No backend file, congestion/route/schedules service, schema, authentication provider, dependency manifest or lockfile changed. No commit, deployment, `.env` read/print, schema execution, or live data write was performed.

## Commands and actual results

Unless otherwise stated, working directory is `frontend/`. Shell output redirections only save the corresponding evidence logs.

| Exact command | Actual result |
| --- | --- |
| `npm ci --offline --ignore-scripts` | Exit 1: `ENOTCACHED`, missing `zwitch` tarball. No usable offline dependency installation. |
| `npm ci --ignore-scripts` | Exit 0 after requesting network approval; installed 717 locked packages. npm reported 21 dependency vulnerabilities (4 moderate, 15 high, 2 critical); dependency remediation is outside this sprint and no upgrades were made. |
| `node scripts/check-departure.mjs` | Exit 0, **18 check groups passed**: frozen examples, strict parser, dates/zones, signed boundaries, unavailable confidence, candidate limits/binding, form validation, catalog bindings, bearer/signal handling, safe error shapes, malformed/oversized bodies, account changes/abort, actual-hook lifecycle, component SSR and exact shared-entry counts. Synthetic only; SSR uses primitive UI stubs. |
| `node scripts/check-route-integration.mjs` | Exit 0, **8 existing helper groups passed**. Offline/mocked HTTP only. |
| `npx --no-install tsc --noEmit --incremental false` | Exit 0. |
| Scoped ESLint command below | Exit 0, **0 errors / 1 pre-existing warning** (`options` at middleware line 18, unchanged). |
| `npm run lint` | Exit 1, **7 pre-existing errors / 19 warnings**. Errors in schedules page (effect state), login (two explicit-any), register (two explicit-any plus unescaped apostrophe), and `use-mobile.ts` (effect state). These files were not modified. |
| `git diff --check` (repository root) | Passed after implementation/tracking edits. |

Exact scoped ESLint command:

```sh
npx --no-install eslint src/components/departure src/hooks/use-departure-recommendation.ts src/lib/departure-api.ts src/lib/departure-contract.ts src/lib/departure-form.ts src/types/departure.ts 'src/app/(dashboard)/departure/page.tsx' src/components/layout/Sidebar.tsx src/components/layout/Topbar.tsx src/utils/supabase/middleware.ts scripts/check-departure.mjs scripts/check-departure-ui.js scripts/departure-ui-fixture.mjs scripts/prepare-departure-check.mjs
```

Production build was isolated to avoid Next automatically loading any repository `.env` file. From repository root:

```sh
node frontend/scripts/prepare-departure-check.mjs
```

This produced `/private/tmp/departure-sprint5-mWoZgy`: copied frontend files excluding `.env*`, node_modules, build/output artifacts; symlinked the installed dependencies; copied only the shared location catalog into the equivalent backend/data path. Webpack was used with this external dependency symlink. Final frontend sources were synchronized into that copy before the final successful build.

From `/private/tmp/departure-sprint5-mWoZgy/frontend`:

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9011 NEXT_PUBLIC_SUPABASE_ANON_KEY=synthetic-local-key NEXT_PUBLIC_API_URL=http://127.0.0.1:9011 NEXT_TELEMETRY_DISABLED=1 npm run build -- --webpack
```

Initial sandbox build failed resolving the existing Google Fonts imports (`fonts.googleapis.com`). After requesting network approval, build passed. Final build after source synchronization also exited 0, including TypeScript, 12 generated static pages, and `/departure` in the route output. Warnings: existing middleware-to-proxy deprecation, Next Edge-runtime import warnings, webpack cache string serialization. This is a build using **synthetic loopback settings**, not a deployed/live integration result.

Fixture startup command:

```sh
node scripts/departure-ui-fixture.mjs
```

**23 October initial result:** sandbox attempt failed `listen EPERM 127.0.0.1:9011`; approved rerun successfully listened on loopback. Computer Use access was unavailable, so the browser scripts were not executed then. **24 October D5-06 follow-up:** isolated headless checks now pass as detailed below. This follow-up did not use Computer Use or the user’s Chrome.

During authoring, an initial typecheck found one new type narrowing issue, scoped lint found a callback named like a hook, and later lint found two anonymous test primitive names. These were corrected before the final passing typecheck/scoped-lint runs. An initial repository-root `npx tsc` invocation was interrupted (130) and rerun correctly inside frontend. No result from those attempts is presented as a pass.

## D5-06 headless verification — 24 October 2026

**Result: passed, synthetic simulation only.** [Detailed evidence and attempt history](../evidence/sprint-5/README.md), [departure machine result](../evidence/sprint-5/headless-verification.json), [route regression result](../evidence/sprint-5/route-headless-verification.json). Isolated Playwright **1.64.1**, Chromium headless shell **156.0.8078.4**; new temporary browser context, no user browser/profile or persisted tokens. All page requests were restricted to ports **3011/9011** on `127.0.0.1`. External map tiles were blocked during the route regression; no map-provider or live routing acceptance is claimed.

The existing departure browser-fixture script was the first UI suite executed. It was strengthened with actual keyboard traversal and first-invalid-field focus assertions. The existing route browser script ran unchanged in memory apart from mapping its 3010/9010 URLs to 3011/9011 and redirecting screenshots into evidence. Its synthetic fixture was temporarily served on 9011 after the departure suite finished. No backend or contract problem was found; backend/contract files were not edited.

| Verification | Final result |
| --- | --- |
| Protected route, synthetic sign-in and session/account clearing | Passed. Sign-in used fake loopback Auth; no real Supabase login. |
| SAFE, RISKY including signed zero, MISSED including tiny negative buffer | Passed; selected UUID retained, status before rounding preserved. |
| UNAVAILABLE: missing cutoff, empty, stale, fallback, automatic truncation | Passed; no calculated alternatives or decision values retained. |
| Alternatives, explicit recalculate, no alternatives, selected-target truncation | Passed; road plan preserved and incomplete comparison disclosed. |
| 401, 503, 422 validation/mismatch, 404, malformed response | Passed; correction/sign-in/retry paths and cleared result states verified. |
| Temporary 422 for omitted target | **Not applicable:** Sprint 4 is checked complete; automatic requests succeed in the synthetic suite. |
| Edit/Stop cancellation, keyboard Stop, slower old SAFE versus newer RISKY | Passed; final capture observed **4 `net::ERR_ABORTED` requests**, no stale replacement. |
| Keyboard order/focus | Passed with physical Tab/Shift-Tab/Enter events: fields including native date/time segments, Calculate, catalog reload, road-time action, sources disclosure, Revise and alternative actions. Field/result/action focus and 44 px feature control targets checked. |
| Desktop/mobile | Passed at 1440 px and **375 px**; full-page screenshots inspected, no horizontal overflow/clipping observed. |
| Existing route browser regression | **13 groups passed**, including route inputs, errors, stale responses, Oracle handoff/drafts, mobile layout, expiry/logout/account isolation. All synthetic. |

Two frontend fixes were made after reproducible failures:

1. `frontend/src/hooks/use-departure-recommendation.ts`: order server-reported invalid fields by the visible form order before building the summary and focusing its first field. Also map `origin_name` to Origin and derived `day_type` to Road date. The failing mismatch scenario returned schedule/terminal in reverse form order; the final browser test now confirms focus on Terminal. The helper suite includes a regression assertion.
2. `frontend/src/components/departure/DepartureResult.tsx`: increase the sources disclosure target from 32 px to **44 px**. The actual keyboard/touch-target check failed before this change and passes afterward.

A first test-harness failure was corrected by opening the mobile sidebar before accessing its account menu. Initial failure artifacts are preserved, rather than reported as passes. The later final run passes all **26 departure groups**, with **zero uncaught page errors**; the route run also has zero uncaught page errors. There are no remaining failed or manual-pending checks in the named D5-06 scope. Headless viewport checks do not claim physical-device or live-service acceptance.

Exact additional commands, run from `frontend/` unless specified:

```sh
npm install --prefix /private/tmp/departure-headless-d5-06 --no-save --package-lock=false playwright
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/departure-headless-d5-06/browsers /private/tmp/departure-headless-d5-06/node_modules/.bin/playwright install chromium --only-shell
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/departure-headless-d5-06/browsers node scripts/run-departure-headless.mjs
ORACLE_FIXTURE_PORT=9011 node scripts/oracle-ui-fixture.mjs
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/departure-headless-d5-06/browsers node scripts/run-departure-headless.mjs --route-regression
node scripts/check-departure.mjs
node scripts/check-route-integration.mjs
npx --no-install tsc --noEmit --incremental false
npx --no-install eslint src/components/departure/DepartureResult.tsx src/hooks/use-departure-recommendation.ts scripts/check-departure.mjs scripts/check-departure-ui.js scripts/run-departure-headless.mjs
npm run lint
```

Download/install exited 0 after approval, entirely under `/private/tmp`; repository manifests/lockfile unchanged. The sandbox blocked the first headless launch with SIGTRAP/EPERM before assertions; approved execution of the isolated headless runner succeeded. Final browser commands exited 0 (**26 / 13 groups**). Helper commands exited 0 (**18 / 8 groups**); typecheck and scoped lint exited 0 (**0 scoped warnings/errors**). `npm run lint` exited 1 with the same **7 pre-existing errors / 19 warnings** in unrelated schedules/login/register/use-mobile files.

The isolated production build was rerun after the fixes with the same exact loopback environment/build command above; it exited 0 and includes `/departure`. Source hashes confirmed that the tested temporary copy matches every current `frontend/src` file. See `d5-06-build.log`, `d5-06-helpers.log`, `d5-06-route-helpers.log`, `d5-06-typecheck.log`, `d5-06-lint.log`, and `d5-06-full-lint.log`.

Both server processes were stopped via SIGINT when verification finished. The [cleanup proof](../evidence/sprint-5/process-cleanup.json) confirms **no listeners on 3011 or 9011**. Browser contexts were closed. No commit was created.

## Sprint 6 entry gate — not started

D5-06 is now complete with synthetic browser evidence and inspected layouts. **No Sprint 6 task was started.** The unrelated full-project lint baseline still requires owner fixes or an agreed baseline disposition before a clean overall release claim. D3-06/live schedule semantics, source verification and route-context evidence still gate real-data release. Supervisor/institution approval and actual participants remain prerequisites for usability collection under the existing protocol. No real login/backend test, live sailing evidence, observed traffic or participant result is supplied here.
