"""Read-only adapter, I/O deadline and request isolation checks; no live dependencies."""
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
import socket
import subprocess
import sys
from time import monotonic

import httpcore
from httpcore._backends.sync import SyncStream
import httpx
import pytest

from locations import resolve_location
from routers import route
from services.departure_dependencies import DepartureError, response_rows
from services.departure_io import BoundedClient, DeadlineBackend, DeadlineStream, DeadlineTransport, IOOverrides, RequestBudget, io_overrides
from test_departure_api import AUTH, PATH, harness


@pytest.mark.parametrize("patch,reason", [({"terminal_id": "TM002"}, "INVALID_SCHEDULE"),
    ({"terminal_id": "TM001", "terminal": {}}, "INVALID_SCHEDULE"),
    ({"source_timezone": None}, "MISSING_SOURCE_ZONE"), ({"source_cutoff_at": "invalid"}, "INVALID_CUTOFF"),
    ({"source_departure_at": "2026-10-23T09:30:00"}, "INVALID_SOURCE_ZONE"),
    ({"verified_at": "2026-10-23T06:00:00"}, "INVALID_FRESHNESS")])
def test_schedule_metadata_failures_remain_domain_unavailability(harness, patch, reason):
    client, state, _ = harness
    state["data"]["schedules"][0].update(patch)
    response = client.post(PATH, json=state["data"]["request"], headers=AUTH)
    assert response.status_code == 200 and response.json()["reason_code"] == reason
    assert response.json()["buffer_min"] is None


def test_target_is_read_independently_and_preserved_when_missed(harness):
    client, state, _ = harness
    state["data"]["schedules"][0]["source_cutoff_at"] = "2026-10-23T08:25:00+07:00"
    other = deepcopy(state["data"]["schedules"][0])
    other["schedule_id"] = "00000000-0000-4000-8000-000000000002"
    other["source_cutoff_at"] = "2026-10-23T09:00:00+07:00"
    state["data"]["schedules"].append(other)
    response = client.post(PATH, json=state["data"]["request"], headers=AUTH)
    body = response.json()
    assert response.status_code == 200 and body["status"] == "MISSED" and body["buffer_min"] == -5
    assert body["selected_schedule"]["schedule_id"] == state["data"]["request"]["schedule_id"]
    assert body["selection"]["examined_count"] == 2
    assert [item["schedule"]["schedule_id"] for item in body["alternatives"]] == [other["schedule_id"]]
    schedule = next(call for call in state["calls"] if call["path"] == "/rest/v1/ferry_schedules")
    assert set(schedule["params"]) == {"select", "id", "order", "limit"}


@pytest.mark.parametrize("kind", ["identical", "conflicting", "overflow"])
def test_bounded_duplicate_target_lookup(harness, kind):
    client, state, _ = harness
    first = state["data"]["schedules"][0]
    second = deepcopy(first)
    if kind == "conflicting":
        second["source_cutoff_at"] = "2026-10-23T08:30:00+07:00"
    state["data"]["schedules"] = [first, second] if kind != "overflow" else [deepcopy(first) for _ in range(101)]
    response = client.post(PATH, json=state["data"]["request"], headers=AUTH)
    assert response.status_code == 200
    body = response.json()
    if kind == "identical":
        assert body["status"] == "SAFE" and "DUPLICATE_RECORD_COLLAPSED" in [warning["code"] for warning in body["warnings"]]
    else:
        assert body["status"] == "UNAVAILABLE" and body["reason_code"] == "AMBIGUOUS_SCHEDULE"
        assert body["buffer_min"] is None


@pytest.mark.parametrize("value", [None, {}, [None], ["row"], [{}, {}]])
def test_malformed_or_over_limit_envelope_is_not_empty_success(value):
    from types import SimpleNamespace
    with pytest.raises(DepartureError) as error:
        response_rows(SimpleNamespace(data=value), limit=1)
    assert error.value.code == "INVALID_DEPENDENCY_RESPONSE"


@pytest.mark.parametrize("corridor", [None, "unknown_training_category"])
def test_hidden_default_corridor_does_not_establish_context(harness, corridor):
    client, state, _ = harness
    state["corridor"] = corridor
    body = client.post(PATH, json=state["data"]["request"], headers=AUTH).json()
    assert body["status"] == "UNAVAILABLE" and body["reason_code"] == "ROUTE_CONTEXT_UNKNOWN"
    assert body["route_estimate"]["context_verified"] is False and body["estimated_arrival_at"] is None


def test_missing_multiplier_mapping_does_not_establish_context(harness, monkeypatch):
    client, state, _ = harness
    monkeypatch.setattr(route, "level_to_multiplier", {"low": 1.0})
    body = client.post(PATH, json=state["data"]["request"], headers=AUTH).json()
    assert body["status"] == "UNAVAILABLE" and body["reason_code"] == "ROUTE_CONTEXT_UNKNOWN"


def test_owner_is_called_once_with_route_only_inputs(harness, monkeypatch):
    client, state, _ = harness
    original = route.calculate_route
    calls = []
    def observed(request):
        calls.append(request)
        return original(request)
    monkeypatch.setattr(route, "calculate_route", observed)
    assert client.post(PATH, json=state["data"]["request"], headers=AUTH).status_code == 200
    assert len(calls) == 1
    request = calls[0]
    assert request.cargo_type is None and request.vessel_etd is None
    point = resolve_location("batu_ampar_port")
    assert request.destination.model_dump() == {key: point[key] for key in ("lat", "lng")}
    assert request.time == "08:00" and request.day_type == "weekday" and request.departure_date == "2026-10-23"


def test_invalid_route_plan_echo_is_rejected(harness, monkeypatch):
    client, state, _ = harness
    original = route.calculate_route
    def wrong(request):
        data = original(request)
        data["departure_date"] = "2026-10-24"
        return data
    monkeypatch.setattr(route, "calculate_route", wrong)
    response = client.post(PATH, json=state["data"]["request"], headers=AUTH)
    assert response.status_code == 503 and response.json()["detail"]["code"] == "INVALID_DEPENDENCY_RESPONSE"


def test_date_overflow_is_unavailable_not_wrapped_or_500(harness):
    client, state, _ = harness
    data = state["data"]
    data["request"].update(departure_date="9999-12-31", departure_time="23:50", service_date="9999-12-31", day_type=None)
    data["clock"] = "9999-12-31T07:00:00+07:00"
    data["schedules"][0].update(service_date="9999-12-31", source_departure_at="9999-12-31T23:59:00+07:00",
        source_cutoff_at="9999-12-31T23:55:00+07:00", verified_at="9999-12-31T06:00:00+07:00")
    response = client.post(PATH, json=data["request"], headers=AUTH)
    assert response.status_code == 200 and response.json()["reason_code"] == "INVALID_SCHEDULE"
    assert response.json()["route_estimate"] is None


def test_socket_operations_shrink_to_absolute_deadline_and_do_not_wait_for_outer_coroutine():
    now = [0.0]
    timeouts = []
    class Stream(httpcore.NetworkStream):
        def read(self, max_bytes, timeout=None):
            timeouts.append(timeout)
            now[0] += 1
            return b"x"
    stream = DeadlineStream(Stream(), RequestBudget.start(2.5, clock=lambda: now[0]))
    assert stream.read(1, timeout=10) == b"x"
    assert stream.read(1, timeout=10) == b"x"
    assert stream.read(1, timeout=10) == b"x"
    with pytest.raises(httpx.TimeoutException):
        stream.read(1, timeout=10)
    assert timeouts == [2.5, 1.5, 0.5]


def test_real_blocked_socket_read_has_transport_timeout_without_network():
    # AF_UNIX socketpair stays within this process; no host or live service is used.
    left, right = socket.socketpair()
    try:
        stream = DeadlineStream(SyncStream(left), RequestBudget.start(0.03))
        started = monotonic()
        with pytest.raises(httpcore.ReadTimeout):
            stream.read(1, timeout=10)
        assert monotonic() - started < 1
    finally:
        left.close()
        right.close()


def test_client_caps_each_operation_and_shared_total_budget():
    now = [0.0]
    seen = []
    def handle(request):
        seen.append(request.extensions["timeout"])
        now[0] += 3
        return httpx.Response(200, json={"ok": True})
    budget = RequestBudget.start(5, clock=lambda: now[0])
    with BoundedClient(budget, 4, transport=httpx.MockTransport(handle)) as client:
        assert client.get("https://example.test/").status_code == 200
        with pytest.raises(httpx.TimeoutException):
            client.get("https://example.test/")
    assert [settings["read"] for settings in seen] == [4, 2]


def test_slow_chunks_and_response_size_are_bounded():
    now = [0.0]
    class Chunks(httpx.SyncByteStream):
        def __iter__(self):
            for _ in range(5):
                now[0] += 1
                yield b"x"
    mock = httpx.MockTransport(lambda request: httpx.Response(200, stream=Chunks()))
    with BoundedClient(RequestBudget.start(30, clock=lambda: now[0]), 4, transport=mock) as client:
        with pytest.raises(httpx.TimeoutException):
            client.get("https://example.test/")
    mock = httpx.MockTransport(lambda request: httpx.Response(200, content=b"x" * 1_048_577))
    with BoundedClient(RequestBudget.start(), 4, transport=mock) as client:
        with pytest.raises(httpx.RemoteProtocolError):
            client.get("https://example.test/")


def test_request_local_hooks_do_not_leak_between_threads_or_into_owner_defaults():
    def run(label):
        factory = lambda: label
        token = io_overrides.set(IOOverrides(route_database=factory))
        try:
            return io_overrides.get().route_database()
        finally:
            io_overrides.reset(token)
    with ThreadPoolExecutor(max_workers=2) as executor:
        assert list(executor.map(run, ["first", "second"])) == ["first", "second"]
    assert io_overrides.get() == IOOverrides()


def test_httpcore_transport_reads_real_protocol_without_external_network():
    budget = RequestBudget.start()
    transport = DeadlineTransport(budget)
    transport.pool.close()
    transport.pool = httpcore.ConnectionPool(network_backend=httpcore.MockBackend([
        b'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 11\r\n\r\n{"ok":true}'
    ]), retries=0)
    with BoundedClient(budget, 4, transport=transport) as client:
        response = client.get("https://example.test/")
        assert response.json() == {"ok": True}


@pytest.mark.parametrize("malformed", [b"INVALID\r\n\r\n", b"HTTP/1.1 200 OK\r\nContent-Length: 10\r\n\r\nx"])
def test_httpcore_protocol_errors_map_to_safe_httpx_errors(malformed):
    budget = RequestBudget.start()
    transport = DeadlineTransport(budget)
    transport.pool.close()
    transport.pool = httpcore.ConnectionPool(network_backend=httpcore.MockBackend([malformed]), retries=0)
    with BoundedClient(budget, 4, transport=transport) as client:
        with pytest.raises(httpx.RemoteProtocolError):
            client.get("https://example.test/")


def test_invalid_compression_maps_to_safe_transport_error():
    mock = httpx.MockTransport(lambda request: httpx.Response(200, headers={"Content-Encoding": "gzip"},
        stream=httpx.ByteStream(b"invalid compressed private response")))
    with BoundedClient(RequestBudget.start(), 4, transport=mock) as client:
        with pytest.raises(httpx.RemoteProtocolError, match="Invalid dependency encoding"):
            client.get("https://example.test/")


def test_stuck_dns_resolver_is_killed_at_transport_deadline(monkeypatch):
    real_popen = subprocess.Popen
    children = []
    def stuck(argv, **kwargs):
        child = real_popen([sys.executable, "-I", "-S", "-c", "import time; time.sleep(60)"], **kwargs)
        children.append(child)
        return child
    monkeypatch.setattr(subprocess, "Popen", stuck)
    backend = DeadlineBackend(RequestBudget.start(0.03))
    started = monotonic()
    with pytest.raises(httpcore.ConnectTimeout):
        backend.resolve("example.test", 443, 10)
    assert monotonic() - started < 1
    assert len(children) == 1 and children[0].poll() is not None


def test_numeric_address_bypasses_resolver_and_connect_uses_remaining_budget(monkeypatch):
    seen = []
    def connect(backend, host, port, timeout=None, local_address=None, socket_options=None):
        seen.append((host, port, timeout))
        return httpcore.MockStream([])
    monkeypatch.setattr(httpcore.SyncBackend, "connect_tcp", connect)
    monkeypatch.setattr(subprocess, "Popen", lambda *a, **k: pytest.fail("Numeric address must not start DNS resolution"))
    stream = DeadlineBackend(RequestBudget.start(0.5)).connect_tcp("127.0.0.1", 443, timeout=5)
    assert isinstance(stream, DeadlineStream)
    assert seen[0][:2] == ("127.0.0.1", 443) and 0 < seen[0][2] <= 0.5


def test_deadline_expiring_during_child_startup_also_kills_resolver(monkeypatch):
    real_popen = subprocess.Popen
    children, now = [], [0.0]
    def delayed_start(argv, **kwargs):
        child = real_popen([sys.executable, "-I", "-S", "-c", "import time; time.sleep(60)"], **kwargs)
        children.append(child)
        now[0] = 2
        return child
    monkeypatch.setattr(subprocess, "Popen", delayed_start)
    backend = DeadlineBackend(RequestBudget.start(1, clock=lambda: now[0]))
    with pytest.raises(httpcore.ConnectTimeout):
        backend.resolve("example.test", 443, 10)
    assert children[0].poll() is not None


def test_resolver_success_uses_isolated_python_and_validated_addresses(monkeypatch):
    seen = []
    class Child:
        returncode = 0
        def __init__(self, argv, **kwargs):
            seen.append(argv)
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
        def communicate(self, timeout):
            assert 0 < timeout <= 1
            return b'["192.0.2.1", "192.0.2.1", "2001:db8::1"]', None
    monkeypatch.setattr(subprocess, "Popen", Child)
    backend = DeadlineBackend(RequestBudget.start(1))
    assert backend.resolve("example.test", 443, 10) == ["192.0.2.1", "2001:db8::1"]
    assert seen[0][1:3] == ["-I", "-S"] and seen[0][-2:] == ["example.test", "443"]
