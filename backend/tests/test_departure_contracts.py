"""Pure v1 schema/config checks against the frozen, synthetic Sprint 1 fixtures."""
from copy import deepcopy
from datetime import datetime
import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from departure_config import DepartureConfig
from schemas.departure_recommendation import (
    Alternative, DepartureRequest, DepartureResult, Origin, RouteInput, ScheduleOccurrence, Selection,
)
from services.departure_recommendation import assess_schedule, calculate_departure

FIXTURES = json.loads((Path(__file__).parent / "fixtures/departure_cases.json").read_text())


def merge(base, overrides):
    result = deepcopy(base)
    for key, value in overrides.items():
        result[key] = merge(result[key], value) if isinstance(value, dict) and isinstance(result.get(key), dict) else deepcopy(value)
    return result


def fixture_input(case):
    return merge(FIXTURES["defaults"], case["overrides"])


def fixture_route(data):
    # The core consumes only final_time_min, never the base duration/multiplier.
    return RouteInput(**{name: data[name] for name in RouteInput.model_fields})


def calculate(data):
    return calculate_departure(
        DepartureRequest(**data["request"]), assess_schedule(data["schedules"][0]),
        fixture_route(data["route"]), DepartureConfig(**data["config"]),
        calculated_at=datetime.fromisoformat(data["clock"]),
    )


@pytest.mark.parametrize("case", [c for c in FIXTURES["cases"] if c["stage"] == "request"], ids=lambda c: c["id"])
def test_request_fixture_rejected(case):
    with pytest.raises(ValidationError):
        DepartureRequest(**fixture_input(case)["request"])


@pytest.mark.parametrize("case", [c for c in FIXTURES["cases"] if c["stage"] == "configuration"], ids=lambda c: c["id"])
def test_configuration_fixture_rejected(case):
    with pytest.raises(ValidationError):
        DepartureConfig(**fixture_input(case)["config"])


@pytest.mark.parametrize("case", [c for c in FIXTURES["cases"] if c["stage"] == "dependency" and "route" in c["overrides"]], ids=lambda c: c["id"])
def test_invalid_dependency_duration_rejected_before_calculation(case):
    # Validation only: the 503 transport mapping belongs to Sprint 3.
    with pytest.raises(ValidationError):
        fixture_route(fixture_input(case)["route"])


@pytest.mark.parametrize("field", ["safety_buffer_min", "schedule_max_age_min"])
@pytest.mark.parametrize("value", [True, False, "15", float("nan"), float("inf"), -float("inf"), 0, -0.1])
def test_config_requires_finite_positive_numeric_minutes(field, value):
    with pytest.raises(ValidationError):
        DepartureConfig(**{field: value})


def test_config_environment_is_explicit_and_does_not_load_dotenv(monkeypatch):
    import dotenv
    monkeypatch.setattr(dotenv, "load_dotenv", lambda *a, **k: pytest.fail("Must not read dotenv"))
    assert DepartureConfig.from_environment({}) == DepartureConfig()
    assert DepartureConfig.from_environment({"DEPARTURE_SAFETY_BUFFER_MIN": "2.5"}).safety_buffer_min == 2.5
    for value in ("NaN", "Infinity", "0", "-1", "true", ""):
        with pytest.raises(ValueError):
            DepartureConfig.from_environment({"DEPARTURE_SAFETY_BUFFER_MIN": value})


@pytest.mark.parametrize("lat,lng", [(True, 104), ("1.1", 104), (1.1, "104"), (float("nan"), 104), (1.1, float("inf")), (0.699, 104), (1.251, 104), (1, 103.799), (1, 104.301)])
def test_coordinate_types_and_coverage(lat, lng):
    with pytest.raises(ValidationError):
        Origin(lat=lat, lng=lng)


@pytest.mark.parametrize("overrides", [
    {"departure_date": None}, {"departure_date": "20261023"}, {"departure_time": "8:00"},
    {"departure_time": "08:00:00"}, {"departure_time": "8 AM"}, {"departure_time": "08:00 WIB"},
    {"schedule_id": "00000000000040008000000000000001"},
    {"schedule_id": "AAAAAAAA-0000-4000-8000-000000000001"},
    {"origin_name": " "}, {"ferry_destination": " "}, {"service_kind": "truck"},
    {"simulation": True}, {"destination": {"lat": 1, "lng": 104}},
])
def test_strict_request_contract(overrides):
    with pytest.raises(ValidationError):
        DepartureRequest(**{**FIXTURES["defaults"]["request"], **overrides})


def test_request_normalizes_strings_derives_day_and_reuses_catalog():
    request = DepartureRequest(**{**FIXTURES["defaults"]["request"], "day_type": None,
        "origin_name": "  Batamindo  ", "ferry_destination": "  Fixture   Singapore "})
    assert request.day_type == "weekday"
    assert request.origin_name == "Batamindo" and request.ferry_destination == "Fixture Singapore"
    assert request.planned_departure_at.isoformat() == "2026-10-23T08:00:00+07:00"
    for terminal, catalog_id in (("batu_ampar", "batu_ampar_port"), ("batam_center", "batam_center_terminal"), ("sekupang", "sekupang_terminal")):
        assert DepartureRequest(**{**request.model_dump(), "terminal": terminal}).terminal_point["id"] == catalog_id


def test_result_serialization_preserves_contract_and_rejects_invalid_states():
    result = calculate(deepcopy(FIXTURES["defaults"]))
    assert DepartureResult.model_validate_json(result.model_dump_json()) == result
    dumped = result.model_dump(mode="json")
    assert dumped["calculated_at"].endswith("+07:00")
    assert dumped["plan"]["day_type"] == "weekday"
    assert set(dumped["sources"]) == {"schedule", "route", "congestion", "cutoff"}
    for overrides in ({"status": "UNAVAILABLE"}, {"status": "RISKY"}, {"buffer_min": None},
                      {"reason_code": "UNKNOWN"}, {"travel_time_min": True}, {"extra": 1}):
        with pytest.raises(ValidationError):
            DepartureResult(**{**result.model_dump(), **overrides})


def test_occurrence_cannot_claim_conflicting_identity_or_instants():
    occurrence = assess_schedule(FIXTURES["defaults"]["schedules"][0]).schedule
    assert isinstance(occurrence, ScheduleOccurrence)
    for overrides in ({"occurrence_id": "incorrect"}, {"departure_at": occurrence.cutoff_at},
                      {"source_timezone": "Asia/Singapore"}, {"source_timezone": "Invalid/Zone"}):
        with pytest.raises(ValidationError):
            ScheduleOccurrence(**{**occurrence.model_dump(), **overrides})


def test_selection_counts_are_bounded():
    for examined, excluded in ((0, 1), (102, 0), (1, -1), (True, 0)):
        with pytest.raises(ValidationError):
            Selection(mode="selected", service_date="2026-10-23", examined_count=examined, excluded_count=excluded, candidate_limit=100, truncated=False)


@pytest.mark.parametrize("field", list(DepartureResult.model_fields))
def test_every_successful_response_key_is_required(field):
    payload = calculate(deepcopy(FIXTURES["defaults"])).model_dump()
    del payload[field]
    with pytest.raises(ValidationError):
        DepartureResult(**payload)


def test_result_rejects_arithmetic_or_provenance_changes():
    result = calculate(deepcopy(FIXTURES["defaults"]))
    for overrides in ({"buffer_min": 31}, {"travel_time_min": 29},
                      {"estimated_arrival_at": "2026-10-23T08:31:00+07:00"},
                      {"latest_departure_estimate_at": "2026-10-23T08:16:00+07:00"},
                      {"route_estimate": None}):
        with pytest.raises(ValidationError):
            DepartureResult(**{**result.model_dump(), **overrides})


def test_alternative_model_and_same_plan_threshold_validation():
    result = calculate(deepcopy(FIXTURES["defaults"]))
    raw = result.selected_schedule.model_dump()
    raw["schedule_id"] = "00000000-0000-4000-8000-000000000002"
    raw["occurrence_id"] = f"{raw['schedule_id']}@2026-10-23"
    occurrence = ScheduleOccurrence(**raw)
    alternative = Alternative(schedule=occurrence, status=result.status, reason_code=result.reason_code,
        reason=result.reason, estimated_arrival_at=result.estimated_arrival_at, travel_time_min=result.travel_time_min,
        buffer_min=result.buffer_min, latest_departure_estimate_at=result.latest_departure_estimate_at)
    assert DepartureResult(**{**result.model_dump(), "alternatives": [alternative]}).alternatives == [alternative]
    for overrides in ({"buffer_min": -1}, {"status": "MISSED"}, {"reason_code": "BELOW_SAFETY_BUFFER"}):
        with pytest.raises(ValidationError):
            Alternative(**{**alternative.model_dump(), **overrides})
    with pytest.raises(ValidationError):
        DepartureResult(**{**result.model_dump(), "alternatives": [alternative.model_copy(update={"status": "RISKY", "reason_code": "BELOW_SAFETY_BUFFER"})]})
