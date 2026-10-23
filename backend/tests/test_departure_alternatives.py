"""Frozen selection fixtures, candidate-specific arithmetic and bounded HTTP integration."""
from copy import deepcopy
from datetime import datetime, timedelta
from itertools import permutations
import json
from pathlib import Path

import pytest

from departure_config import DepartureConfig
from schemas.departure_recommendation import CandidateBatch, DepartureRequest, DepartureResult
from services.departure_recommendation import collapse_candidates, recommend_from_candidates, schedule_candidate
from test_departure_api import AUTH, PATH, harness
from test_departure_contracts import FIXTURES, fixture_input, fixture_route

SELECTION_CASES = [case for case in FIXTURES["cases"] if case["stage"] in ("selection", "repository_contract")]
EXAMPLES = json.loads((Path(__file__).resolve().parents[2] / "docs/departure/contracts/DEPARTURE_API_EXAMPLES.json").read_text())["examples"]


@pytest.mark.parametrize("example", [item for item in EXAMPLES if item["http_status"] == 200], ids=lambda item: item["id"])
def test_frozen_success_examples_validate_without_contract_edits(example):
    DepartureResult.model_validate(example["response"])


def pure(data):
    plan = DepartureRequest(**data["request"])
    rows = [schedule_candidate(row) for row in data["schedules"]]
    selected = None
    warnings = []
    if plan.schedule_id is not None:
        target_rows = [row for row in rows if row.assessment.schedule.schedule_id == plan.schedule_id]
        if data["retrieval"]["truncated"] and not target_rows:
            # Repository-contract fixtures inject only sentinel state, not target data.
            # The independently injected target is the explicit synthetic default.
            target_rows = [schedule_candidate(FIXTURES["defaults"]["schedules"][0])]
        targets, warnings = collapse_candidates(target_rows)
        assert targets, "Selected fixture must independently provide its target"
        selected = targets[0]
        rows = [row for row in rows if row.assessment.schedule.schedule_id != plan.schedule_id]
    return recommend_from_candidates(plan, CandidateBatch(candidates=rows, truncated=data["retrieval"]["truncated"], source="synthetic_fixture"),
        fixture_route(data["route"]), DepartureConfig(**data["config"]), calculated_at=datetime.fromisoformat(data["clock"]),
        selected=selected, warnings=warnings)


def assert_expected(payload, expected):
    assert payload["status"] == expected["status"] and payload["reason_code"] == expected["reason_code"]
    for field in ("travel_time_min", "estimated_arrival_at", "buffer_min", "latest_departure_estimate_at"):
        value = expected[field]
        assert payload[field] == pytest.approx(value, abs=1e-10) if isinstance(value, (int, float)) else payload[field] == value
    selected = payload["selected_schedule"]
    assert (selected["schedule_id"] if selected else None) == expected["selected_schedule_id"]
    assert [item["schedule"]["schedule_id"] for item in payload["alternatives"]] == expected["alternative_ids"]
    assert set(expected["required_warning_codes"]) <= {warning["code"] for warning in payload["warnings"]}
    DepartureResult.model_validate(payload)


@pytest.mark.parametrize("case", SELECTION_CASES, ids=lambda case: case["id"])
def test_frozen_selection_fixture_pure(case):
    assert_expected(pure(fixture_input(case)).model_dump(mode="json"), case["expected"])


def generated_rows(count, start=1):
    rows = []
    for index in range(start, start + count):
        row = deepcopy(FIXTURES["defaults"]["schedules"][0])
        row["schedule_id"] = f"00000000-0000-4000-8000-{index:012d}"
        departure = datetime.fromisoformat(row["source_departure_at"]) + timedelta(minutes=index)
        row["source_departure_at"] = departure.isoformat()
        row["source_cutoff_at"] = (departure - timedelta(minutes=30)).isoformat()
        rows.append(row)
    return rows


@pytest.mark.parametrize("case", SELECTION_CASES, ids=lambda case: case["id"])
def test_frozen_selection_fixture_http(harness, case):
    client, state, _ = harness
    data = fixture_input(case)
    state["data"] = data
    if case["stage"] == "repository_contract":
        # Real adapter cap/sentinel behavior, using generated labeled synthetic rows.
        state["candidate_rows"] = generated_rows(101, start=2)
        if data["request"]["schedule_id"] is not None:
            state["selected_rows"] = deepcopy(FIXTURES["defaults"]["schedules"])
    response = client.post(PATH, json=data["request"], headers=AUTH)
    assert response.status_code == 200, response.text
    assert_expected(response.json(), case["expected"])
    route_calls = [call for call in state["calls"] if call["path"].startswith("/route/v1/")]
    assert len(route_calls) <= 1


def test_selection_and_alternative_order_are_independent_of_input_order():
    data = fixture_input(next(case for case in SELECTION_CASES if case["id"] == "AUTO-SAFE-BEFORE-RISKY"))
    third = deepcopy(data["schedules"][1])
    third["schedule_id"] = "00000000-0000-4000-8000-000000000003"
    data["schedules"].append(third)
    baseline = pure(data).model_dump(mode="json")
    for order in permutations(data["schedules"]):
        assert pure({**data, "schedules": list(order)}).model_dump(mode="json") == baseline


@pytest.mark.parametrize("field,value,reason", [("terminal", "batam_center", "SCHEDULE_MISMATCH"),
    ("destination", "Wrong destination", "SCHEDULE_MISMATCH"), ("service_date", "2026-10-24", "SCHEDULE_MISMATCH"),
    ("allowed_service_kinds", [], "SERVICE_MISMATCH"), ("source_timezone", None, "MISSING_SOURCE_ZONE"),
    ("service_date", None, "MISSING_SERVICE_DATE"), ("schedule_id", None, "NO_EVALUABLE_SCHEDULES")])
def test_candidate_exclusions_preserve_missing_versus_known_incompatible_data(field, value, reason):
    data = deepcopy(FIXTURES["defaults"])
    data["request"]["schedule_id"] = None
    data["schedules"][0][field] = value
    result = pure(data)
    assert result.status == "UNAVAILABLE" and result.exclusions[0].reason_code == reason
    assert result.selection.excluded_count == result.selection.examined_count == 1
    assert result.reason_code == ("NO_RELEVANT_SCHEDULES" if reason.endswith("MISMATCH") else "NO_EVALUABLE_SCHEDULES")


def test_all_missed_ties_use_departure_then_uuid():
    data = deepcopy(FIXTURES["defaults"])
    data["request"]["schedule_id"] = None
    rows = generated_rows(3)
    for row in rows:
        row["source_cutoff_at"] = "2026-10-23T08:20:00+07:00"
    rows[2]["source_departure_at"] = rows[0]["source_departure_at"]
    data["schedules"] = list(reversed(rows))
    assert pure(data).selected_schedule.schedule_id == rows[0]["schedule_id"]


def test_exact_zero_and_threshold_in_automatic_choice():
    data = deepcopy(FIXTURES["defaults"])
    data["request"]["schedule_id"] = None
    rows = generated_rows(2)
    rows[0]["source_cutoff_at"] = "2026-10-23T08:30:00+07:00"
    rows[1]["source_cutoff_at"] = "2026-10-23T08:45:00+07:00"
    data["schedules"] = rows
    result = pure(data)
    assert result.status == "SAFE" and result.buffer_min == 15 and result.selected_schedule.schedule_id == rows[1]["schedule_id"]
    assert result.alternatives[0].status == "RISKY" and result.alternatives[0].buffer_min == 0


def test_unknown_main_never_gets_calculated_alternatives_or_substitution():
    data = deepcopy(FIXTURES["defaults"])
    rows = generated_rows(2)
    rows[0]["source_cutoff_at"] = None
    data["schedules"] = rows
    result = pure(data)
    assert result.reason_code == "MISSING_CUTOFF" and result.alternatives == []
    assert result.selected_schedule.schedule_id == data["request"]["schedule_id"]


def test_shared_clock_alone_does_not_warn_physical_duplicate():
    data = deepcopy(FIXTURES["defaults"])
    rows = generated_rows(2)
    rows[1]["source_departure_at"] = rows[0]["source_departure_at"]
    data["schedules"] = rows
    assert "POSSIBLE_DUPLICATE_SAILING" not in {warning.code for warning in pure(data).warnings}


def test_unknown_congestion_excludes_all_automatic_candidates():
    data = deepcopy(FIXTURES["defaults"])
    data["request"]["schedule_id"] = None
    data["route"]["congestion_status"] = "default_fallback"
    result = pure(data)
    assert result.reason_code == "NO_EVALUABLE_SCHEDULES" and result.alternatives == []
    assert result.route_estimate is not None and result.estimated_arrival_at is None
    assert result.exclusions[0].reason_code == "CONGESTION_UNAVAILABLE"


@pytest.mark.parametrize("selected,count,status,truncated,examined", [(False, 100, "SAFE", False, 100),
    (False, 101, "UNAVAILABLE", True, 100), (True, 100, "SAFE", False, 101), (True, 101, "SAFE", True, 101)])
def test_candidate_limits_and_one_route_call(harness, selected, count, status, truncated, examined):
    client, state, _ = harness
    state["data"]["request"]["schedule_id"] = FIXTURES["defaults"]["request"]["schedule_id"] if selected else None
    state["candidate_rows"] = generated_rows(count, start=2)
    response = client.post(PATH, json=state["data"]["request"], headers=AUTH)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == status and body["selection"]["truncated"] == truncated
    assert body["selection"]["examined_count"] == examined
    assert len(body["alternatives"]) == (0 if truncated else 3)
    calls = [call for call in state["calls"] if call["path"] == "/rest/v1/ferry_schedules"]
    assert len(calls) == (2 if selected else 1)
    assert all(call["params"]["limit"] == "101" and call["params"]["order"] == "id.asc" for call in calls)
    assert len([call for call in state["calls"] if call["path"].startswith("/route/v1/")]) == (0 if truncated and not selected else 1)


def test_selecting_an_alternative_preserves_road_plan_and_recalculates(harness):
    client, state, _ = harness
    state["data"]["schedules"] = generated_rows(3)
    state["data"]["request"]["schedule_id"] = None
    first = client.post(PATH, json=state["data"]["request"], headers=AUTH).json()
    choice = first["alternatives"][0]
    changed = {**state["data"]["request"], "schedule_id": choice["schedule"]["schedule_id"]}
    response = client.post(PATH, json=changed, headers=AUTH)
    assert response.status_code == 200
    second = response.json()
    assert second["selected_schedule"] == choice["schedule"] and second["buffer_min"] == choice["buffer_min"]
    assert {k: v for k, v in second["plan"].items() if k != "schedule_id"} == {k: v for k, v in first["plan"].items() if k != "schedule_id"}
    assert second["selection"]["mode"] == "selected"
    assert len([call for call in state["calls"] if call["path"].startswith("/route/v1/")]) == 2


def test_conflicting_automatic_group_is_deterministic_under_permutation():
    data = deepcopy(FIXTURES["defaults"])
    data["request"]["schedule_id"] = None
    rows = generated_rows(2)
    conflicting = deepcopy(rows[0])
    conflicting["source_cutoff_at"] = "2026-10-23T08:35:00+07:00"
    data["schedules"] = [rows[0], conflicting, rows[1]]
    baseline = pure(data).model_dump(mode="json")
    assert baseline["selected_schedule"]["schedule_id"] == rows[1]["schedule_id"]
    assert baseline["exclusions"][0]["reason_code"] == "AMBIGUOUS_SCHEDULE"
    for order in permutations(data["schedules"]):
        assert pure({**data, "schedules": list(order)}).model_dump(mode="json") == baseline


def test_conflicting_invalid_raw_values_do_not_collapse_to_identical_nulls():
    data = deepcopy(FIXTURES["defaults"])
    first = data["schedules"][0]
    first["source_cutoff_at"] = "bad cutoff one"
    second = {**first, "source_cutoff_at": "bad cutoff two"}
    data["schedules"] = [first, second]
    assert pure(data).reason_code == "AMBIGUOUS_SCHEDULE"


def test_explicit_next_day_sailing_is_not_inferred_recurrence():
    case = next(case for case in FIXTURES["cases"] if case["id"] == "MIDNIGHT-ARRIVAL")
    data = fixture_input(case)
    data["request"]["schedule_id"] = None
    assert pure(data).status == "RISKY"
    data["schedules"][0]["service_date"] = None
    result = pure(data)
    assert result.reason_code == "NO_EVALUABLE_SCHEDULES"
    assert result.exclusions[0].reason_code == "MISSING_SERVICE_DATE"


def test_destination_matching_is_normalized_exact_not_fuzzy():
    data = deepcopy(FIXTURES["defaults"])
    data["request"]["schedule_id"] = None
    data["schedules"][0]["destination"] = "  FIXTURE   singapore "
    assert pure(data).status == "SAFE"
    data["schedules"][0]["destination"] = "Singapore"
    assert pure(data).reason_code == "NO_RELEVANT_SCHEDULES"


def test_adopting_latest_departure_recalculates_instead_of_reusing_route(harness):
    client, state, _ = harness
    first = client.post(PATH, json=state["data"]["request"], headers=AUTH).json()
    latest = datetime.fromisoformat(first["latest_departure_estimate_at"])
    changed = {**state["data"]["request"], "departure_date": latest.date().isoformat(), "departure_time": latest.strftime("%H:%M")}
    # Inject the different duration associated with the newly requested traffic time.
    state["data"]["route"]["final_time_min"] = 40
    second = client.post(PATH, json=changed, headers=AUTH).json()
    assert second["plan"]["schedule_id"] == first["plan"]["schedule_id"]
    assert second["travel_time_min"] == 40 and second["buffer_min"] == 5 and second["status"] == "RISKY"
    assert "BACKWARD_ESTIMATE_FIXED_DURATION" in {warning["code"] for warning in second["warnings"]}
    assert len([call for call in state["calls"] if call["path"].startswith("/route/v1/")]) == 2


def test_automatic_exclusion_details_stay_bounded_and_failure_of_candidate_read_is_503(harness):
    client, state, _ = harness
    state["data"]["request"]["schedule_id"] = None
    rows = generated_rows(100)
    for row in rows:
        row["source_cutoff_at"] = None
    state["candidate_rows"] = rows
    response = client.post(PATH, json=state["data"]["request"], headers=AUTH)
    body = response.json()
    assert response.status_code == 200 and body["reason_code"] == "NO_EVALUABLE_SCHEDULES"
    assert len(body["exclusions"]) == body["selection"]["excluded_count"] == 100
    assert len(body["warnings"]) <= 20 and len(response.content) <= 65536
    state["db"] = "outage"
    response = client.post(PATH, json=state["data"]["request"], headers=AUTH)
    assert response.status_code == 503 and response.json()["detail"]["code"] == "DEPENDENCY_UNAVAILABLE"
