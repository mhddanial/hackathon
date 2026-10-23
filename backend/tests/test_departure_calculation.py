"""Deterministic single-occurrence arithmetic/confidence; no network or real sailings."""
from copy import deepcopy
from datetime import datetime
import socket

import pytest
from pydantic import ValidationError

from departure_config import DepartureConfig
from schemas.departure_recommendation import DepartureRequest, DepartureResult, ScheduleOccurrence
from services.departure_recommendation import PlanMismatch, assess_schedule, calculate_departure, classify_buffer
from test_departure_contracts import FIXTURES, calculate, fixture_input, fixture_route


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    def denied(*args, **kwargs):
        pytest.fail("Pure calculation tests must never open a network connection")
    monkeypatch.setattr(socket.socket, "connect", denied)
    monkeypatch.setattr(socket, "create_connection", denied)


@pytest.mark.parametrize("case", [c for c in FIXTURES["cases"] if c["stage"] == "domain"], ids=lambda c: c["id"])
def test_sprint_one_domain_fixture(case):
    data = fixture_input(case)
    result = calculate(data)
    expected = case["expected"]
    actual = result.model_dump(mode="json")
    for field in ("status", "reason_code", "travel_time_min", "estimated_arrival_at", "buffer_min", "latest_departure_estimate_at"):
        if isinstance(expected[field], (int, float)):
            assert actual[field] == pytest.approx(expected[field], abs=1e-12)
        else:
            assert actual[field] == expected[field]
    assert actual["selected_schedule"]["schedule_id"] == expected["selected_schedule_id"]
    assert result.alternatives == []
    assert all(code in [w.code for w in result.warnings] for code in expected["required_warning_codes"])
    if result.status == "UNAVAILABLE":
        assert result.data_status == "unavailable"
    else:
        assert result.data_status == "simulation"
        assert isinstance(result.selected_schedule, ScheduleOccurrence)
        assert "BACKWARD_ESTIMATE_FIXED_DURATION" in [w.code for w in result.warnings]
    assert DepartureResult.model_validate_json(result.model_dump_json()) == result


@pytest.mark.parametrize("buffer,status", [(None, "UNAVAILABLE"), (-0.000001, "MISSED"), (0, "RISKY"), (14.999999, "RISKY"), (15, "SAFE"), (15.000001, "SAFE")])
def test_unrounded_classifier_boundaries(buffer, status):
    assert classify_buffer(buffer, DepartureConfig()) == status


@pytest.mark.parametrize("value", [True, "0", float("nan"), float("inf"), -float("inf")])
def test_invalid_buffer_is_not_a_decision(value):
    with pytest.raises(ValidationError):
        classify_buffer(value, DepartureConfig())


def test_already_adjusted_fractional_duration_and_injected_threshold():
    data = deepcopy(FIXTURES["defaults"])
    data["route"].update(final_time_min=30.01, base_time_min=20, congestion_multiplier=9)
    data["config"]["safety_buffer_min"] = 29.99
    result = calculate(data)
    assert result.travel_time_min == 30.01
    assert result.estimated_arrival_at.isoformat() == "2026-10-23T08:30:00.600000+07:00"
    assert result.buffer_min == pytest.approx(29.99, abs=1e-12) and result.status == "SAFE"
    assert result.latest_departure_estimate_at.isoformat() == "2026-10-23T08:00:00+07:00"


@pytest.mark.parametrize("changes,reason", [
    ({"source_departure_at": None}, "MISSING_DEPARTURE"),
    ({"source_departure_at": "bad"}, "INVALID_SCHEDULE"),
    ({"source_cutoff_at": "bad"}, "INVALID_CUTOFF"),
    ({"verified_at": "bad"}, "INVALID_FRESHNESS"),
    ({"verified_at": "2026-10-23T06:00:00"}, "INVALID_FRESHNESS"),
    ({"source_departure_at": "2026-10-23T09:30:00"}, "INVALID_SOURCE_ZONE"),
    ({"source_cutoff_at": "2026-10-23T09:00:00"}, "INVALID_SOURCE_ZONE"),
    ({"service_date": "2026-02-30"}, "INVALID_SCHEDULE"),
    ({"schedule_id": None}, "NO_EVALUABLE_SCHEDULES"),
    ({"source": None}, "NO_EVALUABLE_SCHEDULES"),
])
def test_invalid_or_missing_row_metadata_is_explicitly_unavailable(changes, reason):
    data = deepcopy(FIXTURES["defaults"])
    data["schedules"][0].update(changes)
    result = calculate(data)
    assert result.status == "UNAVAILABLE" and result.reason_code == reason
    assert result.buffer_min is None and result.latest_departure_estimate_at is None


def test_source_zone_conversion_retains_original_timestamps():
    case = next(c for c in FIXTURES["cases"] if c["id"] == "SOURCE-SINGAPORE")
    result = calculate(fixture_input(case))
    schedule = result.selected_schedule
    assert schedule.source_timezone == "Asia/Singapore"
    assert schedule.source_cutoff_at.isoformat() == "2026-10-23T10:00:00+08:00"
    assert schedule.cutoff_at.isoformat() == "2026-10-23T09:00:00+07:00"


@pytest.mark.parametrize("congestion", ["default_fallback", "unavailable", None])
def test_untrusted_congestion_only_retains_separate_route_estimate(congestion):
    data = deepcopy(FIXTURES["defaults"])
    data["route"]["congestion_status"] = congestion
    result = calculate(data)
    assert result.reason_code == "CONGESTION_UNAVAILABLE" and result.status == "UNAVAILABLE"
    assert result.route_estimate.final_time_min == 30
    assert result.route_estimate.estimated_arrival_at.isoformat() == "2026-10-23T08:30:00+07:00"
    assert result.travel_time_min is result.estimated_arrival_at is result.buffer_min is result.latest_departure_estimate_at is None


def test_freshness_priority_and_subminute_limit():
    data = deepcopy(FIXTURES["defaults"])
    data["schedules"][0]["verified_at"] = "2026-10-22T06:59:59.999999+07:00"
    data["route"]["routing_source"] = "Haversine Fallback"
    assert calculate(data).reason_code == "STALE_SCHEDULE"
    data["schedules"][0]["source_cutoff_at"] = None
    assert calculate(data).reason_code == "MISSING_CUTOFF"


@pytest.mark.parametrize("field,value,code", [("destination", "Other destination", "SCHEDULE_MISMATCH"),
    ("allowed_service_kinds", [], "SERVICE_MISMATCH"), ("allowed_service_kinds", ["passenger_hand_carry"], "SERVICE_MISMATCH")])
def test_known_incompatible_occurrence_cannot_generate_recommendation(field, value, code):
    data = deepcopy(FIXTURES["defaults"])
    data["schedules"][0][field] = value
    with pytest.raises(PlanMismatch) as error:
        calculate(data)
    assert error.value.code == code


def test_latest_departure_may_be_in_past_and_requires_recalculation():
    data = deepcopy(FIXTURES["defaults"])
    data["clock"] = "2026-10-23T08:20:00+07:00"
    result = calculate(data)
    assert result.latest_departure_estimate_at < result.calculated_at
    assert {"HISTORICAL_PLAN", "BACKWARD_ESTIMATE_FIXED_DURATION"} <= {w.code for w in result.warnings}
    assert any("recalculate" in text for text in result.assumptions)


def test_missing_inputs_are_unavailable_without_fabricated_zero():
    data = FIXTURES["defaults"]
    result = calculate_departure(DepartureRequest(**data["request"]), None, None, DepartureConfig(),
                                 calculated_at=datetime.fromisoformat(data["clock"]))
    assert result.status == "UNAVAILABLE" and result.reason_code == "NO_EVALUABLE_SCHEDULES"
    assert result.route_estimate is None and result.travel_time_min is None


def test_datetime_and_timedelta_range_overflow_are_unavailable():
    data = deepcopy(FIXTURES["defaults"])
    data["request"].update(departure_date="9999-12-31", departure_time="23:50", service_date="9999-12-31", day_type=None)
    data["clock"] = "9999-12-31T07:00:00+07:00"
    data["schedules"][0].update(service_date="9999-12-31", source_departure_at="9999-12-31T23:59:00+07:00",
        source_cutoff_at="9999-12-31T23:55:00+07:00", verified_at="9999-12-31T06:00:00+07:00")
    result = calculate(data)
    assert result.reason_code == "INVALID_SCHEDULE" and result.route_estimate is None
    data = deepcopy(FIXTURES["defaults"])
    data["config"]["safety_buffer_min"] = 1e300
    result = calculate(data)
    assert result.reason_code == "INVALID_SCHEDULE" and result.latest_departure_estimate_at is None
