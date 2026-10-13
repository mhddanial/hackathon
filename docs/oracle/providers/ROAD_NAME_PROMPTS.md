# Oracle road-name prompts

Implemented 13 October 2026 on `danial`.

Use a road name, day type, and hour in the Oracle composer. For example:

> Estimate Yos Sudarso congestion on a weekday at 08:00.

Oracle's Gemini system instruction and congestion tool description share the
catalog in `backend/agent_config.py`. Gemini translates the road name into the
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
arguments, and stored result contract. This feature changes model instructions
and the suggested prompt without changing those contracts. Resolution uses the
language model and the configured catalog, rather than a fuzzy search or map
geocoder. If the supported roads change, update the catalog after checking the
reference data.

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
