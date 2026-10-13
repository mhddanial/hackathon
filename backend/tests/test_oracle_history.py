"""API + real Supabase SDK tests, using SQL-backed mocked HTTP on local PG.

Only the small PostgREST query subset used by history is translated here.
Auth sessions/HTTP are simulated; actual PostgreSQL constraints/RLS are active.
"""

import base64
import json
import re
from uuid import uuid4

import httpx
import psycopg
from psycopg import sql
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import auth
import database
from routers.agent import router as agent_router
from routers.user import router
from test_oracle_rls import test_database_url, USER_A, USER_B

OriginalHttpClient = httpx.Client
BASE = "/user/conversations"
HEADERS_A = {"Authorization": "Bearer test-a"}
HEADERS_B = {"Authorization": "Bearer test-b"}


def encode(value):
    return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip("=")


@pytest.fixture
def api(test_database_url, monkeypatch):
    calls = []
    state = {"error": None}
    with psycopg.connect(test_database_url, row_factory=dict_row) as conn:
        conn.execute("INSERT INTO auth.users VALUES (%s),(%s)", (USER_A, USER_B))

        def handle(request):
            token = request.headers.get("Authorization", "").removeprefix("Bearer ")
            params = dict(request.url.params)
            calls.append((request.method, request.url.path, token, params))
            if token not in ("test-a", "test-b"):
                return httpx.Response(401, json={"code": "bad_jwt", "msg": "Invalid token"})
            user = USER_A if token == "test-a" else USER_B
            if request.url.path == "/auth/v1/user":
                return httpx.Response(200, json={
                    "id": user, "aud": "authenticated", "role": "authenticated",
                    "app_metadata": {}, "user_metadata": {}, "created_at": "2026-10-05T00:00:00Z",
                })
            if state["error"] == "network":
                raise httpx.ReadTimeout("private transport diagnostic", request=request)
            if state["error"]:
                return httpx.Response(500, json={"code": "XX000", "message": "private SQL diagnostic"})

            if request.url.path.startswith("/rest/v1/rpc/"):
                name=request.url.path.rsplit("/",1)[-1]
                arguments={
                    "oracle_reserve_turn":["p_request_id","p_content","p_conversation_id"],
                    "oracle_record_tool":["p_turn_id","p_call_id","p_name","p_arguments","p_output"],
                    "oracle_finish_turn":["p_turn_id","p_content","p_status","p_tool_calls","p_results"],
                }[name]
                body=json.loads(request.content)
                values=[Jsonb(body[key]) if key in ("p_arguments","p_output","p_tool_calls","p_results") else body[key] for key in arguments]
                try:
                    with conn.transaction():
                        conn.execute("SET LOCAL ROLE authenticated")
                        conn.execute("SELECT set_config('request.jwt.claim.sub',%s,true)",(user,))
                        row=conn.execute(sql.SQL('SELECT public.{}({}) AS data').format(sql.Identifier(name),
                            sql.SQL(',').join(sql.Placeholder() for _ in arguments)),values).fetchone()
                    return httpx.Response(200,json=json.loads(json.dumps(row['data'],default=str)))
                except psycopg.DatabaseError as exc:
                    code=exc.sqlstate or 'XX000'
                    status=int(code[2:]) if code.startswith('PT') else 500
                    return httpx.Response(status,json={"code":code,"message":"private RPC diagnostic","details":None,"hint":None})

            table = request.url.path.rsplit("/", 1)[-1]
            assert table in ("conversations", "chat_messages")
            conditions, values = [], []
            for key, value in params.items():
                if key in ("user_id", "id", "conversation_id", "sequence", "archived_at", "status"):
                    operator, argument = value.split(".", 1)
                    if operator == "is" and argument == "null":
                        conditions.append(sql.SQL("{} IS NULL").format(sql.Identifier(key)))
                    else:
                        assert operator in ("eq", "gt")
                        conditions.append(sql.SQL("{} {} %s").format(sql.Identifier(key), sql.SQL("=" if operator == "eq" else ">")))
                        values.append(argument)
            if "or" in params:
                boundary = re.fullmatch(r"\(updated_at.lt.([^,]+),and\(updated_at.eq.([^,]+),id.lt.([^\)]+)\)\)", params["or"])
                assert boundary and boundary[1] == boundary[2]
                conditions.append(sql.SQL("(updated_at<%s OR (updated_at=%s AND id<%s))"))
                values.extend(boundary.groups())
            where = sql.SQL(" WHERE ") + sql.SQL(" AND ").join(conditions) if conditions else sql.SQL("")
            if request.method == "DELETE":
                assert table == "conversations" and params["user_id"] == "eq." + user
                assert "id" in params and request.content in (b"", b"{}")
                try:
                    with conn.transaction():
                        conn.execute("SET LOCAL ROLE authenticated")
                        conn.execute("SELECT set_config('request.jwt.claim.sub',%s,true)", (user,))
                        rows = conn.execute(sql.SQL("DELETE FROM public.{}").format(sql.Identifier(table))
                            + where + sql.SQL(" RETURNING *"), values).fetchall()
                    return httpx.Response(200, json=json.loads(json.dumps(rows, default=str)))
                except psycopg.DatabaseError as exc:
                    code = exc.sqlstate or "XX000"
                    status = int(code[2:]) if code.startswith("PT") else 500
                    return httpx.Response(status, json={"code": code, "message": "private SQL diagnostic", "details": None, "hint": None})
            with conn.transaction():
                conn.execute("SET LOCAL ROLE authenticated")
                conn.execute("SELECT set_config('request.jwt.claim.sub',%s,true)", (user,))
                if request.method == "GET":
                    # Explicit filters are independently checked alongside real RLS.
                    assert params["user_id"] == "eq." + user
                    columns = sql.SQL(",").join(sql.Identifier(c) for c in params["select"].split(","))
                    query = sql.SQL("SELECT {} FROM public.{}").format(columns, sql.Identifier(table)) + where
                    if params.get("order"):
                        ordering = []
                        for order in params["order"].split(","):
                            column, direction = order.split(".")
                            assert direction in ("asc", "desc")
                            ordering.append(sql.SQL("{} {}").format(sql.Identifier(column), sql.SQL(direction)))
                        query += sql.SQL(" ORDER BY ") + sql.SQL(",").join(ordering)
                    query += sql.SQL(" LIMIT %s")
                    values.append(int(params["limit"]))
                else:
                    body = json.loads(request.content)
                    if request.method == "POST":
                        assert body["user_id"] == user
                        query = sql.SQL("INSERT INTO public.{} ({}) VALUES ({}) RETURNING *").format(
                            sql.Identifier(table), sql.SQL(",").join(sql.Identifier(k) for k in body),
                            sql.SQL(",").join(sql.Placeholder() for _ in body),
                        )
                        values = list(body.values())
                    else:
                        assert request.method == "PATCH" and params["user_id"] == "eq." + user
                        assert set(body) <= {"title", "archived_at"}
                        query = sql.SQL("UPDATE public.{} SET {}").format(
                            sql.Identifier(table), sql.SQL(",").join(sql.SQL("{}=%s").format(sql.Identifier(k)) for k in body),
                        ) + where + sql.SQL(" RETURNING *")
                        values = list(body.values()) + values
                rows = conn.execute(query, values).fetchall()
            return httpx.Response(200, json=json.loads(json.dumps(rows, default=str)))

        def transport(**kwargs):
            client=OriginalHttpClient(transport=httpx.MockTransport(handle), **kwargs)
            state.setdefault('transports',[]).append(client)
            return client

        monkeypatch.setattr(database, "url", "https://example.supabase.co")
        monkeypatch.setattr(database, "key", "test-publishable-key")
        monkeypatch.setattr(auth.httpx, "Client", transport)
        app = FastAPI()
        app.include_router(router, prefix="/user")
        app.include_router(agent_router, prefix="/agent")
        with TestClient(app) as client:
            yield client, conn, calls, state
        conn.rollback()


def create(api, title=None, headers=HEADERS_A):
    response = api[0].post(BASE, json={"title": title}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def seed_messages(conn, conversation, user=USER_A, count=4):
    conn.execute("RESET ROLE")
    ids = []
    for i in range(count):
        message = uuid4()
        row = conn.execute("""INSERT INTO public.chat_messages
            (id,conversation_id,user_id,turn_id,client_request_id,role,content,status)
            VALUES (%s,%s,%s,%s,%s,'user',%s,'completed') RETURNING sequence""",
            (message, conversation, user, message, uuid4(), f"Synthetic message {i}"),
        ).fetchone()
        ids.append(row["sequence"])
    return ids


def test_create_read_update_reset_title_and_response_privacy(api):
    client, conn, calls, _ = api
    item = create(api, "  Trip  ")
    assert item["title"] == "Trip" and set(item) == {"id", "title", "created_at", "updated_at", "archived_at"}
    assert client.get(BASE + "/" + item["id"], headers=HEADERS_A).json() == item
    updated = client.patch(BASE + "/" + item["id"], json={"title": None}, headers=HEADERS_A)
    assert updated.status_code == 200 and updated.json()["title"] is None
    assert client.get(BASE, headers=HEADERS_B).json() == {"conversations": [], "next_cursor": None}
    writes = [call for call in calls if call[0] in ("POST", "PATCH") and call[1] == "/rest/v1/conversations"]
    assert len(writes) == 2 and all(call[2] == "test-a" for call in writes)


@pytest.mark.parametrize("method,suffix,body", [("GET", "", None), ("GET", "/messages", None), ("PATCH", "", {"title": "stolen"}), ("PATCH", "", {"archived": True}), ("DELETE", "", None)])
def test_foreign_and_missing_conversations_have_identical_404(api, method, suffix, body):
    foreign = create(api, "B", HEADERS_B)
    client = api[0]
    responses = [client.request(method, BASE + "/" + identifier + suffix, json=body, headers=HEADERS_A)
                 for identifier in (foreign["id"], str(uuid4()))]
    assert all(response.status_code == 404 for response in responses)
    assert responses[0].json() == responses[1].json() == {"detail": "Conversation not found"}
    assert client.get(BASE + "/" + foreign["id"], headers=HEADERS_B).json()["title"] == "B"


def test_archive_restore_and_read_archived_messages(api):
    item = create(api, "Trip")
    seed_messages(api[1], item["id"], count=1)
    client = api[0]
    assert client.patch(BASE + "/" + item["id"], json={"archived": True}, headers=HEADERS_A).json()["archived_at"]
    assert client.get(BASE, headers=HEADERS_A).json()["conversations"] == []
    assert len(client.get(BASE, params={"include_archived": "true"}, headers=HEADERS_A).json()["conversations"]) == 1
    assert len(client.get(BASE + "/" + item["id"] + "/messages", headers=HEADERS_A).json()["messages"]) == 1
    assert client.patch(BASE + "/" + item["id"], json={"archived": False}, headers=HEADERS_A).json()["archived_at"] is None
    assert len(client.get(BASE, headers=HEADERS_A).json()["conversations"]) == 1


@pytest.mark.parametrize("archived", [False, True])
def test_delete_owned_conversation_cascades_messages_and_leaves_other_chats(api, archived):
    item = create(api, "Delete this")
    keep = create(api, "Keep this")
    foreign = create(api, "Other account", HEADERS_B)
    for convo, user in ((item, USER_A), (keep, USER_A), (foreign, USER_B)):
        seed_messages(api[1], convo["id"], user=user, count=1)
    if archived:
        assert api[0].patch(BASE + "/" + item["id"], json={"archived": True}, headers=HEADERS_A).status_code == 200
    response = api[0].delete(BASE + "/" + item["id"], headers=HEADERS_A)
    assert response.status_code == 204 and response.content == b""
    assert api[0].get(BASE + "/" + item["id"] + "/messages", headers=HEADERS_A).status_code == 404
    api[1].execute("RESET ROLE")
    assert api[1].execute("SELECT count(*) FROM chat_messages WHERE conversation_id=%s", (item["id"],)).fetchone()["count"] == 0
    assert api[1].execute("SELECT count(*) FROM chat_messages").fetchone()["count"] == 2
    assert api[0].delete(BASE + "/" + item["id"], headers=HEADERS_A).status_code == 404


@pytest.mark.parametrize("stale", [False, True])
def test_delete_active_turn_conflict_or_stale_cleanup(api, stale):
    item = create(api, "Active turn")
    conn = api[1]
    seed_messages(conn, item["id"], count=1)
    conn.execute("UPDATE chat_messages SET status='in_progress' WHERE conversation_id=%s", (item["id"],))
    conn.execute("""INSERT INTO chat_messages(conversation_id,user_id,turn_id,role)
        SELECT conversation_id,user_id,id,'assistant' FROM chat_messages WHERE conversation_id=%s""", (item["id"],))
    if stale:
        conn.execute("UPDATE chat_messages SET created_at=now()-interval '4 minutes' WHERE conversation_id=%s", (item["id"],))
    response = api[0].delete(BASE + "/" + item["id"], headers=HEADERS_A)
    assert response.status_code == (204 if stale else 409)
    if not stale:
        assert response.json() == {"detail": "Wait for the active turn before changing this conversation"}
        conn.execute("RESET ROLE")
        assert conn.execute("SELECT count(*) FROM chat_messages WHERE conversation_id=%s", (item["id"],)).fetchone()["count"] == 2


def test_conversation_pagination_handles_identical_timestamps_without_duplicates(api):
    created = [create(api, f"Trip {i}")["id"] for i in range(5)]
    create(api, "Foreign", HEADERS_B)
    api[1].execute("RESET ROLE")
    api[1].execute("UPDATE conversations SET updated_at='2026-10-06T00:00:00Z'")
    seen, cursor = [], None
    for _ in range(3):
        params = {"limit": 2}
        if cursor:
            params["cursor"] = cursor
        response = api[0].get(BASE, params=params, headers=HEADERS_A)
        assert response.status_code == 200, response.text
        page = response.json()
        seen.extend(row["id"] for row in page["conversations"])
        cursor = page["next_cursor"]
    assert cursor is None and seen == sorted(created, reverse=True)
    assert all(call[3]["limit"] == "3" for call in api[2] if call[1] == "/rest/v1/conversations" and "order" in call[3])


def test_messages_are_paginated_by_sequence_with_no_private_fields(api):
    item = create(api)
    sequences = seed_messages(api[1], item["id"], count=5)
    url = BASE + "/" + item["id"] + "/messages"
    seen, cursor = [], None
    for _ in range(3):
        page = api[0].get(url, params={"limit": 2, **({"cursor": cursor} if cursor else {})}, headers=HEADERS_A).json()
        seen.extend(message["sequence"] for message in page["messages"])
        assert all("user_id" not in message and "client_request_id" not in message for message in page["messages"])
        cursor = page["next_cursor"]
    assert seen == sequences and cursor is None


@pytest.mark.parametrize("method,suffix,body", [("GET", "", None), ("POST", "", {}), ("GET", "/00000000-0000-4000-8000-000000000011", None), ("PATCH", "/00000000-0000-4000-8000-000000000011", {"archived": True}), ("GET", "/00000000-0000-4000-8000-000000000011/messages", None), ("DELETE", "/00000000-0000-4000-8000-000000000011", None)])
@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer expired-token"}])
def test_all_history_routes_require_verified_auth(api, method, suffix, body, headers):
    response = api[0].request(method, BASE + suffix, json=body, headers=headers)
    assert response.status_code == 401 and response.headers["WWW-Authenticate"] == "Bearer"
    assert not any(path.startswith("/rest/") for _, path, _, _ in api[2])


@pytest.mark.parametrize("method,body", [("POST", {"user_id": USER_B}), ("PATCH", {"user_id": USER_B}), ("PATCH", {}), ("PATCH", {"archived": None}), ("PATCH", {"archived_at": "2026-10-06T00:00:00Z"}), ("POST", {"title": " "}), ("POST", {"title": "x"*161})])
def test_identity_and_invalid_edit_fields_are_rejected(api, method, body):
    item = create(api)
    url = BASE if method == "POST" else BASE + "/" + item["id"]
    assert api[0].request(method, url, json=body, headers=HEADERS_A).status_code == 422


@pytest.mark.parametrize("params", [{"limit": 0}, {"limit": 101}, {"cursor": ""}, {"cursor": "(id.eq.stolen)"}, {"cursor": "A"*513}, {"cursor": encode({"kind": "conversations", "include_archived": False, "updated_at": "2026-10-06", "id": str(uuid4())})}])
def test_invalid_page_boundaries_are_rejected(api, params):
    assert api[0].get(BASE, params=params, headers=HEADERS_A).status_code == 422


def test_cursor_cannot_switch_resource_or_archive_filter(api):
    items = [create(api) for _ in range(2)]
    cursor = api[0].get(BASE, params={"limit": 1}, headers=HEADERS_A).json()["next_cursor"]
    assert api[0].get(BASE, params={"cursor": cursor, "include_archived": "true"}, headers=HEADERS_A).status_code == 422
    for item in items:
        seed_messages(api[1], item["id"], count=2)
    url = BASE + "/" + items[0]["id"] + "/messages"
    message_cursor = api[0].get(url, params={"limit": 1}, headers=HEADERS_A).json()["next_cursor"]
    assert api[0].get(BASE + "/" + items[1]["id"] + "/messages", params={"cursor": message_cursor}, headers=HEADERS_A).status_code == 422
    assert api[0].get(url, params={"cursor": cursor}, headers=HEADERS_A).status_code == 422


@pytest.mark.parametrize("error", ["database", "network"])
@pytest.mark.parametrize("method", ["GET", "DELETE"])
def test_database_failures_return_safe_retryable_error(api, error, method):
    api[3]["error"] = error
    response = api[0].request(method, BASE if method == "GET" else BASE + "/" + str(uuid4()), headers=HEADERS_A)
    assert response.status_code == 503 and response.headers["Retry-After"] == "5"
    assert "private" not in response.text


def test_invalid_uuid_is_rejected_and_empty_messages_have_no_cursor(api):
    item = create(api)
    assert api[0].get(BASE + "/bad-id", headers=HEADERS_A).status_code == 422
    assert api[0].delete(BASE + "/bad-id", headers=HEADERS_A).status_code == 422
    assert api[0].get(BASE + "/" + item["id"] + "/messages", headers=HEADERS_A).json() == {"messages": [], "next_cursor": None}


def test_persisted_tool_metadata_and_multiple_results_are_read_without_reexecution(api):
    item = create(api)
    seed_messages(api[1], item["id"], count=1)
    turn = api[1].execute("SELECT id FROM chat_messages WHERE conversation_id=%s", (item["id"],)).fetchone()["id"]
    results = [
        {"type": "generic", "title": title, "source": "database", "data_status": "database",
         "disclaimer": "Synthetic test fixture", "data": {"count": count}}
        for title, count in (("Schedules", 2), ("Route", 1))
    ]
    api[1].execute("""INSERT INTO chat_messages
        (conversation_id,user_id,turn_id,role,content,status,structured_results)
        VALUES (%s,%s,%s,'assistant','Saved answer','completed',%s::jsonb)""",
        (item["id"], USER_A, turn, json.dumps(results)))
    api[1].execute("""INSERT INTO chat_messages
        (conversation_id,user_id,turn_id,role,status,tool_call_id,tool_name,tool_arguments,tool_result)
        VALUES (%s,%s,%s,'tool','completed','call-test','get_ferry_schedule','{}','{"count":2}')""",
        (item["id"], USER_A, turn))
    page = api[0].get(BASE + "/" + item["id"] + "/messages", headers=HEADERS_A).json()
    assert page["messages"][1]["structured_results"] == [{**result, "observed_at": None, "calculated_at": None} for result in results]
    assert page["messages"][2]["tool_name"] == "get_ferry_schedule"
    assert page["messages"][2]["tool_result"] == {"count": 2}
