## Departure Recommendation

- Read `docs/departure/README.md` first, then only the documentation sections needed for the named tasks; do not redo the Sprint 0 audit.
- Work only on the sprint/task IDs the user names; follow the linked sprint plan and acceptance criteria.
- Preserve other owners’ congestion, route, and schedules services; reuse existing time, schema, authentication, and integration helpers.
- Follow `context_improve.md` sections 11 and 17 for calculation context and coding rules; keep backend decisions typed, validated, and testable.
- Calculate `ETA = road departure + final_time_min`; congestion is already applied, so never multiply it again.
- Calculate `buffer = recorded cutoff - ETA` in minutes, using the recorded cutoff rather than an invented margin.
- Classify `buffer < 0` as `MISSED`; `0 <= buffer < safety buffer` as `RISKY`; and `buffer >= safety buffer` as `SAFE`.
- Require a positive configured safety buffer, determine status before display rounding, and preserve zero and negative values.
- Missing required data means `UNAVAILABLE`; never invent values or turn dependency failures into plausible recommendations.
- Use timezone-aware datetimes in `Asia/Jakarta`; convert known source zones and handle midnight/date changes explicitly.
- Never run `backend/database/schema.sql`, read or print `.env` files, deploy, or write live data.
- Never claim untested results or present fixtures as real sailings; distinguish estimates, fallback sources, and actual evidence.
- Follow `frontend/AGENTS.md` before writing frontend code.
- Keep the final report to at most 15 lines: task IDs, files changed, commands and results, and blockers.
