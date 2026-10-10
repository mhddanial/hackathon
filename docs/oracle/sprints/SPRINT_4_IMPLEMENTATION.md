# Sprint 4 — Persistent Oracle history interface

Implemented and verified: 10 October 2026 (Asia/Jakarta), branch `danial`.
S4-01 through S4-06 implementation and automated verification are complete.
Real signed-in Supabase HTTP/browser and provider acceptance remains pending,
carried from S3-08 into live integration/Sprint 6. This sprint did not create
real test accounts or consume provider quota.

## Result

The Oracle page now has a separate saved-conversation panel. Users can start a
new chat, reopen stored messages/results, refresh a selected conversation,
paginate history, archive it, and restore it for a follow-up. Selecting a chat
updates the validated UUID in the URL; refresh and browser back/forward reload
its owned server history. New conversation clears the view and creates a server
conversation on the next send; it does not delete old records.

The shared API helper uses the current Supabase session and rejects a session
belonging to a different mounted account. After 401 it refreshes once and repeats
the same request; chat retains its request UUID/body. Network/5xx failures never
automatically resubmit a turn. The backend continues to verify JWT ownership.

## Implementation and scope

| Task | Delivered behavior |
| --- | --- |
| S4-01 | Authenticated helper for conversation list/detail/messages, archive/restore, and chat. Controlled errors, response validation, current-account check, and bounded token refresh. |
| S4-02 | Responsive saved-history panel with empty/loading/error/retry, archived filter, load more, reload, and new conversation controls. Existing application navigation is reused. |
| S4-03 | URL UUID selection, canonical uppercase links, back/forward restoration, server message IDs/statuses/results, and bounded pagination. Tool rows are not displayed as assistant text. |
| S4-04 | Persistent chat uses the selected ID, stable request UUID, provisional text, metadata reconciliation, terminal ID validation, and saved/failed/interrupted/uncertain display. |
| S4-05 | Aborted old requests and view generations isolate late responses. Pending IDs survive switching within the mounted page; logout/account change clears them. Busy guard and stop/retry prevent duplicate submissions. |
| S4-06 | API/history tests and Chromium checks exercise new → send → refresh → reopen → follow-up → switch → logout/login, pagination, archive/restore, failures, and another simulated account. |

Primary code: `frontend/src/app/(dashboard)/oracle/page.tsx`,
`frontend/src/components/oracle/ConversationList.tsx`,
`frontend/src/lib/oracle-api.ts`, `frontend/src/lib/oracle-history.ts`, and
`frontend/src/types/oracle.ts`. The existing stream parser and AuthProvider are
reused. Git ignores explicitly include the new helpers while leaving unrelated
previously ignored files alone.

Conversation pages request 30 records; message pages request 100 ascending rows.
If more messages exist, the page offers Load more messages and blocks new
follow-ups until the latest page has been loaded. History/update requests have
a 30-second browser deadline. Chat retains Sprint 3's 120-second browser deadline
and existing server limits. Result arrays are restored and shown as a count;
per-result runtime validation, cards, and modal belong to Sprint 5.

Pending request bodies/UUIDs remain only in component memory, scoped to the
signed-in user. They survive switching among conversations on that page, not a
full refresh or logout. A lost initial metadata frame can retain the latest
unassigned request under Check unfinished request. Reload restores persisted
server state rather than automatically sending anything. A recent active server
turn blocks a new send and offers message reload; stale recovery remains the
existing three-minute backend rule.

No backend source, SQL migration, production configuration, package dependency,
or AuthProvider change was required. Title editing and hard deletion were not
added to this interface. Historical `docs/hackathon/` files remain unchanged.
Application changes are local; no Git commit, push, or deployment was made.

## Verification

| Check | Actual result |
| --- | --- |
| API/history checks | **20 passed**: current token, bounded pages/cursors, same-body 401 retry, account mismatch, abort, no network/5xx auto-retry, controlled errors, archive, response ownership/shape/order, UUID selection, deduplication, results/status restoration, active/stale outcomes, and tool-row hiding. |
| SSE parser checks | **8 passed**, including byte-fragmented/batched UTF-8/CRLF and invalid/oversized events. |
| Chromium UI flow | **17 passed** with actual Next/React/Supabase SDK and local synthetic Auth/API services. Two simulated accounts, refresh/back, pagination, archive/restore, lost acknowledgment retry, switching/stop, provider/save failure, 401, safe text rendering, pending replay, and logout/login. |
| Browser edge checks | **2 passed**: uppercase bookmarked UUID and correct UTF-8 page punctuation. |
| Static/build | TypeScript, targeted ESLint, and final production build passed. Existing Next middleware-to-proxy deprecation warning remains. |
| Screenshots | Desktop 1440×1000 and mobile 390×844 inspected. Mobile has no horizontal page overflow; history scrolls separately and the page can scroll vertically. |
| Normal app smoke | Real local frontend restored on 3000; backend health 200, public Supabase reference read success, anonymous `/oracle` → 307 `/login`. This is not a signed-in history/provider check. |
| Backend suite | Sprint 3's **195 passing** tests are prior evidence. Backend source was unchanged this sprint and that suite was not rerun. |

Browser verification caught the need to clear earlier active message state after
a confirmed replay. The correction is covered by switching back to a pending
chat, replaying the terminal outcome with the same UUID, and confirming that a
follow-up becomes available.
Screenshot review also corrected garbled punctuation before the final build.
Expected fixture HTTP failures are part of the failure matrix, not evidence of
a real Supabase or provider outage.

The fixture uses an in-memory loopback server, synthetic users/JWTs, and saved
sample answers. It does not call live Supabase, execute database RLS, or invoke
Lightning. Its result is UI/lifecycle evidence, separate from Sprint 3's actual
database probe and the pending real-auth/provider acceptance.

## Reproduce

From `frontend`:

```powershell
node scripts/check-oracle-history.mjs
node scripts/check-oracle-stream.mjs
& .\node_modules\.bin\tsc.cmd --noEmit --incremental false
& .\node_modules\.bin\eslint.cmd 'src/app/(dashboard)/oracle/page.tsx' src/components/oracle/ConversationList.tsx src/lib/oracle-api.ts src/lib/oracle-history.ts src/types/oracle.ts
npm.cmd run build
```

For the synthetic browser pass, stop this checkout's existing Next dev instance
before starting another; Next shares its development lock. Keep the normal
backend separate. In one workspace-root terminal run:

```powershell
node frontend/scripts/oracle-ui-fixture.mjs
```

In a separate `frontend` terminal, use process-local fixture settings:

```powershell
$env:NEXT_PUBLIC_API_URL = 'http://127.0.0.1:9010'
$env:NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:9010'
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-browser-fixture-key'
npm.cmd run dev -- --hostname 127.0.0.1 --port 3010
```

In a third workspace-root terminal:

```powershell
npx.cmd --yes --package @playwright/cli playwright-cli -s=oracle-s4 open http://127.0.0.1:3010/login --browser chrome
npx.cmd --yes --package @playwright/cli playwright-cli -s=oracle-s4 state-load output/playwright/oracle-sprint4-a.json
npx.cmd --yes --package @playwright/cli playwright-cli -s=oracle-s4 goto http://127.0.0.1:3010/oracle
npx.cmd --yes --package @playwright/cli playwright-cli -s=oracle-s4 snapshot
npx.cmd --yes --package @playwright/cli playwright-cli -s=oracle-s4 run-code --filename frontend/scripts/check-oracle-ui.js
npx.cmd --yes --package @playwright/cli playwright-cli -s=oracle-s4 run-code --filename frontend/scripts/check-oracle-ui-edge.js
npx.cmd --yes --package @playwright/cli playwright-cli -s=oracle-s4 close
```

The fixture seeds storage under ignored `output/playwright/`. Start it afresh
for a repeated full pass. Do not copy synthetic cookies into a real browser
profile. Stop the fixture/test frontend afterward and start the normal frontend
in a fresh shell using its existing environment. This run restored the normal
app and left it running for the user.

See the [sanitized evidence](../evidence/sprint-4/README.md). Next is Sprint 5:
validate client result variants, add previews/modal, and restore their visual
details from saved metadata without rerunning tools. Carry real signed-in
Supabase/provider and two-user acceptance into live integration/Sprint 6.
