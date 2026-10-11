# Sprint 6 — Integration, congestion validity, and report evidence

Implemented/verified locally: 11 October 2026, branch `danial`.
Implementation and automated gates passed. **Live release acceptance remains
open:** two real signed-in Supabase browser/API sessions were unavailable, and a
current Gemini diagnostic returned HTTP 429. S6-01 and the live part of S6-02 are
partial. Do not mark the entire Oracle feature or Sprint 6 live acceptance complete.

## Result and task status

Congestion now validates its artifact and recorded windows, keeps existing
source labels, and distinguishes unavailable data from an assumed default.
Initial DB failure returns safe HTTP 503 rather than promising a DB fallback.
Successful defaults include planning day/hour and explicit uncertainty. Oracle
saves the service's provenance disclaimer with the result.

| Task | Status and evidence |
| --- | --- |
| S6-01 | **Partial.** API/SDK/real disposable PostgreSQL A/B acceptance and 35 synthetic Chromium scenarios passed. Ten installed live ownership probes passed; real JWT/browser A/B acceptance still pending. |
| S6-02 | **Automated matrix passed; live completion partial.** Auth/DB/provider/tool/abort/retry/save-failure boundaries passed. Four live Oracle attempts did not complete; both public tools returned valid data in the first attempt, and a separate SDK request confirmed 429. Live missing-input/domain wording remains unverified. |
| S6-03 | **Complete.** Artifact package/features/order/classes/multipliers and exact peak encoding verified. Midnight/full-day windows, invalid inputs, model failures and recorded/default paths covered. Source labels and route-owner exports preserved. |
| S6-04 | **Complete.** Safe 503 on DB unavailability/malformed/ambiguous windows; assumed LOW/1.0 only after successful empty/no-match read, visibly labelled. |
| S6-05 | **Complete for current methodology.** Reproduced 14,400 synthetic rows, 80/20 stratified split, model parameters, metrics and confusion matrix; original artifact unchanged. Training/test overlap and source/provenance limits documented. Grouped evaluation remains optional research. |
| S6-06 | **Collected available evidence.** Sanitized live SQL/provider/public API results, tests, measured failed-turn latency with sample count, browser screenshots, and BAB III/IV evidence map. Missing live signed-in evidence is explicitly excluded. |
| S6-07 | **Complete.** Current context, contracts, sprint plan, evidence index, model methodology, environment template, migration instructions and release order synchronized; historical hackathon documents preserved. |
| S6-08 | **Local gates passed.** 282 backend tests, 44 frontend contract/history/stream checks, 35 browser scenarios, TypeScript/lint/build, whitespace/artifact audit and current-code local smoke. No deployment performed. |

## Focused changes

- `backend/routers/congestion.py`: validates model package/feature count/order,
  categories/classes and positive finite mappings. Incompatible model versions
  fall back to recorded data. Unknown predictions no longer silently become 1.0.
  Window matching is half-open, wraps midnight and supports the existing full-day
  convention. Malformed/overlapping windows return unavailable rather than an
  arbitrary first match. Valid segment missing remains 404; invalid inputs are
  rejected before DB access. Successful responses add source/status/disclaimer,
  planning fields and calculation time with no invented observation time.
- `backend/services/oracle_tools.py`: forwards the congestion service disclaimer;
  existing validated types, source mapping and tool-failure behavior remain.
- `backend/tests/test_congestion.py`: 65 regression/model/window cases, including
  the reproduced pre-fix 500 corridor outage and missing default planning fields.
- `backend/tests/test_oracle_integration.py`: two real PostgreSQL/SDK/RPC flows
  through the actual congestion tool, saved metadata, replay/follow-up without
  tool reexecution, foreign-owner denial, and an unavailable tool without a card.
- `backend/tests/test_oracle_provider.py`: current 429 plus existing 503 SDK
  failure checks prove no hidden retry, safe failed outcome and no diagnostic leak.
- `backend/scripts/audit_congestion_model.py`: public-read/in-memory notebook
  reproduction and unchanged-artifact audit. No import, model export or notebook
  execution/install cells are run.
- `backend/scripts/check_oracle_provider_live.py`: explicitly opt-in live quota
  check with in-memory persistence. It stops after a failed initial turn on future
  runs. The recorded initial run attempted four prompts before that refinement;
  its failure evidence is retained, not rerun or presented as success.
- `frontend/.env.example` and narrow Git ignore exceptions document public
  configuration; actual environment files and credentials remain unchanged.

The existing route service still owns its separate default/emission logic.
No route/departure business rules, model artifact, training notebook, dependency,
database policy/schema/migration, account, or historical hackathon document was
changed. Existing Sprint 5 uncommitted work was preserved. No Git commit, push,
application deployment, provider-key/model change, or billing change was made.

## Verification

| Gate | Actual result |
| --- | --- |
| Backend final suite | **282 passed**, zero skipped, 52.00 seconds. Includes 65 new congestion cases, two actual-tool persistence cases, and one additional SDK 429 case. Two expected malformed-argument serializer warnings remain. |
| Frontend helpers | **44 passed**: 16 result, 20 API/history and 8 stream checks. |
| Chromium | **35 passed**: 16 result scenarios, 17 history scenarios and two edges, using real Next/React/Supabase SDK with local synthetic Auth/API and two simulated accounts. |
| Installed live database | **21 passed**: ten A/B ownership checks plus 11 turn/RPC lifecycle checks. Existing IDs stay internal; synthetic history and temp objects rolled back. Counts stayed at eight conversations and 30 messages. |
| Model reproduction | Six segments, 25 windows, 14,400 rows, identical artifact/reproduced test predictions; accuracy **95.0694%**, macro F1 **0.8619**. All 2,880 test inputs recur in training. Artifact SHA-256 unchanged; no load warnings. |
| Current live provider | **Incomplete, not a success gate.** First turn used both tools and produced valid congestion/schedule data in memory, then failed without a completed answer. All four recorded prompts failed. Direct SDK diagnostic returned **429**; calls stopped. |
| Static/build | TypeScript, targeted ESLint, production build, syntax/JSON/links/credential scan and whitespace checks passed. Existing Next middleware-to-proxy warning remains. |
| Local smoke | Current backend started on 8000 and normal frontend restored on 3000. Health/public reference/congestion checks and anonymous Oracle redirect passed; no provider request or signed-in persistence claimed. |

Four attempted live-turn elapsed times were 10.016, 2.694, 2.536 and 2.281 seconds,
one sample per prompt. None had a completed answer; these are failed-turn timing,
not a response-quality or performance benchmark. The separate SDK diagnostic
confirms 429 resource/rate exhaustion, but its exact quota bucket/reset time was
not retrieved. Earlier failed turns are not assigned an unobserved error code.
Google documents 429 handling in its [troubleshooting guide](https://ai.google.dev/gemini-api/docs/troubleshooting).

Current local `GEMINI_MODEL` selects `gemini-3.6-flash`; the code default remains
`gemini-3.5-flash`. This sprint used the existing configuration and did not change
it. Prior successful provider checks retain their original scope/date.

## Failure matrix

| Boundary | Evidence and expected behavior |
| --- | --- |
| Missing/malformed/expired auth | SDK/Auth and API tests; reject before provider work, controlled 401. |
| Auth/DB transport unavailable | Controlled safe 503; never manufacture a user identity or DB success. |
| A/B guessed IDs or forged ownership | API/real PostgreSQL tests, installed rollback probes and synthetic browser; 404/no rows or denied write. Real JWT sessions still pending. |
| Provider missing/failing/429/503/truncated/empty/blocked | Safe error/failed persisted outcome where possible; never completed success; no hidden SDK retry. Actual diagnostic 429 recorded separately. |
| Unknown/malformed tool or invalid coordinates/time/segment | Rejected before execution; no fabricated result. |
| Congestion model/category/label/mapping failure | Valid recorded-window fallback, otherwise labelled empty/no-match default; DB failure stays unavailable. |
| Congestion malformed/overlapping data | Safe 503; no arbitrary recommendation. |
| Tool timeout/unavailable | Error output saved; no result card; explanatory answer can still complete. |
| Disconnect/stop or old-chat late response | Interrupted/bounded cleanup, stale-view isolation, explicit recovery. |
| Duplicate retry/active conflict | Same request ID replay without execution; active 409, no duplicate turn. |
| Final save failure | No completed persistence acknowledgment; frontend remains uncertain and offers recovery. |
| Missing planning input/domain guardrail | Schemas/prompt inspected and invalid-input tests passed; live wording/adherence not established because attempted responses failed. |

## Deployment and remaining live acceptance

No new migration is required. Existing recorded migrations and the older remote
`20260815133157` record stay intact; do not run the reset schema or fabricate
missing migration history. See [migration guidance](../../../supabase/README.md).

For an authorized release: verify project/environment and migration/RPC state →
install the pinned backend environment and verify artifact compatibility →
deploy/restart backend → deploy matching frontend public API/Supabase settings →
run signed-in smoke/A/B checks. Roll back application artifacts if needed while
retaining saved history. This run restored local services only.

Remaining live checklist:

1. Use two real signed-in test sessions, without putting JWTs/credentials in
   screenshots, URLs, evidence, or Git. Current run has no configured test JWTs.
2. For A: new chat → tool answer → refresh/reopen → open details → follow-up →
   logout/login → reopen. Verify persisted text/results and no inspection refetch.
3. For B: list/read/update/archive/append A's guessed UUIDs must reveal nothing
   and reject writes. Repeat direct authenticated REST/RLS with genuine JWTs.
4. When provider capacity is available, rerun completed native multi-tool answer,
   saved-reference follow-up, missing-input clarification and domain guardrail.
   One failed model request is not guardrail success merely because no tool ran.
5. Record sanitized signed-in HTTP/browser evidence and successful latency with
   sample count/environment, then close S3-08/S6-01/live S6-02 acceptance.

The earlier user preference for automated verification was retained; no new
login request, account creation, email, or credential collection was performed.

## Reproduce

Use the [Sprint 5 browser recipe](SPRINT_5_IMPLEMENTATION.md#reproduce) sequentially
against the loopback fixture. The same 35 scenarios were rerun and their current
summaries/screenshots saved under [Sprint 6 evidence](../evidence/sprint-6/README.md).

Backend (start the dedicated loopback PostgreSQL test instance first):

```powershell
$env:ORACLE_TEST_DATABASE_URL = 'host=127.0.0.1 port=55432 dbname=postgres user=oracle_test_admin'
& backend/.venv/Scripts/python.exe -m pytest backend/tests -q --junitxml=docs/oracle/evidence/sprint-6/backend-tests.xml
& backend/.venv/Scripts/python.exe backend/scripts/audit_congestion_model.py --output docs/oracle/evidence/sprint-6/model-audit.json
```

The explicit live provider command consumes quota and is separate from the
automated gate; run only when that live check is wanted and capacity is available:

```powershell
& backend/.venv/Scripts/python.exe backend/scripts/check_oracle_provider_live.py --output docs/oracle/evidence/sprint-6/live-provider.json
```

Do not overwrite dated failure evidence when collecting a later rerun; save a
new dated artifact. Use the [methodology](../ml/CONGESTION_MODEL_VALIDATION.md) and
[BAB III/IV evidence map](../reports/REPORT_EVIDENCE_MAP.md) for report writing.
