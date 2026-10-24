# Sprint 5 evidence — SYNTHETIC SIMULATION ONLY

D5-06 verification date: **24 October 2026, Asia/Jakarta**. These artifacts use fake loopback Auth/API and synthetic schedules/route data. **No real login, live backend, real sailings, observed traffic or participant usability results.** No Computer Use or user Chrome was used for D5-06.

## Final evidence

- [`headless-verification.json`](headless-verification.json): **26 departure groups passed**, isolated Chromium 156.0.8078.4; four cancelled requests; no uncaught page errors; real Tab/Shift-Tab/Enter traversal and focus checks. Includes all requested calculated/unavailable/error scenarios and account clearing.
- [`route-headless-verification.json`](route-headless-verification.json): **13 existing route browser groups passed**. Existing script remapped to synthetic ports 3011/9011; external map tiles blocked. No real map/routing service acceptance.
- [`headless-departure.log`](headless-departure.log), [`headless-route.log`](headless-route.log): sanitized successful run output. No tokens, auth headers, cookies, browser storage, HAR or trace files are stored.
- [`departure-desktop.png`](departure-desktop.png): **synthetic simulation**, 1440 px desktop, captured after both frontend fixes and visually inspected.
- [`departure-mobile-375.png`](departure-mobile-375.png): **synthetic simulation**, 375 × 812 viewport, full-page capture, visually inspected at native width via four crop panels. Full dates, signed buffers, labels, stacked alternatives and actions fit without clipping or horizontal overflow. Original screenshot is unchanged.
- [`planner-integration-desktop.png`](planner-integration-desktop.png), [`planner-integration-mobile.png`](planner-integration-mobile.png): **synthetic simulation** route regression captures, inspected at 1440 px / 390 px. Blank map baselayer is expected because external tiles were blocked; the blue line is a synthetic fixture geometry.
- `d5-06-helpers.log`: **18 offline helper groups passed**, including invalid-field ordering regression.
- `d5-06-route-helpers.log`: **8 existing route helper groups passed**.
- `d5-06-typecheck.log`, `d5-06-lint.log`: exit 0, empty logs mean no diagnostics (0 scoped lint warnings/errors).
- `d5-06-build.log`: successful isolated production build after both fixes, synthetic loopback settings, `/departure` included.
- `d5-06-full-lint.log`: exit 1, **7 existing errors / 19 warnings**, unrelated files unchanged. This is a known project baseline issue, not a hidden passing result.
- [`process-cleanup.json`](process-cleanup.json): after SIGINT, `lsof` found **no listeners on 3011 or 9011**.

Desktop/mobile inspection found readable, naturally wrapped labels/timestamps, complete UUIDs, visible simulation limitations, and no overlapping/clipped content. Departure sidebar text truncates with its existing accessible tooltip; full heading/title is visible in the content. Sources toggle is now 44 px high; disclosure open/close and result/revise/road-time/validation focus were exercised headlessly.

## Initial failures, retained honestly

- `headless-attempt-1.json`: 21 groups passed before a test setup timeout tried to open the account menu while the mobile sidebar was closed. Fixed the test to open the sidebar. This first script used 390 px; its original planned-width metadata was inaccurate and is annotated in that artifact.
- `headless-attempt-2.json`, `headless-attempt-3.json`: stronger first-invalid-field focus assertion exposed reverse server field ordering. The latter captures actual focus on Target while Terminal was the first visible invalid field. Fixed the frontend hook to order affected controls by the form.
- `headless-attempt-4.json`: stronger keyboard/touch check exposed sources target below 44 px. All preceding 20 groups passed. Fixed only that departure component's minimum target height.
- `headless-failure.png`: **synthetic simulation**, final pre-fix failure screenshot for attempt 4. Retained for diagnosis; not the final inspected layout.
- Before any browser assertions, a sandboxed headless launch failed SIGTRAP/EPERM. The same isolated downloaded shell ran successfully with approved execution. No system Chrome profile was opened.

Initial 23 October implementation logs (`build.log`, `departure-helpers.log`, `route-helpers.log`, `typecheck.log`, `scoped-lint.log`, `full-lint.log`) remain as historical evidence. They are not substituted for the 24 October results.

## Reproduction

Exact commands, environment and fixture sequence are in [`SPRINT_5_REPORT.md`](../../sprints/SPRINT_5_REPORT.md). Runner: `frontend/scripts/run-departure-headless.mjs`; original departure script remains the UI test entry point, with added physical keyboard and focus assertions. Playwright 1.64.1 and its headless shell were installed only into `/private/tmp/departure-headless-d5-06`. The Next copy excludes repository `.env*` and uses synthetic settings. Browser requests are restricted to loopback ports 3011/9011. Temporary 422 for omitted target is **not applicable**, because all Sprint 4 tasks are checked complete. Final named D5-06 checks: **0 failed / 0 manual pending**. Sprint 6 was not started.
