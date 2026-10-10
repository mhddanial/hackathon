# Sprint 3 — Authenticated agent and persistent streaming

Implemented and verified: 10 October 2026 (Asia/Jakarta), branch `danial`.
S3-01 through S3-07, including S3-06a, are implemented. S3-08 automated checks
passed; its real authenticated browser/provider/tool check remains pending.
The user selected **Finish with automated verification**. This report does not
claim a live provider response or a signed-in browser persistence flow.

## Result

`POST /agent/chat` now verifies the Supabase access token and reserves an owned
user/assistant turn before opening SSE or invoking the provider. It loads bounded
saved context, validates all registered tool arguments, appends tool records,
and commits the answer/results/outcome before emitting completed `done`.
Missing credentials, foreign IDs, conflicting/active turns, and initial database
failures return ordinary HTTP errors before streaming.

The existing Oracle page sends its current session token and a stable request
UUID, reconciles server IDs, handles provisional/failed answers, and retries an
uncertain turn with the same UUID. Enter and click share a busy guard. Account
changes remount/abort scoped chat state; new conversation clears the local view
and starts a new server conversation on the next send. Saved history is not
deleted. Reopening history after refresh remains Sprint 4; cards/modal remain
Sprint 5. Validated results are received/stored but have no card UI yet.

## Implementation

| Boundary | Change |
| --- | --- |
| Atomic persistence | Three invoker RPCs reserve, append tool output, and finish a turn under the caller JWT/RLS. Reservation commits the user/assistant pair together. Terminal text, metadata/results, both message outcomes, and conversation update commit together. |
| Concurrency/retry | Request advisory lock plus owned conversation row lock serialize reservations. A unique tool-call index prevents repeated records. Completed/failed/interrupted IDs replay their saved outcome; a new execution after failure needs a new UUID. Active turns return 409. |
| Recovery/archive | A reservation after three minutes can retire stale active turns as interrupted. Late finish/tool writes fail. Archive returns 409 while a recent turn is active, avoiding an archive/final-save RLS race. |
| Context | Up to 120 completed rows become at most eight complete turns within 24,000 serialized characters. Incomplete/failed or invalid tool pairs are skipped. Only the server supplies the system prompt. |
| Tools | Shared Pydantic argument models generate provider schemas and validate execution. Three allowed tools only; explicit day/time/coordinates, valid segment/hour/terminal/destination, paired ETD/cargo. Invalid/non-object/unknown calls never execute. |
| Provenance | Typed successful outputs supply results. Congestion retains ML/database/default source; defaults remain assumptions. Schedule freshness is unverified. Routes remain estimates and exclude map geometry. Computation timestamps do not become observation timestamps. |
| Streaming | Indexed tool deltas support successive/multiple calls. Existing events remain; typed metadata/results are added. Completed acknowledgment follows a verified save. Missing provider/errors/truncation/empty replies produce safe failed outcomes, never synthetic success. |
| Cancellation | The response explicitly closes its generator on ASGI send failure before releasing the request DB transport. Cancellation makes a shielded, bounded best-effort interrupted save. |
| Frontend | Buffered UTF-8/CRLF parser rejects invalid completion/events and oversized frames. Terminal conversation/turn IDs must match. Uncertain outcomes offer manual same-ID retry; saved failures permit a new turn. |

Provider defaults remain Lightning's OpenAI-compatible endpoint and
`google/gemini-3.5-flash`; no provider/dependency switch was introduced. Tool
adapters reuse the route/congestion owner functions. They correct Oracle-side
schedule capacity/destination handling and pass the requested day/time to routing.
The prompt removes unsupported live-data and assumed departure-saving claims;
actual model adherence remains a live acceptance check.

Limits: message 8,000 characters; answer 32,000; three tool rounds/12 calls;
argument/output 8,000/16,000 bytes; 20 schedule rows; provider 20-second SDK
timeout (connect five seconds, retries zero), 90-second turn budget; each tool
15 seconds; Supabase client calls 10 seconds; RPC lock five seconds; disconnect
cleanup 12 seconds. The frontend request deadline is 120 seconds and frame limit
300,000 characters. Read-only tool threads abandoned on timeout may finish until
their underlying network timeout. A DB outage can leave an active turn for lazy
three-minute recovery; no background recovery job was added.

## Applied database change

`supabase/migrations/20261010105115_oracle_turn_lifecycle.sql` was generated with
the installed CLI, applied once to linked project `rrkafcbuhnnwnduvwluq`, and
recorded with migration repair. Remote history now contains the original
`20260815133157` and the three local Oracle/legacy migrations. The backend URL
and linked project were reconciled before application. No destructive reset or
general `db push` was used.

All three lifecycle functions are `SECURITY INVOKER`, have an empty search path,
and allow authenticated execution only; anonymous execution is revoked. The
archive trigger is also invoker, with direct execution revoked. Existing table
RLS, policies, and API-role table grants match the pre-change snapshot. No
service-role key, account, persistent probe row, or data reset was introduced.
The post-probe conversation/message counts remain zero, matching the baseline.

The security advisor reports only the already recorded leaked-password
protection warning. Its [remediation guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
is retained; this sprint did not change Auth settings. Performance advisor
cleanliness is not claimed.

## Verification

| Check | Actual result and limit |
| --- | --- |
| Backend full suite | **195 passed, zero failed/error/skipped**, 19.642 seconds. Real disposable PostgreSQL with simulated Auth claims; SDK/PostgREST transport and provider stream are mocked. |
| New coverage | 14 turn/context tests, 17 tool validation/provenance tests, 19 streamed agent tests; existing 145 tests still pass. Includes concurrent duplicate reservation, A/B rejection, paired context, active archive, malformed tools, provider/save failure, replay, tool/turn deadlines, generator close and ASGI send disconnect. |
| Installed live RPC/RLS probe | **11 passed**, synthetic rows inside a rolled-back transaction using existing identities and simulated claims. No Auth login or provider invocation. |
| Frontend parser | **8 passed**: batched and byte-fragmented UTF-8/CRLF, invalid terminal persistence/metadata/result/type/JSON, oversized frame. This does not exercise React or a signed-in browser. |
| Frontend checks | TypeScript, targeted ESLint, and production build passed. Existing Next middleware-to-proxy deprecation warning remains. |
| Restarted backend HTTP | Health 200; chat without token 401; chat with invalid token 401. Process health is not valid-user/provider evidence. |
| Live preservation | Existing table RLS/policies/grants equal baseline; RPC privileges and migration history verified; aggregate message/conversation counts unchanged. |

Reproducible local gates (PowerShell; the PostgreSQL loopback server must be
running, otherwise SQL tests explicitly skip):

```powershell
$env:ORACLE_TEST_DATABASE_URL = 'host=127.0.0.1 port=55432 dbname=postgres user=oracle_test_admin'
& .\backend\.venv\Scripts\python.exe -m pytest backend/tests -q --junitxml=docs/oracle/evidence/sprint-3/tests.xml
Set-Location frontend
node scripts/check-oracle-stream.mjs
& .\node_modules\.bin\tsc.cmd --noEmit --incremental false
& .\node_modules\.bin\eslint.cmd 'src/app/(dashboard)/oracle/page.tsx' src/lib/oracle-stream.ts
npm run build
```

See the [evidence index](../evidence/sprint-3/README.md) for sanitized snapshots.
No real API quota was consumed by provider verification. Application changes
remain local; no deployment, Git commit, or push was made during this sprint.
The temporary local PostgreSQL, backend, and frontend verification processes
were stopped after the checks.

## Handoff

Start Sprint 4 with the implemented contract and retry rules. Add authenticated
history helpers, the conversation list, selected-conversation restoration, and
loading of stored server messages/results. Keep stable request IDs and isolate
late responses when switching conversations/accounts. Preserve the separation
of `docs/oracle/` current implementation and `docs/hackathon/` historical files.

Carry forward S3-08's signed-in provider/tool check, then test refresh → reopen
→ follow-up → switch → logout/login. The whole feature is complete only after
history/result UI and actual two-user browser/provider acceptance are verified.
