"""D6-01: capture fresh synthetic fixture inputs and actual ASGI endpoint results.

No app code mutation, dotenv loading, live service access, or credentials in evidence.
Run from repo root with the existing .venv. This is not live acceptance or usability.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import socket
import sys
from typing import Any

os.environ["PYTHON_DOTENV_DISABLED"] = "1"
ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
sys.path[:0] = [str(ROOT / "backend"), str(ROOT / "backend/tests")]


def denied(*args: Any, **kwargs: Any) -> None:
    raise RuntimeError("Network blocked in synthetic Sprint 6 acceptance")


socket.socket.connect = denied
socket.create_connection = denied
import pytest  # noqa: E402

MODULES = [
    "test_departure_alternatives.py", "test_departure_api.py", "test_departure_contracts.py",
    "test_departure_calculation.py", "test_departure_dependencies.py", "test_route_visualization.py",
    "test_route_oracle_parity.py", "test_congestion.py", "test_oracle_auth.py",
]
FIXTURES = json.loads((ROOT / "backend/tests/fixtures/departure_cases.json").read_text())


class Capture:
    def __init__(self) -> None:
        self.cases: dict[str, dict[str, Any]] = {}
        self.tests: dict[str, dict[str, str]] = {}

    def pytest_runtest_call(self, item: Any) -> None:
        case = getattr(getattr(item, "callspec", None), "params", {}).get("case")
        if not isinstance(case, dict):
            return
        is_http = item.originalname in {
            "test_sprint_one_selected_http_fixtures", "test_frozen_selection_fixture_http",
        }
        is_config = item.originalname == "test_configuration_fixture_rejected"
        if not (is_http or is_config):
            return
        from test_departure_contracts import fixture_input
        data = fixture_input(case)
        entry = self.cases[case["id"]] = {
            "fixture_id": case["id"], "covers": case["covers"], "stage": case["stage"],
            "input": data, "expected": case["expected"], "test": item.nodeid,
            "actual": None, "result": "not_completed",
        }
        if is_http:
            client = item.funcargs["harness"][0]
            original_post = client.post

            def post(*args: Any, **kwargs: Any) -> Any:
                response = original_post(*args, **kwargs)
                payload = response.json()
                if response.status_code == 200:
                    entry["actual"] = {
                        "http_status": response.status_code,
                        **{key: payload[key] for key in ("status", "reason_code", "travel_time_min", "estimated_arrival_at", "buffer_min", "latest_departure_estimate_at", "selection", "sources", "data_status")},
                        "selected_schedule_id": payload["selected_schedule"]["schedule_id"] if payload["selected_schedule"] else None,
                        "alternative_ids": [a["schedule"]["schedule_id"] for a in payload["alternatives"]],
                        "alternatives": payload["alternatives"],
                        "warning_codes": [w["code"] for w in payload["warnings"]],
                    }
                else:
                    detail = payload.get("detail")
                    entry["actual"] = {
                        "http_status": response.status_code,
                        "error_code": detail.get("code") if isinstance(detail, dict) else None,
                        "envelope_kind": "departure_detail_object" if isinstance(detail, dict) else "validation_array" if isinstance(detail, list) else "auth_string",
                    }
                return response

            client.post = post

    @pytest.hookimpl(hookwrapper=True)
    def pytest_runtest_makereport(self, item: Any, call: Any) -> Any:
        report = (yield).get_result()
        self.tests.setdefault(item.nodeid, {})[report.when] = report.outcome
        case = getattr(getattr(item, "callspec", None), "params", {}).get("case")
        if report.when == "call" and isinstance(case, dict) and case["id"] in self.cases and self.cases[case["id"]]["test"] == item.nodeid:
            entry = self.cases[case["id"]]
            entry["result"] = report.outcome
            if entry["stage"] == "configuration":
                entry["actual"] = {"validation_error_assertion_passed": report.passed, "http_request_performed": False}


capture = Capture()
args = [str(ROOT / "backend/tests" / name) for name in MODULES] + ["-q", "--tb=short", f"--junitxml={OUT / 'backend-tests.xml'}"]
exit_code = int(pytest.main(args, plugins=[capture]))
counts = {outcome: sum(all(v == "passed" for v in phases.values()) if outcome == "passed" else outcome in phases.values() for phases in capture.tests.values()) for outcome in ("passed", "failed", "skipped")}
expected_ids = {case["id"] for case in FIXTURES["cases"]}
missing = sorted(expected_ids - capture.cases.keys())
result = {
    "task": "D6-01", "date": "2026-10-24", "timezone": "Asia/Jakarta",
    "provenance": "SYNTHETIC SIMULATION: real ASGI endpoint and owner-route code with injected fake auth/database/OSRM/model responses. No live backend, real login/sailing/traffic, or participant observations.",
    "dotenv_disabled": True, "external_connections_blocked": True,
    "python": sys.version.split()[0], "pytest": pytest.__version__,
    "exit_code": exit_code, "test_counts": counts,
    "fixture_definitions": len(expected_ids), "captured_fixtures": len(capture.cases), "missing_fixture_ids": missing,
    "cases": list(capture.cases.values()), "tests": capture.tests,
    "participant_evidence": {"count": 0, "result": "PENDING", "reason": "No genuine sessions or institutional confirmation supplied."},
}
(OUT / "backend-acceptance.json").write_text(json.dumps(result, indent=2, allow_nan=False) + "\n")
print(json.dumps({key: result[key] for key in ("task", "exit_code", "test_counts", "fixture_definitions", "captured_fixtures", "missing_fixture_ids")}))
raise SystemExit(exit_code or (1 if missing else 0))
