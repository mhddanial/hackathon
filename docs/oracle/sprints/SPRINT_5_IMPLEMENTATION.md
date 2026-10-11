# Sprint 5 — Structured result cards and details

Implemented and verified: 10 October 2026 (Asia/Jakarta), branch `danial`.
S5-01 through S5-05 are complete. Sprint 6 is next; the real signed-in
Supabase HTTP/browser persistence check carried from S3-08 remains pending.

## Result

Oracle now renders validated congestion, schedule, route, and generic results as
independent cards. Each saved result opens an accessible detail dialog showing
its source, data status, limitations, and available timestamps. Reopening history
or refreshing restores those cards from saved metadata. Inspecting a card does
not fetch data or execute a provider/tool request.

Malformed/unsupported results produce an unavailable count while the saved
answer and valid sibling cards remain readable. Missing optional emissions,
capacity, gate-in, or departure fields remain absent; numeric zero stays visible.
Untrusted result text and generic JSON render as escaped text. Empty schedules
state that availability is unconfirmed. Observation times must be supplied to
claim a timestamp; otherwise freshness is explicitly unverified.

## Implementation

| Task | Delivered behavior |
| --- | --- |
| S5-01 | Shared discriminated TypeScript contract and one runtime validator at SSE/history boundaries; per-item rejection, supported-field projection, finite numeric/time checks, rendering bounds. |
| S5-02 | Multiple congestion/schedule/route/generic previews showing actual supplied fields and source/status. No new departure tool/variant. |
| S5-03 | Reusable detail dialog using existing `@base-ui/react/dialog` and Button. Accessible title/description, keyboard opening, focus containment/return, Escape, backdrop and close buttons, mobile scrolling. |
| S5-04 | Restored history goes through the same validator as streamed results. Details use in-memory saved data and make no request. Existing account/conversation state isolation remains in force. |
| S5-05 | Empty/unsupported/default/partial/failed boundaries, zero values, missing fields, HTML text, provenance and timestamps are covered. Unconfirmed/active turns cannot open details; failed/interrupted saved turns show an incomplete-recommendation warning. |

Primary files:

- `frontend/src/components/oracle/OracleResults.tsx` groups cards and the reusable
  modal without adding another shared UI wrapper.
- `frontend/src/lib/oracle-results.ts` validates independent results and exports
  readable status labels.
- `frontend/src/types/oracle.ts` defines typed variants and unavailable counts.
- `frontend/src/lib/oracle-api.ts`, `oracle-stream.ts`, and `oracle-history.ts`
  sanitize and restore result state; `frontend/src/app/(dashboard)/oracle/page.tsx`
  integrates cards and clears counts on retry.
- `frontend/scripts/check-oracle-results.mjs` and `check-oracle-results-ui.js`
  extend the existing script/CLI verification approach. The loopback browser
  fixture can supply malformed, partial, failed, and provisional results.

Client rendering bounds are 12 results per collection, 16,000 serialized UTF-8
bytes per item, 100 schedule rows, and six nesting levels/1,000 nodes for generic
JSON. The actual schedule tool still returns at most 20 rows. Metadata and
optional ISO timestamps are validated; impossible dates or ambiguous timestamps
do not become freshness claims. Absolute timestamps display in WIB, while
schedule/route clock times explicitly lack service-date/source-timezone context.
Invalid outer collections still fail transport validation.

No backend, database migration, RLS policy, AuthProvider, production credential,
or package dependency changed. No provider quota was consumed by these tests.
Historical `docs/hackathon/` documents remain unchanged. No commit, push, or
application deployment was made during this sprint.

## Verification

| Check | Actual result |
| --- | --- |
| Result contract | **16 passed**: supported variants/statuses, multiple/isolated invalid items, numeric/clock/date validation, empty/partial/zero fields, projection, size/depth/node bounds, safe JSON, matching history/SSE sanitization and restoration. |
| API/history regression | **20 passed**, including auth refresh and account mismatch, safe retries, history ownership/shape/order, pagination restoration, outcomes and UUID selection. |
| SSE regression | **8 passed**, including fragmented/batched UTF-8/CRLF and invalid/oversized frames. |
| Result browser flow | **16 passed** in Chromium: previews, metadata/timestamps, keyboard/focus/close, optional fields, safe text, invalid/default/empty/failed/interrupted results, refresh without execution, conversation isolation, mobile scrolling, provisional-result guard and multiple streamed results. |
| History browser regression | **19 passed** (17 flows plus two edge checks): refresh/reopen/follow-up, pagination/back, archive/restore, failures/retry/switch/stop, synthetic A/B isolation, logout/later login, uppercase URL and UTF-8 punctuation. |
| Static/build | TypeScript, targeted ESLint, production build and whitespace check passed. Existing Next middleware-to-proxy deprecation warning remains. |
| Screenshot review | Desktop 1440×1000 and mobile 390×844 inspected. Mobile dialog fits the viewport and scrolls long tables internally. The time-zone note was moved outside the horizontal table to keep it readable. |
| Normal app smoke | Frontend restored at 3000; backend health and public reference read pass. Anonymous Oracle redirects to login. |

Browser focus checks wait for the primitive's focus management to settle before
asserting containment. Screenshots and machine-readable summaries are in the
[Sprint 5 evidence](../evidence/sprint-5/README.md).

These are real Next/React/Chromium UI checks with loopback synthetic Auth/API
data and simulated accounts. They do not prove real Supabase login/persistence,
live RLS, or Gemini execution. The provider migration's 214 backend tests and
direct live Gemini checks are prior evidence; backend source was unchanged and
that suite was not rerun. Do not combine these scopes into live acceptance.

## Reproduce

From `frontend`:

```powershell
node scripts/check-oracle-results.mjs
node scripts/check-oracle-history.mjs
node scripts/check-oracle-stream.mjs
& .\node_modules\.bin\tsc.cmd --noEmit --incremental false
& .\node_modules\.bin\eslint.cmd 'src/app/(dashboard)/oracle/page.tsx' src/components/oracle/OracleResults.tsx src/lib/oracle-results.ts src/lib/oracle-api.ts src/lib/oracle-history.ts src/lib/oracle-stream.ts src/types/oracle.ts
npm.cmd run build
```

Browser setup follows [Sprint 4](SPRINT_4_IMPLEMENTATION.md#reproduce): start
`frontend/scripts/oracle-ui-fixture.mjs` from the repository root, stop the
checkout's normal Next dev instance, and run Next on 3010 with process-local
synthetic API/Supabase URL `http://127.0.0.1:9010` and key
`synthetic-browser-fixture-key`. Do not edit `.env.local` or reuse real cookies.

From the repository root, after opening Chromium and loading fixture state:

```powershell
npx.cmd --yes --package @playwright/cli playwright-cli -s=oracle-s5 open http://127.0.0.1:3010/login --browser chrome
npx.cmd --yes --package @playwright/cli playwright-cli -s=oracle-s5 state-load output/playwright/oracle-sprint4-a.json
npx.cmd --yes --package @playwright/cli playwright-cli -s=oracle-s5 goto http://127.0.0.1:3010/oracle
npx.cmd --yes --package @playwright/cli playwright-cli -s=oracle-s5 snapshot
npx.cmd --yes --package @playwright/cli playwright-cli -s=oracle-s5 run-code --filename frontend/scripts/check-oracle-results-ui.js
npx.cmd --yes --package @playwright/cli playwright-cli -s=oracle-s5 goto http://127.0.0.1:3010/oracle
npx.cmd --yes --package @playwright/cli playwright-cli -s=oracle-s5 run-code --filename frontend/scripts/check-oracle-ui.js
npx.cmd --yes --package @playwright/cli playwright-cli -s=oracle-s5 run-code --filename frontend/scripts/check-oracle-ui-edge.js
npx.cmd --yes --package @playwright/cli playwright-cli -s=oracle-s5 close
```

Run CLI operations sequentially; the edge script expects the saved Sprint 4 chat
left by the history script. Stop the fixture/3010 instance and restore normal
frontend configuration on 3000 afterward. Fixture session files stay ignored.

## Next: Sprint 6

Proceed with the [integration/ML/evidence backlog](../planning/ORACLE_IMPLEMENTATION_SPRINTS.md#sprint-6--complete-integration-ml-validity-and-report-evidence).
Keep signed-in Supabase/provider persistence and actual model/dataset validity
separate from synthetic UI and earlier database role/claim probes. No new live
acceptance claim is made here.
