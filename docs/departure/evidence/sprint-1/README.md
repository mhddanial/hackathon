# Sprint 1 evidence

23 October 2026, Asia/Jakarta. D1-01–D1-06 design evidence; all fixture values and API examples are synthetic. No application, browser, live dependency, or participant result is claimed. See [Sprint 1 report](../../sprints/SPRINT_1_DESIGN.md).

| File | Purpose |
| --- | --- |
| [verify_design.py](verify_design.py) | Reproducible standard-library arithmetic/expectation checker; no application, dotenv, DB, network, or provider imports |
| [design-validation.json](design-validation.json) | Actual completed command, timestamp, results, categories, coverage and limitations |
| [fixture-review.md](fixture-review.md) | Per-fixture arithmetic/policy trace and expected result; not executed endpoint outputs |

Run from repository root:

```sh
python3 docs/departure/evidence/sprint-1/verify_design.py
```

Inputs: [fixture definitions](../../../../backend/tests/fixtures/departure_cases.json), [expected API examples](../../contracts/DEPARTURE_API_EXAMPLES.json), and local documentation links. Object overrides deep-merge into defaults; arrays/scalars replace; explicit null means unknown. Synthetic UUIDs identify fixtures only. Repository-overflow cases inject the sentinel flag into the fake boundary, not 101 live or generated database rows.

Review scope: authored request validity, ETA/buffer/backward-estimate arithmetic before display rounding, zero/fractional/threshold boundaries, source-zone and midnight conversion, cutoff/freshness/confidence preconditions, controlled errors, bounded alternatives, preserved target, and example field/null consistency. Selection traces are documented; real selection-service behavior will be tested in Sprint 4. DEP-12 requires later browser race tests; DEP-14 requires actual participants under the protocol. These checks are intentionally not counted as application regression passes.

The initial command failed at link validation because the personal context had moved during work; README/plan links were corrected. The subsequent completed run is recorded in `design-validation.json`. The original fixture inputs and existing Sprint 0 evidence remain separate. Missing pytest/TypeScript and live schema/sample acceptance are still open. No secret, token, real user identity, or live sailing is included.
