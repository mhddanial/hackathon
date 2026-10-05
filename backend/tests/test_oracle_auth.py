from concurrent.futures import ThreadPoolExecutor

import httpx
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

import auth
import database
from routers.user import router as user_router

USER_A = "00000000-0000-4000-8000-000000000001"
USER_B = "00000000-0000-4000-8000-000000000002"
OriginalHttpClient = httpx.Client


@pytest.fixture
def harness(monkeypatch):
    calls, transports = [], []
    state = {"auth_error": None, "database_error": False}

    def handle(request):
        token = request.headers.get("Authorization", "").removeprefix("Bearer ")
        calls.append((request.url.path, token, dict(request.url.params)))
        if request.url.path == "/auth/v1/user":
            error = state["auth_error"]
            if error == "network":
                raise httpx.ConnectError("private upstream diagnostic", request=request)
            if error == "malformed":
                return httpx.Response(200, json={"bad": "private upstream payload"})
            if error:
                return httpx.Response(error, json={"code": "bad_jwt", "msg": "private diagnostic"})
            if token not in ("test-a", "test-b"):
                return httpx.Response(401, json={"code": "bad_jwt", "msg": "invalid token"})
            user_id = USER_A if token == "test-a" else USER_B
            return httpx.Response(200, json={
                "id": user_id, "aud": "authenticated", "role": "authenticated",
                "app_metadata": {}, "user_metadata": {}, "created_at": "2026-10-05T00:00:00Z",
            })
        if state["database_error"]:
            return httpx.Response(400, json={"code": "42703", "message": "private database diagnostic"})
        return httpx.Response(200, json=[{"user_id": USER_A if token == "test-a" else USER_B}])

    def transport_factory(**kwargs):
        client = OriginalHttpClient(transport=httpx.MockTransport(handle), **kwargs)
        transports.append(client)
        return client

    monkeypatch.setattr(database, "url", "https://example.supabase.co")
    monkeypatch.setattr(database, "key", "test-publishable-key")
    monkeypatch.setattr(auth.httpx, "Client", transport_factory)

    app = FastAPI()
    app.include_router(user_router, prefix="/user")

    @app.get("/probe")
    def probe(user=Depends(auth.get_current_user), db=Depends(auth.get_authenticated_database)):
        return {"id": user.id, "rows": db.table("conversations").select("*").execute().data}

    @app.get("/endpoint-failure")
    def endpoint_failure(context=Depends(auth.get_authenticated_context)):
        raise RuntimeError("endpoint failure must not become authentication failure")

    with TestClient(app, raise_server_exceptions=False) as client:
        yield client, calls, transports, state


@pytest.mark.parametrize("header", [None, "Basic abc", "Bearer", "Bearer invalid-token"])
def test_missing_malformed_or_invalid_tokens_are_rejected(harness, header):
    client, calls, transports, _ = harness
    response = client.get("/probe", headers={"Authorization": header} if header else {})
    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"
    assert not any(path.startswith("/rest/") for path, _, _ in calls)
    assert all(transport.is_closed for transport in transports)


@pytest.mark.parametrize("upstream_error", [401, 403, 429, 500, 503, "network", "malformed"])
def test_invalid_credentials_and_service_outages_have_different_errors(harness, upstream_error):
    client, calls, transports, state = harness
    state["auth_error"] = upstream_error
    response = client.get("/probe", headers={"Authorization": "Bearer test-a"})
    assert response.status_code == (401 if upstream_error in (401, 403) else 503)
    assert "private" not in response.text
    assert not any(path.startswith("/rest/") for path, _, _ in calls)
    assert all(transport.is_closed for transport in transports)


def test_verified_jwt_is_forwarded_and_shared_dependencies_verify_once(harness):
    client, calls, transports, _ = harness
    response = client.get("/probe", headers={"Authorization": "Bearer test-a"})
    assert response.status_code == 200
    assert response.json() == {"id": USER_A, "rows": [{"user_id": USER_A}]}
    assert sum(path == "/auth/v1/user" for path, _, _ in calls) == 1
    assert all(token == "test-a" for _, token, _ in calls)
    assert len(transports) == 1 and transports[0].is_closed


def test_concurrent_users_get_separate_tokens_and_clients(harness):
    client, calls, transports, _ = harness
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(
            lambda token: client.get("/probe", headers={"Authorization": f"Bearer {token}"}),
            ["test-a", "test-b"],
        ))
    assert [response.json()["rows"][0]["user_id"] for response in results] == [USER_A, USER_B]
    assert len(transports) == 2 and transports[0] is not transports[1]
    assert all(transport.is_closed for transport in transports)


def test_existing_route_history_uses_verified_jwt_and_owner_filter(harness):
    client, calls, _, _ = harness
    response = client.get("/user/history", headers={"Authorization": "Bearer test-a"})
    assert response.status_code == 200 and response.json()["status"] == "success"
    path, token, params = next(call for call in calls if call[0].startswith("/rest/"))
    assert path == "/rest/v1/route_query_log"
    assert token == "test-a" and params["user_id"] == f"eq.{USER_A}"


def test_legacy_schema_failure_is_sanitized(harness):
    client, _, _, state = harness
    state["database_error"] = True
    response = client.get("/user/history", headers={"Authorization": "Bearer test-a"})
    assert response.json()["status"] == "error"
    assert "private" not in response.text and "42703" not in response.text


def test_endpoint_errors_are_not_mislabeled_as_auth_errors(harness):
    client, _, transports, _ = harness
    response = client.get("/endpoint-failure", headers={"Authorization": "Bearer test-a"})
    assert response.status_code == 500
    assert all(transport.is_closed for transport in transports)
