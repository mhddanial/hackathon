# Legacy table RLS fix — applied and verified

Date: 6 October 2026 (Asia/Jakarta). Branch: `danial`.
Status: applied and verified on the linked `hackathon` Supabase project.
The user confirmed application after reviewing the prepared fix. Application
changes remain local on `danial`; no application deployment or Git push was made.

## Applied changes

| Table | Reads after application | Writes after application |
| --- | --- | --- |
| `road_segments` | Anonymous and authenticated clients | Privileged server/admin only |
| `congestion_multipliers` | Anonymous and authenticated clients | Privileged server/admin only |
| `ferry_schedules` | Anonymous and authenticated clients | Privileged server/admin only |
| `route_query_log` | Authenticated users, own rows only | Privileged server/admin only |

Migration: `supabase/migrations/20261006140252_legacy_table_rls.sql`.
It enables and forces RLS, removes client write privileges (including TRUNCATE),
and adds three public-read policies plus one owner-read policy. Existing
`service_role` privileges are preserved. No security-definer helpers are added.

Route history gains a nullable `user_id` foreign key to `auth.users` and an index
for owner/date ordering. Existing rows retain NULL owners; ownership is never
guessed. A separate ALTER sets `auth.uid()` as the default for future inserts.
Privileged writers must explicitly supply a verified owner's ID. Deleting an
account leaves its historical logs ownerless and inaccessible to API users.
No route-log writer is added in this fix; the existing history reader keeps its
response contract and verified JWT/owner filter. Route history stays distinct
from Oracle conversations.

`backend/scripts/prepare_data.py` now requires `SUPABASE_SERVICE_ROLE_KEY` for
imports instead of the anonymous key. This optional setting is documented in
`backend/.env.example`; no real credential is retrieved, written, or printed.
Ordinary routing/schedule/congestion reads continue using their existing public
client. Future imports require the separate server credential on a trusted
machine. Browser/public environment variables must never contain it.

## Inspection and verification

A read-only live catalog check confirmed four disabled legacy tables, no
policies on those tables, no route-log ownership column, and existing privileged
write grants. Counts: 6 road segments, 25 multipliers, 20 schedules, 0 route logs.
`profiles`, `conversations`, and `chat_messages` already have RLS and are outside
this migration. The migration aborts if unexpected legacy policies appear.

Local PostgreSQL tests execute the actual migration in a disposable loopback
database. They cover public reads, rejection of INSERT/UPDATE/DELETE/TRUNCATE
for both client roles on all four tables, A/B route-history isolation, NULL/no
claim denial, FK validation, preservation of sentinel data and Oracle policies,
privileged imports, account deletion, and safe rejection of policy drift.
Import tests confirm missing/anonymous credentials fail before client creation
and only the separate credential is passed to the SDK. No Excel upload is run.

Actual results are in `docs/oracle/evidence/legacy-rls/tests.xml` and `test-summary.json`.
Live baseline metadata is in `live-before.json`. These local tests simulate
database claims and do not establish real Supabase JWT/browser behavior.
After confirmation, the live catalog matched the reviewed baseline exactly. The
approved migration was applied and registered as `20261006140252`; historical
entries were preserved. All 46 rollback-only live policy checks passed, including
reads, denied writes, user isolation, and anonymous/no-claim/ownerless denial.
The live catalog confirmed unchanged counts, existing Oracle/profile policies,
and service-role grants. Fresh backend smoke checks passed schedule/congestion
reads and absent/invalid-token rejection. Anonymous REST checks are recorded
separately in `live-rest.json`.

Supabase security advisors now show no RLS-disabled-table errors. The existing
[leaked-password-protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
remains; this fix does not alter global Auth settings. Performance advisors also
report existing profile-policy warnings,
two Oracle FK index suggestions, and unused-index notices (including the newly
created route index). These are recorded in `advisors.json`; no indexes were
dropped or unrelated policies changed. This is not a claim that every advisor
category is clear. Future import credentials remain operator configuration.

## Approved application procedure

1. Refresh the read-only catalog and check migration history for drift. Preserve
   historical migration `20260815133157`, whose original local source is missing.
   Do not use general `db push` or the destructive `backend/database/schema.sql`.
2. Apply this exact migration through authenticated `supabase db query --linked
   --file ...`. It runs in one transaction with bounded lock/statement waits.
   SQL errors roll back the complete change; do not blindly retry a committed
   migration. Compare installed metadata before any retry.
3. Verify public reference reads, blocked client writes, and A/B/private/no-owner
   access in rollback-only live probes. Confirm counts and existing Oracle/profile
   policies remain unchanged. Check fresh data-backed backend smoke tests and
   Supabase advisors. Do not insert persistent test accounts or logs.
4. Register the successful migration once and verify cloud migration history.
   Application deployment/commit/push is a separate action.
5. Begin Sprint 2 only when confirmed: conversation storage helpers and owned
   create/list/read/update/archive/delete/message endpoints with pagination/tests.

## Recovery

Before commit, any error rolls back the transaction. After commit, keep RLS and
ownership in place: repair a faulty grant/policy with a reviewed forward migration
or roll back application code while preserving the new column and index. Never
restore anonymous writes or disable RLS to work around an import failure; fix
the import credential instead. No destructive rollback or guessed ownership
backfill is included. The legacy reset script remains a historical bootstrap
artifact and must not be used on the live project.
