# Sprint 0 evidence: D0-03, D0-04, D0-05

Captured 23 October 2026, Asia/Jakarta. This directory contains fresh local evidence, not historical Oracle pass counts. See [the audit](../../sprints/SPRINT_0_AUDIT.md) for the reuse map, risk register, limitations, and Sprint 1 entry gate.

| File | Scope |
| --- | --- |
| [runtime-baseline.json](runtime-baseline.json) | Exact runtime/check commands, working directories, exit codes, sanitized outputs, configuration presence, and missing dependencies. Both requested check commands stopped before assertions; test counts are null. |
| [runtime_probe.py](runtime_probe.py) | Reproducible standard-library version/package/presence probe. No dotenv/application imports or secret-value output. |
| [schedule-source.json](schedule-source.json) | Sanitized 20-row project source worksheet sample, clock conversion, terminals, null/duplicate counts, missing metadata, source hash, and pending live-data status. |
| [schedule-schema.txt](schedule-schema.txt) | Read-only excerpt of repository schedule DDL. Not a live schema or runnable migration. |
| [inspect_schedule_source.py](inspect_schedule_source.py) | Reproducible standard-library reader for the schedule worksheet and DDL excerpt. Writes only evidence files in this directory; never imports the live-data importer or database module. |

Runtime probe commands (exit 0 in all three directories):

```sh
# repository root
python3 docs/departure/evidence/sprint-0/runtime_probe.py
# backend or frontend
python3 ../docs/departure/evidence/sprint-0/runtime_probe.py
```

Existing backend checks, from `backend`:

```sh
PYTHON_DOTENV_DISABLED=1 PYTHONDONTWRITEBYTECODE=1 python3 -m pytest -q -p no:cacheprovider tests/test_route_visualization.py tests/test_route_oracle_parity.py tests/test_congestion.py tests/test_road_names.py
```

Exit 1: Python 3.14.4 has no pytest. No collection/assertions ran. Intended fixture scope: route/date/cargo behavior, Oracle parity, congestion, and road names. No live services used.

Existing frontend helper, from `frontend`:

```sh
node scripts/check-route-integration.mjs
```

Exit 1: TypeScript module unavailable under Node 26.0.0; no assertions ran. Intended scope is helpers and mocked fetch. No browser fixture or live app was started.

Source inspection, from repository root:

```sh
python3 docs/departure/evidence/sprint-0/inspect_schedule_source.py
```

Exit 0. Inspected only `ferry_schedules!A1:H21` and the schedule CREATE TABLE text. No workbook edits; before/after SHA-256 matched. Source clock format is `hh:mm`; fractional-day Excel serials were converted to second-precision strings with storage noise rounded away. No schedule formulas exist on this sheet. The project workbook does not prove that these are real/current sailings or that the live database matches it.

Sanitization: runtime outputs replace repository/home paths with `<repo>`/`<home>`. Configuration values are never emitted. Schedule output retains only reference schedule fields and spreadsheet row numbers, with no other worksheet or workbook-author metadata. No `.env` files were read, dependencies installed, SQL/import scripts executed, live requests/writes made, or deployment performed.

Live schema/sample are **PENDING**: no inherited Supabase URL/anon key or database connector was available. The worksheet has no occurrence dates, recurrence, source timezone, or verified freshness. Source duplicates/null counts apply only to these 20 project records. Repeated terminal IDs are terminal grouping, not schedule identity. Missing metadata stays unavailable until verified or covered by an explicit synthetic policy in Sprint 1.
