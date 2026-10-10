# Official Gemini provider migration

Implemented 10 October 2026 (Asia/Jakarta), on `danial`, after Sprint 4.
This is a provider change; Sprint 5 result cards/modal are still next.

## Delivered behavior

Oracle uses Google's official `google-genai==2.29.0` Python SDK to call the
Gemini Developer API directly. It replaces the Lightning endpoint and OpenAI
SDK calls. The local Gemini key was already configured; no key is printed or
copied into frontend configuration. The available model list confirmed
`models/gemini-3.5-flash`; that is the default native model, preserving the
previous model family. `GEMINI_MODEL` can select another enabled native model.

The `idna` pin is aligned to 3.18 to resolve the installed `httpx2` requirement
used by the current Starlette environment. Google SDK/HTTPX constraints remain
compatible; the final dependency check passes.

```dotenv
GEMINI_API_KEY=<google-ai-studio-api-key>
GEMINI_MODEL=gemini-3.5-flash
```

Only `GEMINI_API_KEY` supplies Oracle credentials. Explicit Developer API mode
avoids unrelated Vertex/Google environment settings. Missing configuration
produces the existing safe failed-turn outcome. The backend no longer reads
`LIGHTNING_API_KEY`; its existing local value remains available for rollback.
The audit helper and example environment now identify the Gemini key.

`services/oracle_provider.py` creates one SDK client/native history per active
turn and closes its transports after completion, failure, or cancellation.
`GenerateContentConfig` contains the server system instruction, three native
function declarations derived from the existing Pydantic argument models, AUTO
selection, and disabled automatic function execution. The SDK makes one HTTP
attempt, with a 20-second request timeout. Existing 90-second turn, 15-second
tool, three-round, twelve-call, 2,048-output-token, and 32,000-answer-character
limits remain. Native output, including opaque signatures, is additionally
bounded to 256,000 UTF-8 bytes per turn.

The router streams answer text and validates every complete function call before
execution. It pairs native `FunctionResponse` parts with their original calls,
including optional provider IDs. Missing provider IDs get an internal persisted
UUID; the signed native part is not rewritten. Partial arguments, repeated IDs,
unknown/invalid functions, missing terminal reason, safety rejection, and token
truncation fail safely. Thinking text and signatures are not sent to the browser
or stored in public messages. Native parts, including trailing empty-text
signature parts, remain in exact order for later rounds within that turn.

## History and compatibility

Database rows, result metadata, tool IDs, and completed-retry replay retain their
existing contract. No SQL migration is required. The frontend still receives
`metadata`, `status`, `chunk`, `error`, `result`, and `done`. A completed `done`
still follows the confirmed final save; network/provider/save failures cannot
claim success. Supabase auth and ownership checks run before provider work.

Existing complete, paired history is converted into native user/model text.
Previously recorded tool arguments/results are labeled untrusted reference data
in the associated user turn. They are not resent as synthetic Gemini function
calls without signatures. This supports both older Lightning conversations and
newly stored Gemini conversations without reconstructing private thought state.
Displaying history still reads stored text/results without rerunning tools.

## Verification

- **195 existing backend checks passed again**, using native Gemini fixtures and
  actual disposable loopback PostgreSQL for lifecycle/RLS with simulated claims.
- **19 native SDK wire/lifecycle checks passed**: real Google SDK conversion over
  HTTP mock transports, manual execution, schemas, parallel/optional-ID calls,
  signatures, old-history conversion, terminal/safety failures, no hidden 503
  retry, invalid/partial tools, budgets, configuration, and cleanup.
- Two serializer warnings are expected from intentionally malformed argument
  fixtures in the existing suite. No failure remains.
- Live direct answer passed with the configured Google key/model and native
  function declarations.
- Live ferry-tool request/response and follow-up passed. The tool read public
  Supabase reference data; Gemini used the saved reference context on the
  follow-up with **zero additional tool calls**. First turn 18,235 ms; follow-up
  4,700 ms. Each is one sample, not a performance benchmark.
- Live probes used an in-memory turn store, with no real user login/history
  writes. Signed-in Supabase HTTP/browser persistence remains pending.
- Frontend code and the persisted SSE shape are unchanged by this migration.
  The stream-parser regression checks and final repository/app checks are in
  the [evidence index](../evidence/gemini-provider/README.md).

From the workspace root, with a disposable loopback admin database available:

```powershell
$env:ORACLE_TEST_DATABASE_URL = 'host=127.0.0.1 port=55432 dbname=postgres user=oracle_test_admin'
& .\backend\.venv\Scripts\python.exe -m pytest backend/tests -q
node frontend/scripts/check-oracle-stream.mjs
```

The fixtures create/drop only isolated test databases; never substitute the live
Supabase database URL. Provider tests use synthetic keys/mock transports.
The live probes recorded only outcome/type/count/timing metadata, not credentials,
private thoughts, ferry rows, or user content.

## Rollout and rollback

Install backend requirements, configure the backend Gemini key/model, and restart
the backend so it imports the new provider. Frontend/deployment environment must
not receive the Gemini key. Existing mixed-version frontends keep the same SSE
and persisted history contract; pending/completed request replay stays unchanged.
This run restarted the local backend and retained the frontend on port 3000.
No cloud deployment, Git commit, or push was made.

Before edits, source/tests/current docs were saved under ignored
`backend/.venv/oracle-provider-rollback/`, with `manifest.json` listing exact
files. No credentials were copied there. To roll back locally, drain/stop this
backend, restore only those listed files from the snapshot, ensure the old
OpenAI dependency/Lightning key are available, and restart it. The existing
OpenAI installation/key were retained; no history data needs rollback.
Avoid restoring Git HEAD over this checkout: it would discard earlier local
Sprint 3/4 work. In a deployment, use the actual previous application artifact
and environment instead of this machine-local snapshot.

Official references: [Google's recommended SDK](https://ai.google.dev/gemini-api/docs/libraries),
[Python SDK native streaming/manual function calls](https://googleapis.github.io/python-genai/).
