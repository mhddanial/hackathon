# Oracle Gemini quota diagnosis

11 October 2026 (Asia/Jakarta), branch `danial`.

The Oracle page displayed "The Oracle turn could not complete. Any streamed
text is provisional." The server caught all runtime failures with that same
message, hiding the provider's error category.

One direct native SDK check, without FastAPI or database writes, confirmed
HTTP 429 `RESOURCE_EXHAUSTED` for the locally configured `gemini-3.6-flash`.
Google reported exhaustion of
`GenerateRequestsPerDayPerProjectPerModel-FreeTier`, quota value **20**, and a
retry delay of **71,431 seconds** (19 hours, 50 minutes, 31 seconds) at the
check. This is the provider's reported delay, not a guarantee of later capacity.
The [sanitized diagnostic](../evidence/gemini-quota-20261011/diagnostic.json)
contains no key, prompt, private response text, or user records.

Google applies limits per project and model; another key for the same project
does not reset them. Review the project's active limits in Google AI Studio.
Wait for the quota reset, or explicitly configure an enabled model with available
quota. No model, credentials, or billing settings were changed during this fix.
See [Google's rate-limit documentation](https://ai.google.dev/gemini-api/docs/rate-limits).

## Implemented fix

The stream now maps trusted SDK status codes to safe quota, provider-access,
model-configuration, or temporary-outage messages. Turn timeouts have a specific
message; other failures keep the generic message. Logging records exception
type and provider status only. Raw exceptions and tracebacks are not logged or
sent to the browser.

Streamed text stays provisional; failed outcomes are saved and replayed without
another provider call. After capacity returns, send a **new turn**. Retrying the
same saved failed request replays its failure by design. Tool rounds can consume
multiple provider requests for one user turn. The SDK still makes one attempt
per request and adds no automatic quota retry.

## Local port and verification

FastAPI was stopped at the user's request. Future local starts must use **8080**:
from `backend/`, run `uvicorn main:app --reload --port 8080`. Frontend defaults,
environment examples, the local frontend environment, the manual auth probe,
and the Docker port fallback now use 8080. Deployment-specific `PORT` remains
supplied by the hosting platform. Historical evidence retains its original ports.

- **27 native SDK/provider tests passed** over mocked HTTP transports, including
  400/401/403/404/429/500/503, timeout, partial text followed by quota failure,
  failed-turn persistence, transport cleanup, and no diagnostic leakage/retries.
- **8 frontend stream checks passed**; TypeScript passed.
- No FastAPI/database server was started for these checks; no listener remained
  on 8000 or 8080. Frontend remained on 3000.

The error handling is verified. A completed live answer remains blocked by the
provider quota, and signed-in browser/history acceptance remains separate.
