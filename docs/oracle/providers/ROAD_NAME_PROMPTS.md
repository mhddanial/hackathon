# Oracle road-name prompts

Implemented 13 October 2026 on `danial`.

Use a road name, day type, and hour in the Oracle composer. For example:

> Estimate Yos Sudarso congestion on a weekday at 08:00.

Oracle's Gemini system instruction and congestion tool description share the
catalog in `backend/road_segments.py`, imported by `backend/agent_config.py`. Gemini translates the road name into the
existing segment ID before invoking the validated congestion tool. The example
uses `segment_id="SEG001"`, `day_type="weekday"`, and `hour=8`, with planning time
in Asia/Jakarta. Names can omit the `Jl.`/`Jalan` prefix and parenthetical label;
case differences are accepted by the model instruction.

## Supported roads

These mappings were checked against the live public Supabase `road_segments`
table on 13 October 2026:

| Road name | Internal ID |
| --- | --- |
| Jl. Yos Sudarso (Koridor Utama) | SEG001 |
| Jl. Jendral Sudirman | SEG002 |
| Jl. Ahmad Yani | SEG003 |
| Jl. Brigjen Katamso | SEG004 |
| Jl. Trans Barelang (Segmen 1) | SEG005 |
| Jl. Hang Jebat | SEG006 |

Unknown or ambiguous names should prompt clarification. Missing day type or hour
also requires clarification; a name alone does not authorize guessing the current
time or a weekday. Estimates remain synthetic or recorded project estimates,
with the source limitations attached to the result.

IDs still work in chat and remain required by the direct congestion API, tool
arguments, and stored result contract. Resolution uses the
language model and the configured catalog, rather than a fuzzy search or map
geocoder. If the supported roads change, update the catalog after checking the
reference data.

Readable response names were added on 14 October 2026. `/congestion` includes
`segment_name`, and `/route` includes `matched_segment_name`, alongside the
unchanged IDs. The existing reference queries select `road_segments.name`; the
shared backend catalog supplies a fallback if a label is unavailable. Oracle
passes the names through validated tool output, streamed results, and saved
history. Cards and details display names; the result name takes precedence over
the catalog. The new schema fields are optional to preserve old history, and
the frontend catalog in `frontend/src/lib/road-segments.ts` resolves legacy IDs
without fetching or re-executing tools. The frontend contract check verifies that
both catalogs match. Route names identify the corridor selected for the origin's
congestion estimate, not every road along the route. No schema migration or
model retraining is required.

## Readable-response verification (14 October 2026)

- Focused backend contracts, congestion, route labels, tools, agent, provider,
  and integration selection: 138 passed, 21 opt-in integration tests skipped.
  The seven new name/compatibility checks failed before the implementation.
- Frontend: 17 result-contract, 22 API/history, and eight stream checks passed;
  TypeScript and targeted lint passed.
- Chromium against the local synthetic Auth/API fixture: 17 result-interface
  checks passed, including name overrides, legacy history, previews, route
  details, refresh, and mobile dialogs. Desktop screenshot inspected.
- Live public Supabase reads confirmed all six catalog names. All six direct
  congestion responses and route congestion lookups returned the matching
  readable name; the Oracle congestion adapter retained it.
- No live AI request, authenticated database history write, or production
  deployment was performed. Temporary browser/fixture services were stopped.

## Verification

The native SDK regression sends the natural-name user message, checks that the
road catalog reaches both Gemini's system instruction and function description,
then exercises validation, execution, result events, and the saved completion
using a simulated Gemini function call. This proves the application flow; the
simulated response does not by itself prove live model selection.

Validation on 13 October 2026 passed:

- 110 focused backend tests covering congestion, tool validation, and the native
  Gemini provider flow.
- Frontend TypeScript and targeted Oracle-page lint checks.
- One live request with the locally configured `gemini-2.5-flash` model: the exact
  example selected `get_congestion_level` with `SEG001`, `weekday`, and hour `8`,
  returned a validated synthetic estimate, and completed in an in-memory store.
  The request took approximately 10 seconds. See the
  [live check](../evidence/road-name-prompts-20261013/live-check.json).

The live sample read public Supabase reference data without logging in or writing
conversation history. It verifies this example's model selection and tool flow;
authenticated browser acceptance and universal name-resolution behavior were
not tested.

```powershell
& .\backend\.venv\Scripts\python.exe -m pytest backend/tests/test_oracle_tools.py backend/tests/test_oracle_provider.py backend/tests/test_congestion.py -q
```

The backend must load the updated `agent_config.py` to use the new instruction.
For local development, keep FastAPI on port 8080.
