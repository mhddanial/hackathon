# Delete Oracle conversations

Implemented 13 October 2026 on `danial`.

Open a saved conversation and select the trash button beside Archive/Restore.
The browser asks to permanently delete the named conversation and all its saved
messages. Cancel sends no request. Confirm removes the conversation, its turns,
tool records, and result data; it cannot be restored. Archive remains available
when history should be retained.

## API and ownership

`DELETE /user/conversations/{conversation_id}` requires the verified Supabase
Bearer session, takes no body, and returns 204 with an empty response. The
request-scoped database client retains the user's JWT. The service filters by
both the verified owner and the conversation UUID; existing SELECT/DELETE RLS
policies provide database enforcement. Foreign, missing, and already-deleted
conversations return the same 404. Anonymous requests return 401, malformed UUIDs
422, recent active-turn conflicts 409, and upstream failures a safe 503.

The existing composite conversation-owner foreign key uses `ON DELETE CASCADE`,
so deleting the parent removes all related message rows atomically. The service
does not issue separate message deletions or use a service-role client. This
follows the documented [Supabase Python deletion contract](https://supabase.com/docs/reference/python/delete).

## Active responses and UI state

Migration `20261013145929_oracle_conversation_delete_guard.sql` is applied to the
hosted project. Its `BEFORE DELETE` trigger uses `SECURITY INVOKER` and an empty
search path. A recent in-progress assistant turn blocks the deletion. DELETE and
the existing turn RPCs lock the same conversation row, serializing turn
reservation/persistence against deletion. The guard uses the same three-minute
stale threshold as the turn lifecycle and allows removal of stale abandoned
turns. Later persistence against a deleted turn returns not found.

The UI disables Delete while streaming, reading history, mutating, resolving an
uncertain request, or displaying a recent active turn. An acknowledged deletion
clears the conversation selection URL, messages, results, and the associated
transient retry cache, then reloads the saved list. Failure preserves the chat
and displays a safe error. Existing epoch/abort guards prevent a late response
from clearing a different conversation. A rejected 401 can refresh once;
network/5xx failures are never automatically retried.

## Verification

- All 300 backend tests passed using real disposable loopback PostgreSQL,
  including owner/foreign/missing IDs, auth, cascade, archived/stale deletion,
  active conflicts, terminal persistence, and safe failures.
- 22 frontend API/history checks passed, including DELETE transport, empty 204,
  session refresh, invalid IDs, and no automatic retry on failure.
- Frontend TypeScript and targeted Oracle page/API lint checks passed.
- Six Chromium/Next.js checks passed for confirmation cancellation, safe request
  failure, confirmed removal and UI reset, deleted bookmarks, archived deletion,
  and active-response protection, using synthetic Auth/API services.
- Seven checks passed against the live Supabase database with existing identities
  and simulated claims. All synthetic conversation/message rows rolled back.
  No user conversations were removed and no login/token exchange was tested.

Detailed scope and browser results are in the
[validation record](../evidence/chat-deletion-20261013/validation.json).
The synthetic browser app omits Google Fonts downloads to avoid a network-only
test startup failure. Application source fonts remain unchanged.

To remove the guard during an application rollback, drop trigger
`oracle_active_delete` on `public.conversations`, then drop function
`public.oracle_guard_active_delete()`. This changes future behavior; it cannot
restore permanently deleted chat data. Keep the guard until the delete UI/API
has been retired.
