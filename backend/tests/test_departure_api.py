"""Selected-sailing HTTP tests with verified-auth and owner-route mocks, no live I/O."""
from copy import deepcopy
from datetime import datetime
from types import SimpleNamespace as NS

import httpx
from fastapi import Depends, FastAPI, Request
from fastapi.testclient import TestClient
import pytest

import auth
import database
from departure_config import DepartureConfig
from routers import departure_recommendation as api, route
from services.departure_dependencies import DepartureDependencies
from services.departure_io import BoundedClient, io_overrides
from test_departure_contracts import FIXTURES, fixture_input

AUTH = {"Authorization": "Bearer fixture-token"}
PATH = "/departure-recommendation"
FEATURES = ["hour", "is_peak", "day_type_weekday", "day_type_weekend", "corridor_type_access_road", "corridor_type_industrial_arterial", "corridor_type_urban_arterial"]


@pytest.fixture
def harness(monkeypatch):
    state = {"data": deepcopy(FIXTURES["defaults"]), "calls": [], "auth": None, "db": None,
             "osrm": None, "corridor": "industrial_arterial", "transports": [], "source": "synthetic_fixture"}
    monkeypatch.setattr(database, "url", "https://example.supabase.co")
    monkeypatch.setattr(database, "key", "fixture-publishable-key")
    monkeypatch.setattr(route, "rf_model", NS(predict=lambda rows: ["high"]))
    monkeypatch.setattr(route, "feature_columns", FEATURES)
    monkeypatch.setattr(route, "level_to_multiplier", {"high": 1.5, "medium": 1.2, "low": 1})

    def handle(request):
        data = state["data"]
        params = dict(request.url.params)
        state["calls"].append({"method": request.method, "path": request.url.path, "params": params,
            "token": request.headers.get("Authorization"), "timeout": request.extensions.get("timeout")})
        assert request.method == "GET", "Departure must never write data"
        if request.url.path == "/auth/v1/user":
            if state["auth"] == "timeout":
                raise httpx.ReadTimeout("private auth diagnostic", request=request)
            if state["auth"] == "malformed":
                return httpx.Response(200, json={"private": "malformed auth response"})
            status = state["auth"] or (200 if request.headers.get("Authorization") == AUTH["Authorization"] else 401)
            if status != 200:
                return httpx.Response(status, json={"code": "bad_jwt", "msg": "private auth diagnostic"})
            return httpx.Response(200, json={"id": "00000000-0000-4000-8000-000000000001", "aud": "authenticated",
                "role": "authenticated", "created_at": "2026-10-23T00:00:00Z", "app_metadata": {}, "user_metadata": {}})
        if request.url.path == "/rest/v1/ferry_schedules":
            if state["db"] == "timeout":
                raise httpx.ReadTimeout("private schedule diagnostic", request=request)
            if state["db"] == "outage":
                return httpx.Response(503, json={"code": "private", "message": "private SQL diagnostic"})
            if state["db"] == "malformed":
                return httpx.Response(200, json={"private": "not a row list"})
            rows = [row for row in data["schedules"] if row.get("id", row.get("schedule_id")) == params.get("id", "").removeprefix("eq.")]
            return httpx.Response(200, json=rows)
        if request.url.path == "/rest/v1/road_segments":
            if state["db"] == "corridor_outage" and "segment_id" in params:
                return httpx.Response(503, json={"code": "private", "message": "private corridor diagnostic"})
            if "segment_id" in params:
                rows = [] if state["corridor"] is None else [{"corridor_type": state["corridor"], "name": "Fixture corridor"}]
            else:
                origin = data["request"]["origin"]
                rows = [{"segment_id": "SEG001", "start_lat": origin["lat"], "end_lat": origin["lat"],
                         "start_lng": origin["lng"], "end_lng": origin["lng"]}]
            return httpx.Response(200, json=rows)
        if request.url.host == "router.project-osrm.org":
            if state["osrm"] == "timeout":
                raise httpx.ReadTimeout("private OSRM diagnostic", request=request)
            if state["osrm"] == "outage":
                return httpx.Response(503, json={"private": "routing diagnostic"})
            if state["osrm"] == "malformed":
                return httpx.Response(200, json={"routes": [{"duration": True}]})
            if data["route"]["routing_source"] == "Haversine Fallback":
                return httpx.Response(200, json={"code": "NoRoute"})
            duration = data["route"]["final_time_min"]
            # Invalid final durations are exercised by injecting owner output below.
            return httpx.Response(200, json={"routes": [{"distance": 5000, "duration": duration / 1.5 * 60,
                "geometry": {"type": "LineString", "coordinates": [[104.0303214, 1.0604795], [104.002488, 1.162951]]}}]})
        pytest.fail("Unexpected dependency path")

    mock = httpx.MockTransport(handle)

    def make_client(budget):
        client = BoundedClient(budget, api.AUTH_SECONDS, transport=mock)
        state["transports"].append(client)
        return client

    monkeypatch.setattr(api, "make_auth_client", make_client)
    app = FastAPI()
    app.include_router(api.router, prefix=PATH)

    def dependencies(request: Request, context=Depends(auth.get_authenticated_context)):
        return DepartureDependencies(context, request.state.departure_budget, source=state["source"], route_transport=mock)

    app.dependency_overrides[api.get_dependencies] = dependencies
    app.dependency_overrides[api.calculation_clock] = lambda: datetime.fromisoformat(state["data"]["clock"])
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client, state, app
    assert all(client.is_closed for client in state["transports"])
    assert io_overrides.get().auth_client is None and io_overrides.get().route_get is None


HTTP_FIXTURES = [case for case in FIXTURES["cases"] if case["stage"] in ("domain", "request", "target", "dependency", "auth")]


@pytest.mark.parametrize("case", HTTP_FIXTURES, ids=lambda case: case["id"])
def test_sprint_one_selected_http_fixtures(harness, monkeypatch, case):
    client, state, app = harness
    data = fixture_input(case)
    state["data"] = data
    app.state.departure_config = DepartureConfig(**data["config"])
    failure = data["failures"]
    state["db"] = failure.get("schedule")
    state["osrm"] = failure.get("route")
    state["auth"] = {"expired": 401, "outage": 503}.get(failure.get("auth"))
    # Inject owner confidence/output limitations; no additional congestion request.
    if data["route"]["congestion_status"] != "synthetic_estimate":
        monkeypatch.setattr(route, "rf_model", None)
    if not data["route"]["context_verified"]:
        state["corridor"] = None
    if case["stage"] == "dependency" and "route" in case["overrides"]:
        original = route.calculate_route
        state["data"]["route"] = {**data["route"], "final_time_min": 30}
        invalid_value = case["overrides"]["route"]["final_time_min"]
        def malformed(request):
            values = original(request)
            values["final_time_min"] = invalid_value
            return values
        monkeypatch.setattr(route, "calculate_route", malformed)
    response = client.post(PATH, json=data["request"], headers=AUTH)
    expected = case["expected"]
    assert response.status_code == expected["http_status"], response.text
    assert "private" not in response.text
    result = response.json()
    if response.status_code == 200:
        assert result["status"] == expected["status"] and result["reason_code"] == expected["reason_code"]
        for field in ("travel_time_min", "estimated_arrival_at", "buffer_min", "latest_departure_estimate_at"):
            value = expected[field]
            assert result[field] == pytest.approx(value, abs=1e-10) if isinstance(value, (int, float)) else result[field] == value
        assert result["selected_schedule"]["schedule_id"] == expected["selected_schedule_id"]
        assert result["alternatives"] == []
    elif expected.get("error_code") not in (None, "VALIDATION_ERROR"):
        assert result["detail"]["code"] == expected["error_code"]
    if response.status_code == 422:
        assert not any(call["path"].startswith("/route/") for call in state["calls"])


@pytest.mark.parametrize("header", [None, "Basic abc", "Bearer", "Bearer invalid"])
def test_authentication_precedes_schedule_and_route_reads(harness, header):
    client, state, _ = harness
    response = client.post(PATH, json=state["data"]["request"], headers={"Authorization": header} if header else {})
    assert response.status_code == 401 and response.headers["www-authenticate"] == "Bearer"
    assert response.json() == {"detail": "Invalid or expired authentication credentials"}
    assert not any(call["path"].startswith("/rest/") for call in state["calls"])


@pytest.mark.parametrize("error", [429, 500, 503, "timeout", "malformed"])
def test_auth_outage_preserves_existing_safe_shape(harness, error):
    client, state, _ = harness
    state["auth"] = error
    response = client.post(PATH, json=state["data"]["request"], headers=AUTH)
    assert response.status_code == 503 and response.headers["retry-after"] == "5"
    assert response.json() == {"detail": "Authentication service is temporarily unavailable"}
    assert not any(call["path"].startswith("/rest/") for call in state["calls"])


@pytest.mark.parametrize("body", ['{"origin":{},"origin":{}}', '{"private":"secret", "safety_buffer_min": NaN}', '[]', '{', 'null', '{"private":"secret"}'.encode("utf-16")])
def test_strict_json_validation_does_not_echo_input(harness, body):
    client, state, _ = harness
    response = client.post(PATH, content=body, headers={**AUTH, "Content-Type": "application/json"})
    assert response.status_code == 422 and not state["calls"]
    assert "secret" not in response.text and "private" not in response.text and "input" not in response.text and "ctx" not in response.text


@pytest.mark.parametrize("target", [None, "omitted"])
def test_selected_only_staging_restriction(harness, target):
    client, state, _ = harness
    body = deepcopy(state["data"]["request"])
    if target == "omitted":
        del body["schedule_id"]
    else:
        body["schedule_id"] = None
    response = client.post(PATH, json=body, headers=AUTH)
    assert response.status_code == 422 and "Sprint 4" in response.text and not state["calls"]


def test_request_and_response_byte_limits(harness, monkeypatch):
    client, state, _ = harness
    response = client.post(PATH, content=b" " * 8193, headers=AUTH)
    assert response.status_code == 413 and response.json()["detail"]["code"] == "REQUEST_TOO_LARGE" and not state["calls"]
    monkeypatch.setattr(api, "RESPONSE_BYTES", 10)
    response = client.post(PATH, json=state["data"]["request"], headers=AUTH)
    assert response.status_code == 503 and response.json()["detail"]["code"] == "RESPONSE_LIMIT"


@pytest.mark.parametrize("dependency,error,code", [("db", "outage", "DEPENDENCY_UNAVAILABLE"), ("db", "timeout", "DEPENDENCY_TIMEOUT"),
    ("db", "malformed", "INVALID_DEPENDENCY_RESPONSE"), ("db", "corridor_outage", "DEPENDENCY_UNAVAILABLE"),
    ("osrm", "outage", "DEPENDENCY_UNAVAILABLE"), ("osrm", "timeout", "DEPENDENCY_TIMEOUT"), ("osrm", "malformed", "INVALID_DEPENDENCY_RESPONSE")])
def test_dependency_failures_cannot_become_successful_fallbacks(harness, dependency, error, code):
    client, state, _ = harness
    state[dependency] = error
    response = client.post(PATH, json=state["data"]["request"], headers=AUTH)
    assert response.status_code == 503 and response.json()["detail"]["code"] == code
    assert set(response.json()) == {"detail"} and "private" not in response.text
    if dependency == "db" and error == "outage":
        assert sum(call["path"] == "/rest/v1/ferry_schedules" for call in state["calls"]) == 1


def test_registered_endpoint_startup_config_and_source_provenance(harness):
    client, state, app = harness
    assert app.state.departure_config == DepartureConfig()
    response = client.post(PATH, json=state["data"]["request"], headers=AUTH)
    payload = response.json()
    assert response.status_code == 200 and payload["status"] == "SAFE"
    assert payload["sources"] == {"schedule": "synthetic_fixture", "route": "OSRM API", "congestion": "synthetic_estimate", "cutoff": "synthetic_fixture"}
    assert payload["data_status"] == "simulation" and payload["route_estimate"]["context_verified"] is True
    assert all(call["token"] == AUTH["Authorization"] for call in state["calls"] if call["path"].startswith("/rest/"))
    for call in state["calls"]:
        cap = 10 if call["path"].startswith("/auth/") else 5 if call["path"].startswith("/rest/") else 4
        assert 0 < call["timeout"]["read"] <= cap
    schedule = next(call for call in state["calls"] if call["path"] == "/rest/v1/ferry_schedules")
    assert schedule["params"]["limit"] == "101" and schedule["params"]["order"] == "id.asc"
    assert len([call for call in state["calls"] if call["path"] == "/rest/v1/road_segments"]) == 2


def test_clock_only_database_row_stays_unavailable_and_is_not_enriched(harness):
    client, state, _ = harness
    request = state["data"]["request"]
    state["source"] = "database"
    state["data"]["schedules"] = [{"id": request["schedule_id"], "terminal_id": "TM001", "terminal": "batu_ampar",
        "destination": "Fixture Singapore", "departure_time": "09:30", "cutoff_time": "09:00", "created_at": "2026-10-23T06:00:00+07:00"}]
    response = client.post(PATH, json=request, headers=AUTH)
    payload = response.json()
    assert response.status_code == 200 and payload["reason_code"] == "MISSING_SERVICE_DATE"
    assert payload["sources"]["schedule"] == "database" and payload["selected_schedule"]["schedule_id"] == request["schedule_id"]
    assert payload["selected_schedule"]["service_date"] is None and payload["selected_schedule"]["verified_at"] is None
    assert payload["buffer_min"] is None and payload["alternatives"] == []


def test_invalid_configuration_prevents_startup(monkeypatch):
    monkeypatch.setenv("DEPARTURE_SAFETY_BUFFER_MIN", "0")
    app = FastAPI()
    app.include_router(api.router, prefix=PATH)
    with pytest.raises(ValueError), TestClient(app):
        pass


def test_main_registers_endpoint_without_replacing_existing_routes():
    import main
    paths = set(main.app.openapi()["paths"])
    assert {PATH, "/route", "/congestion", "/schedules", "/health"} <= paths
    with TestClient(main.app) as client:
        assert client.get("/health").json() == {"status": "ok"}
        assert main.app.state.departure_config == DepartureConfig()
