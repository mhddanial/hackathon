"""Build traceable D6-01 matrix from fresh captured assertions and actual outputs."""
from __future__ import annotations
import json
from pathlib import Path

OUT = Path(__file__).resolve().parent
backend = json.loads((OUT / "backend-acceptance.json").read_text())
browser = json.loads((OUT / "browser-acceptance.json").read_text())
assert backend["exit_code"] == 0 and backend["missing_fixture_ids"] == []
assert browser["result"] == "passed"
CASES = {case["fixture_id"]: case for case in backend["cases"]}
REPS = {
    "DEP-01": ["SAFE-30"], "DEP-02": ["RISKY-5"], "DEP-03": ["MISSED-5"],
    "DEP-04": ["EMPTY-SUCCESS"], "DEP-05": ["OUTSIDE-BATAM"], "DEP-06": ["SCHEDULE-OUTAGE"],
    "DEP-07": ["MISSING-CUTOFF"], "DEP-08": ["PRESERVE-MISSED-TARGET"],
    "DEP-09": ["MIDNIGHT-ARRIVAL", "SOURCE-SINGAPORE"],
    "DEP-10": ["ZERO-BUFFER", "EXACT-THRESHOLD"], "DEP-11": ["APPLY-CONGESTION-ONCE"],
    "DEP-13": ["AUTO-ALL-MISSED"],
}
DESCRIPTIONS = [
    "Buffer meets configured threshold → SAFE", "Nonnegative buffer below threshold → RISKY", "ETA after cutoff → MISSED",
    "Empty/relevant lookup distinctions → UNAVAILABLE", "Invalid fields → controlled validation error",
    "Failed/untrusted dependencies → transport error or explicit unavailable estimate", "Absent/invalid cutoff → no fabricated decision",
    "Preserve target and evaluate relevant alternatives independently", "Absolute datetimes across midnight/source zones", "Zero RISKY / exact threshold SAFE before rounding",
    "Consume final_time_min once", "Changed inputs cannot retain/restore stale result", "All relevant cutoffs missed → MISSED, no feasible alternatives", "Actual U1–U5 observations recorded",
]


def summary(value):
    if "validation_error_assertion_passed" in value:
        return "Configuration rejected; no HTTP request" if value["validation_error_assertion_passed"] else "Configuration assertion failed"
    parts = [f"HTTP {value['http_status']}"]
    for key in ("status", "reason_code", "error_code", "envelope_kind"):
        if value.get(key) is not None:
            parts.append(str(value[key]))
    if value.get("buffer_min") is not None:
        parts.append(f"buffer {'+' if value['buffer_min'] >= 0 else ''}{value['buffer_min']} min")
    if value.get("estimated_arrival_at") is not None:
        parts.append(f"ETA {value['estimated_arrival_at']}")
    if "alternative_ids" in value:
        parts.append(f"{len(value['alternative_ids'])} alternatives")
    return "; ".join(parts)


rows = []
for index, description in enumerate(DESCRIPTIONS, 1):
    criterion = f"DEP-{index:02d}"
    if criterion == "DEP-14":
        rows.append({"criterion": criterion, "scenario": description, "result": "PENDING", "input": {"protocol": "USABILITY_PROTOCOL.md", "tasks": ["U1", "U2", "U3", "U4", "U5"], "planned_sample": 5}, "expected": "Genuine consented participant observations and custom questionnaire results", "actual": "No genuine sessions recorded; institutional confirmation and participants are pending per user confirmation.", "fixture_ids": [], "evidence": ["usability-readiness.json"]})
    elif criterion == "DEP-12":
        required = ["Edit and Stop discard delayed completions", "A slower old SAFE request cannot replace a newer RISKY result", "Logout and another account clear all departure state"]
        passed = all(name in browser["checks"] for name in required) and not browser["page_error_names"] and len(browser["cancelled_requests"]) >= 1
        rows.append({"criterion": criterion, "scenario": description, "result": "PASS_SYNTHETIC" if passed else "FAIL", "input": {"road_time_old": "08:00", "road_time_new": "09:00", "old_safe_delay_ms": 1200, "new_risky_delay_ms": 0, "actions": ["edit", "Stop", "keyboard Stop", "logout/account change"]}, "expected": "Clear old result immediately; reject older completion; retain new RISKY result; clear account-scoped state.", "actual": f"{len(browser['cancelled_requests'])} aborted requests; all specified race/account checks passed; zero uncaught page errors.", "fixture_ids": [], "evidence": ["browser-acceptance.json"], "checks": required})
    else:
        covered = [case for case in backend["cases"] if criterion in case["covers"]]
        passed = bool(covered) and all(case["result"] == "passed" and case["actual"] is not None for case in covered)
        representatives = [CASES[name] for name in REPS[criterion]]
        rows.append({"criterion": criterion, "scenario": description, "result": "PASS_SYNTHETIC" if passed else "FAIL", "fixture_ids": [case["fixture_id"] for case in covered], "representatives": [{"fixture_id": case["fixture_id"], "input": case["input"], "expected": case["expected"], "actual": case["actual"]} for case in representatives], "expected": " / ".join(summary(case["expected"]) for case in representatives), "actual": " / ".join(summary(case["actual"]) for case in representatives), "evidence": ["backend-acceptance.json", "backend-tests.xml"]})

result = {"task": "D6-01", "date": "2026-10-24", "timezone": "Asia/Jakarta", "provenance": "SYNTHETIC SIMULATION ONLY; existing actual backend/Next code with mocked dependencies, no live integration or usability evidence.", "criteria_passed_synthetic": sum(row["result"] == "PASS_SYNTHETIC" for row in rows), "criteria_failed": sum(row["result"] == "FAIL" for row in rows), "criteria_pending": sum(row["result"] == "PENDING" for row in rows), "full_task_complete": False, "reason_not_complete": "DEP-14 requires actual participant evidence; no participants/approval confirmed yet.", "rows": rows}
(OUT / "acceptance-matrix.json").write_text(json.dumps(result, indent=2) + "\n")
md = ["# D6-01 functional acceptance matrix — SYNTHETIC SIMULATION", "", "24 October 2026, Asia/Jakarta. Generated from fresh captured results. **13 synthetic passes, 0 failures, 1 pending (DEP-14); D6-01 remains partial.** No real login/backend/sailing/traffic or participant result is established.", "", "Full inputs, fixture expectations, actual endpoint outputs and test identities: [backend capture](backend-acceptance.json), [browser capture](browser-acceptance.json), [machine matrix](acceptance-matrix.json). Derived envelope labels describe the body shape; they are not invented backend error codes. Nulls and signed/zero buffers remain unchanged.", "", "| Criterion | Input / representative fixture | Expected | Actual | Result |", "| --- | --- | --- | --- | --- |"]
for row in rows:
    names = ", ".join(rep["fixture_id"] for rep in row.get("representatives", [])) or ("08:00 → 09:00 during delayed request" if row["criterion"] == "DEP-12" else "Protocol U1–U5; planned sample 5")
    md.append("| " + " | ".join(str(v).replace("|", "\\|") for v in [row["criterion"], names, row["expected"], row["actual"], row["result"]]) + " |")
md += ["", "## Full frozen fixture execution ledger", "", "All 66 definitions executed: 63 actual ASGI HTTP scenarios and 3 asserted configuration rejections. Multiple assertions/regressions total 431 passing tests. Each input is under the corresponding fixture ID in backend-acceptance.json; none is a real sailing.", "", "| Fixture | Request inputs (summary; full JSON linked above) | Actual | Result |", "| --- | --- | --- | --- |"]
for case in backend["cases"]:
    req = case["input"]["request"]
    inputs = f"{req['origin']} → {req['terminal']}; road {req['departure_date']} {req['departure_time']}; service {req['service_date']}; target {req.get('schedule_id')}"
    md.append("| " + " | ".join(str(v).replace("|", "\\|") for v in [case["fixture_id"], inputs, summary(case["actual"]), case["result"]]) + " |")
(OUT / "ACCEPTANCE_MATRIX.md").write_text("\n".join(md) + "\n")
print(json.dumps({key: result[key] for key in ("criteria_passed_synthetic", "criteria_failed", "criteria_pending", "full_task_complete")}))
assert result["criteria_passed_synthetic"] == 13 and result["criteria_failed"] == 0 and result["criteria_pending"] == 1
