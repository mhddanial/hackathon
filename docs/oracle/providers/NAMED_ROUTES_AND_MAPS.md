# Named routes and saved maps

Implemented 14 October 2026 on `danial`.

Example Oracle prompt:

> Estimate a route for fast freight cargo from Batamindo Industrial Park to Batu Ampar Port on a weekday at 10 AM WIB, with vessel ETD 2024-01-01T12:00:00Z.

The backend resolves names, IDs, and catalog aliases from
`backend/data/batam-locations.json`. The Planner imports the same public catalog.
Supported places are Batu Ampar Port, Sekupang Ferry Terminal, Batam Center
Terminal, Batamindo Industrial Park, Kabil Industrial Estate, and Hang Nadim
Airport. Unknown/ambiguous places return explicit choices to the model without
executing a route or manufacturing a result card. Arbitrary addresses are not
geocoded. Supplied coordinates remain supported within the project's main-island
Batam envelope (latitude 0.7–1.25, longitude 103.8–104.3). This envelope is a
project boundary, not an administrative/geographic polygon.

## Location references

Catalog points were checked through OpenStreetMap/Nominatim on 14 October 2026.
Each catalog row includes its source URL and point kind; access-road and area
centers are representative coordinates, not verified cargo gates. The old Planner
Sekupang coordinates were near Batam Centre and have been corrected.

| Place | Mapped reference |
| --- | --- |
| Batu Ampar Port access | [OSM way 818376558](https://www.openstreetmap.org/way/818376558) |
| Sekupang Ferry Terminal | [OSM node 624972788](https://www.openstreetmap.org/node/624972788) |
| Batam Centre terminal | [OSM node 8396655666](https://www.openstreetmap.org/node/8396655666) |
| Batamindo industrial area | [OSM way 41373817](https://www.openstreetmap.org/way/41373817) |
| Kabil industrial area | [OSM node 760493879](https://www.openstreetmap.org/node/760493879) |
| Hang Nadim access road | [OSM way 60754253](https://www.openstreetmap.org/way/60754253) |

OpenStreetMap data is attributed to its contributors under ODbL. The rendered
map displays OpenStreetMap attribution and uses its standard browser tile layer
following the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/).
The old CARTO endpoint returned API-key-required tiles during visual QA.
There is no runtime Nominatim
dependency. Recheck representative points when extending the catalog.

## Planning inputs

The tool takes required `origin`, `destination`, `time`, and `day_type`. Natural
names and catalog IDs resolve deterministically in the backend. Explicit AM/PM
clocks are normalized to `HH:MM` WIB; cargo aliases normalize to `FAST_FREIGHT`
or `CONTAINER`. Cargo and vessel ETD must be provided together. `departure_date`
is optional `YYYY-MM-DD`, validated against weekday/weekend.

Vessel ETD accepts a WIB clock or an ISO timestamp with `Z`/UTC offset. Timestamps
are converted to Asia/Jakarta without losing their date. The example's
`2024-01-01T12:00:00Z` becomes `2024-01-01T19:00:00+07:00`. When departure_date
is omitted for an ISO ETD, the local ETD date supplies the departure date and
the result discloses the inference; no historical date becomes today's date.
For a different departure date, supply it explicitly.

FAST_FREIGHT has the existing one-hour cutoff; CONTAINER has two hours.
Gate-in and suggested departure retain complete WIB timestamps when dates are
known, including crossings to the previous day. Clock-only inputs that need
a previous-day departure return a request for dates instead of wrapping silently.
The result includes whether the requested departure fits the estimated cutoff.
This remains a single-route estimate with a latest safe departure, not an
alternative-route or departure-window optimization search.

## Saved map contract

`/route` returns named endpoints, coordinates, planning metadata, and a GeoJSON
LineString preview. OSRM uses HTTPS and simplified geometry. Preview coordinates
are validated, rounded to six decimals, and reduced with endpoint-preserving
Ramer–Douglas–Peucker simplification to at most 160 points. Unknown/distant
reference corridors (over 10 km from their midpoint) receive no fabricated ID
or LOW traffic label; congestion is marked unavailable with an explicit assumed
1.0 travel-time multiplier. Database/model fallbacks also disclose uncertainty.

Oracle's validated structured result preserves the map for SSE and saved JSONB
history. Model/tool replies omit the geometry and retain a `map_available` flag;
the separate result includes it. Both remain below the existing 16 KB boundary.
No storage migration is needed, and old results remain valid because new fields
are optional. Backend-only Docker builds include the catalog next to the code;
the Next Turbopack root includes this shared public file.
Tailwind class discovery is scoped to `frontend/src` so the larger project root
does not scan backend/generated files.

The route dialog reuses `MapView`/`MapComponent` with endpoint markers, a fitted
route, map zoom, and mobile resizing. Haversine fallback connections are dashed
and explicitly approximate. Missing saved geometry displays an unavailable-map
message. The shared map no longer draws mock routes. Opening or restoring the
map fetches only basemap tiles, never reruns a route/provider tool. Legacy route
clock fields keep their original date/time-zone caveat.

## Verification

- 162 focused backend tests passed; 21 opt-in local PostgreSQL integration tests
  skipped because `ORACLE_TEST_DATABASE_URL` was not configured.
- 18 result-contract, 22 API/history, and eight stream checks passed.
- TypeScript and targeted lint passed.
- 20 Chromium checks passed against the synthetic Auth/API fixture, including
  named map endpoints, dated planning details, mobile marker visibility, refresh,
  missing geometry, and dashed fallback connections. Desktop/mobile screenshots
  were visually inspected, including a real public OSRM route result.
- One live public route/reference request between Sekupang and Batu Ampar
  returned an OSRM estimate with a validated 30-point map preview.
- One live Gemini `gemini-2.5-flash` request using the example natural-location
  prompt completed with the correct named endpoints, UTC-to-WIB ETD, and a
  validated map result. Storage was in memory; no login/history writes.

The browser check used an isolated frontend copy under ignored
`output/playwright/route-map-check/` to avoid stopping the existing dev server.
To reproduce, copy `frontend/{src,public,package.json,tsconfig.json,next-env.d.ts,postcss.config.mjs}`
and the backend catalog into that test tree, link the existing node_modules,
and set the test Next Turbopack root to this repository. Start
`frontend/scripts/oracle-ui-fixture.mjs` from the repository root and Next on
3010 with process-local API/Supabase URL `http://127.0.0.1:9010` and key
`synthetic-browser-fixture-key`. Load `output/playwright/oracle-sprint4-a.json`
into a fresh Playwright browser and run `frontend/scripts/check-oracle-results-ui.js`.
Fixture files and sessions stay ignored; do not copy synthetic settings into
the normal app environment.
The temporary browser and fixture services were stopped after verification;
the existing development app was left running. The recorded live-result previews
are in ignored `output/playwright/oracle-route-live-{desktop,mobile}.png`.

The already-running backend on 8080 had an older route OpenAPI contract and no
reload flag. Automatic approval review blocked the attempted process restart
before execution (`blocked by policy`); the old backend remains running. Stop
that server in its owning terminal, then run from `backend`:

```powershell
& .\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8080
```

The in-process/live tests above loaded the updated source. The serving backend
contract will update only after that restart.

Authenticated Supabase history writes and production deployment were not tested
in these live samples. Mocked native SDK/store and client history/stream checks
cover map serialization and restore behavior separately.
