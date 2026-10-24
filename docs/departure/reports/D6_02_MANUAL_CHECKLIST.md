# D6-02 — manual local signed-in acceptance

Prepared 24 October 2026, Asia/Jakarta. **Not executed. D6-02 remains pending until sanitized results are supplied and reviewed.** The user will start backend/frontend and perform these checks in their own terminal/browser. The assistant will not read or load `backend/.env` or `frontend/.env.local`, start replacement services, or access the user's browser for this handoff.

The assistant-started backend on 8080 has been stopped so it does not conflict with the user's process. Earlier health/OpenAPI checks establish startup only. The existing 9011/3011 fixtures are separate synthetic evidence and must not be used to close D6-02.

## Before testing

- Use the intended approved read-only test scope and an existing test account. Starting FastAPI locally does not make the configured Supabase database local; confirm the dependency environment yourself without sharing configuration values.
- Start the existing backend on **127.0.0.1:8080** and frontend on **127.0.0.1:3000** in your own terminals. Confirm the browser calls the local backend and that frontend/backend use the same intended Supabase project. Do not use the previous fixture build, whose public settings point to fake services. Public Next settings need the correct build/dev configuration; changing only the environment of an already built fixture does not change its browser bundle.
- Do not initialize/reset a database, run `backend/database/schema.sql`, apply migrations, import/seed schedules, create accounts, or edit source metadata to produce a passing result. Use existing approved records only.
- Keep credentials, account names/emails, tokens, API keys, cookies, authorization headers, HAR files and raw diagnostic dumps out of chat/evidence. If using screenshots, remove account details and sensitive operational information first.

## Checks

Use `PASS`, `FAIL`, or `PENDING` for each item. A pending item is not a pass. Record the actual outcome even when required metadata is absent.

| ID | Action | Expected behavior / information to record |
| --- | --- | --- |
| M01 | Open local `/health`, then `/departure` while signed out. | Health HTTP 200; protected page leads to login. This alone does not test authenticated dependencies. |
| M02 | Sign in with your existing test account and open `/departure`. | Page opens under the actual account; backend target is local 8080. Report success/failure without identity or credential details. |
| M03 | Submit an **automatic** plan using approved existing terminal/destination/service inputs, full road date/time in WIB and an explicit service date. | Record request mode, HTTP status, result status/reason, sources and limitations. A successful empty or incomplete lookup must remain UNAVAILABLE; dependency failure must not become a plausible recommendation. Do not copy fixture dates or invent sailing metadata. |
| M04 | Select a known recorded target and submit a matching plan. | Exact target retained, including MISSED/UNAVAILABLE outcomes. For a calculated result, record full dates/offsets, cutoff, ETA, travel minutes, signed buffer and configured positive threshold. Verify ETA uses travel duration once; buffer is recorded cutoff minus ETA; compare status before rounding. Missing required metadata means UNAVAILABLE, with null decision values and no alternatives. |
| M05 | If evaluated alternatives actually exist, choose one and recalculate. | Road date/time unchanged; new target and its own status/buffer displayed; no more than three alternatives, all on the requested service date. If data supports no alternatives, record that limitation and mark alternative selection PENDING rather than manufacturing one. |
| M06 | Enter an invalid form value. If possible, change valid inputs while a request is still pending, then recalculate. | Invalid form links/focuses the corrective field without submitting; edited inputs clear old results and older responses cannot overwrite a newer plan. If requests finish too quickly to observe the race, mark that portion PENDING; existing synthetic races remain separate evidence. |
| M07 | Sign out after displaying a result and revisit `/departure`. If a genuine expired session is available, separately observe its behavior. | Logout clears the result and protects the route. An actual 401 clears success and requires sign-in. Logout/redirect alone does not prove expired-token HTTP handling; mark expiry PENDING if not observed. Never paste a session token. |
| M08 | With only your local backend, stop it, submit/retry from the UI, then restart it and retry. | Connection failure clears prior success, ends loading and offers recovery. This tests local connection failure, **not** a backend-generated dependency 503. Record actual 503/422/404 responses separately only if safely observable with existing authorized inputs; otherwise leave those variants PENDING. Do not disable or modify shared remote dependencies. |
| M09 | Review sources and limits for the actual returned outcome. | Recorded database provenance is distinct from synthetic congestion/project assumptions. `data_status: simulation` can still apply to a calculation using database rows; it is not observed traffic or a boarding guarantee. Missing dates/zones/cutoffs remain unverified. No fallback route establishes a SAFE decision. |

If the real dataset cannot establish dated occurrences, service applicability, freshness or route context, report the actual UNAVAILABLE reasons. Correct unavailability is useful integration evidence; it does not establish a successful real-sailing calculation or close unsupported alternative/error variants. Do not mark the entire checklist passed from one UNAVAILABLE result.

For each captured request, record observed browser request duration if available and identify it as **client-observed network duration**, with actual sample count. Do not reuse synthetic ASGI timing samples as real network latency. Use approved non-sensitive input summaries; replace private labels/identifiers with consistent aliases and state what was redacted. If redaction prevents arithmetic or binding review, leave that conclusion unverified.

## Paste-back format — blank, not evidence

Copy and fill only with what you actually observed. Keep skipped cases PENDING and describe why. No credential or full request-header capture is needed.

```text
D6-02 manual results
Run date/time + timezone:
Backend/frontend revision or "current uncommitted worktree":
Local backend/frontend ports:
Dependency environment (local/non-production/other approved scope; no secrets):
Same intended Supabase project confirmed: YES / NO / UNKNOWN
No fixture Auth/API used: YES / NO / UNKNOWN
Approved read-only records only: YES / NO / UNKNOWN
M01:
M02:
M03:
M04:
M05:
M06:
M07:
M08:
M09:

For each relevant response, repeat:
Case alias / selected or automatic:
Non-sensitive input summary + explicit dates/WIB:
HTTP status:
Result status / reason_code (or safe error category):
ETA / recorded cutoff (full offsets):
Travel minutes / signed buffer / safety threshold (or null):
Sources / data_status / warnings:
Alternatives observed and choice/recalculation outcome:
Client-observed duration + sample count (or not measured):
Expected vs actual; PASS / FAIL / PENDING:
Redactions and limitations:

Other errors or blocked variants:
```

After results arrive, distinguish **user-reported manual evidence** from assistant-observed checks, review actual coverage, and update D6-02 only if its required checks pass. Keep unsupported cases pending, connect failures to fixes/retests, and stop/report backend or contract issues without changing backend code. D6-04 remains deferred; this checklist does not authorize deployment, data writes, commits, or Sprint 7.
