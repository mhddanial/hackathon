"""D6-03: measured in-process ASGI timing with mocked dependencies, not live latency."""
from __future__ import annotations
from copy import deepcopy
import json
import math
import os
from pathlib import Path
import platform
import socket
import statistics
import sys
import time

os.environ["PYTHON_DOTENV_DISABLED"] = "1"
ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
sys.path[:0] = [str(ROOT / "backend"), str(ROOT / "backend/tests")]


def denied(*args, **kwargs):
    raise RuntimeError("Network blocked in synthetic latency measurements")


socket.socket.connect = denied
socket.create_connection = denied
from pytest import MonkeyPatch  # noqa: E402
from departure_config import DepartureConfig  # noqa: E402
from test_departure_api import AUTH, PATH, harness  # noqa: E402
from test_departure_contracts import FIXTURES  # noqa: E402

catalog = {row["id"]: row for row in json.loads((ROOT / "backend/data/batam-locations.json").read_text())}
SCENARIOS = [
    ("batamindo_industrial_park", "batu_ampar", 30, "SAFE", 30),
    ("kabil_industrial_estate", "batam_center", 45, "SAFE", 15),
    ("hang_nadim_airport", "sekupang", 60, "RISKY", 0),
]
results = []
for origin_id, terminal, duration, status, buffer in SCENARIOS:
    with MonkeyPatch.context() as patch:
        context = harness.__wrapped__(patch)
        client, state, app = next(context)
        try:
            data = deepcopy(FIXTURES["defaults"])
            point = catalog[origin_id]
            data["request"].update(origin={"lat": point["lat"], "lng": point["lng"]}, origin_name=point["name"], terminal=terminal)
            data["schedules"][0]["terminal"] = terminal
            data["route"]["final_time_min"] = duration
            state["data"] = data
            app.state.departure_config = DepartureConfig(**data["config"])
            samples = []
            for index in range(21):
                start = time.perf_counter_ns()
                response = client.post(PATH, json=data["request"], headers=AUTH)
                elapsed = (time.perf_counter_ns() - start) / 1_000_000
                body = response.json()
                assert response.status_code == 200 and body["status"] == status and body["buffer_min"] == buffer
                samples.append({"sample": index, "condition": "first_request_after_fresh_testclient" if index == 0 else "warm_sequential", "elapsed_ms": elapsed, "http_status": response.status_code, "status": body["status"], "buffer_min": body["buffer_min"]})
            warm = [sample["elapsed_ms"] for sample in samples[1:]]
            failures = []
            for failure in ("outage", "timeout", "malformed"):
                state["db"] = failure
                start = time.perf_counter_ns()
                response = client.post(PATH, json=data["request"], headers=AUTH)
                elapsed = (time.perf_counter_ns() - start) / 1_000_000
                assert response.status_code == 503
                failures.append({"injected_failure": failure, "elapsed_ms": elapsed, "http_status": response.status_code, "error_code": response.json()["detail"]["code"]})
            assert all(call["method"] == "GET" for call in state["calls"])
            results.append({
                "scenario": f"{origin_id}_to_{terminal}", "provenance": "SYNTHETIC SIMULATION: catalog coordinates; invented fixture occurrence/applicability; fixed mock duration and model output; no real sailing/route/traffic claim.",
                "input": data, "samples": samples,
                "summary": {"first_request_ms": samples[0]["elapsed_ms"], "warm_n": len(warm), "warm_min_ms": min(warm), "warm_median_ms": statistics.median(warm), "warm_p95_nearest_rank_ms": sorted(warm)[math.ceil(.95 * len(warm)) - 1], "warm_max_ms": max(warm)},
                "failures_separate_from_success_samples": failures,
                "outbound_operations_mocked_get_only": True,
            })
        finally:
            next(context, None)
result = {
    "task": "D6-03", "date": "2026-10-24", "timezone": "Asia/Jakarta", "result": "passed_synthetic_measurements_only",
    "provenance": "SYNTHETIC SIMULATION. Actual elapsed wall time of in-process TestClient POST /departure-recommendation; fake auth/database/OSRM/model. NOT network endpoint, live dependency, cold process/model startup, production latency, observed traffic or participant evidence.",
    "environment": {"python": platform.python_version(), "os": platform.system(), "machine": platform.machine(), "timer": time.get_clock_info("perf_counter").implementation, "concurrency": 1, "warm_success_samples_per_scenario": 20, "first_request_samples_per_scenario": 1, "failed_samples_per_scenario": 3, "imports_and_testclient_setup_timed": False},
    "scenarios": results,
    "live_latency": {"result": "PENDING", "reason": "User confirmed no approved non-production/live read-only access yet."},
}
(OUT / "synthetic-latency.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps({"result": result["result"], "scenarios": len(results), "success_samples": sum(len(r["samples"]) for r in results), "failures_reported_separately": sum(len(r["failures_separate_from_success_samples"]) for r in results), "summaries": [{"scenario": r["scenario"], **r["summary"]} for r in results]}))
