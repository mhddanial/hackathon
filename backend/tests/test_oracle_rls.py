"""Real PostgreSQL RLS tests in a disposable loopback database.

Set ORACLE_TEST_DATABASE_URL to a local admin DB. Fixtures create/drop only a
new oracle_sprint1_test_<random> database. Auth claims are simulated here;
Supabase session validation is covered separately by SDK transport tests.
"""

import os
from pathlib import Path
from uuid import uuid4

import psycopg
from psycopg import errors, sql
from psycopg.conninfo import conninfo_to_dict, make_conninfo
import pytest

ROOT = Path(__file__).resolve().parents[2]
USER_A = "00000000-0000-4000-8000-000000000001"
USER_B = "00000000-0000-4000-8000-000000000002"
CONV_A = "00000000-0000-4000-8000-000000000011"
CONV_B = "00000000-0000-4000-8000-000000000012"
MSG_A = "00000000-0000-4000-8000-000000000021"
MSG_B = "00000000-0000-4000-8000-000000000022"
REQUEST_A = "00000000-0000-4000-8000-000000000031"
REQUEST_B = "00000000-0000-4000-8000-000000000032"


@pytest.fixture(scope="module")
def test_database_url():
    admin_url = os.environ.get("ORACLE_TEST_DATABASE_URL")
    if not admin_url:
        pytest.skip("Set ORACLE_TEST_DATABASE_URL for disposable local PostgreSQL RLS tests")
    options = conninfo_to_dict(admin_url)
    if options.get("host") not in ("127.0.0.1", "localhost", "::1"):
        pytest.fail("Disposable database fixture refuses non-loopback hosts")
    name = "oracle_sprint1_test_" + uuid4().hex[:12]
    with psycopg.connect(admin_url, autocommit=True) as admin:
        for role in ("anon", "authenticated"):
            if not admin.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (role,)).fetchone():
                admin.execute(sql.SQL("CREATE ROLE {} NOLOGIN NOSUPERUSER NOBYPASSRLS").format(sql.Identifier(role)))
        admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
    test_url = make_conninfo(admin_url, dbname=name)
    try:
        with psycopg.connect(test_url, autocommit=True) as conn:
            conn.execute("""
                CREATE SCHEMA auth;
                CREATE TABLE auth.users (id uuid PRIMARY KEY);
                CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
                  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
                $$;
                GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;
                GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;
                CREATE TABLE public.route_query_log (id integer PRIMARY KEY, result_json jsonb);
                INSERT INTO public.route_query_log VALUES (1, '{"sentinel": true}');
                CREATE TABLE public.road_segments (segment_id text PRIMARY KEY);
                INSERT INTO public.road_segments VALUES ('SEG001');
                CREATE TABLE public.congestion_multipliers (id integer PRIMARY KEY);
                INSERT INTO public.congestion_multipliers VALUES (1);
                CREATE TABLE public.ferry_schedules (id integer PRIMARY KEY);
                INSERT INTO public.ferry_schedules VALUES (1);
            """)
            migration = next((ROOT / "supabase" / "migrations").glob("*_oracle_history.sql"))
            conn.execute(migration.read_text(encoding="utf-8"))
            delete_guard = next((ROOT / "supabase" / "migrations").glob("*_oracle_conversation_delete_guard.sql"))
            conn.execute(delete_guard.read_text(encoding="utf-8"))
        yield test_url
    finally:
        with psycopg.connect(admin_url, autocommit=True) as admin:
            admin.execute(sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(name)))


@pytest.fixture
def db(test_database_url):
    with psycopg.connect(test_database_url) as conn:
        conn.execute("INSERT INTO auth.users VALUES (%s), (%s)", (USER_A, USER_B))
        conn.execute(
            "INSERT INTO public.conversations (id, user_id, title) VALUES (%s,%s,'A'),(%s,%s,'B')",
            (CONV_A, USER_A, CONV_B, USER_B),
        )
        for user, conv, msg, request in (
            (USER_A, CONV_A, MSG_A, REQUEST_A), (USER_B, CONV_B, MSG_B, REQUEST_B)
        ):
            conn.execute(
                """INSERT INTO public.chat_messages
                   (id,conversation_id,user_id,turn_id,client_request_id,role,content,status)
                   VALUES (%s,%s,%s,%s,%s,'user','Synthetic test message','completed')""",
                (msg, conv, user, msg, request),
            )
        yield conn
        conn.rollback()


def act_as(db, user_id):
    db.execute("SET LOCAL ROLE authenticated")
    db.execute("SELECT set_config('request.jwt.claim.sub', %s, true)", (user_id,))


def insert_user_message(db, *, user=USER_A, conv=CONV_A, request=None):
    message = uuid4()
    return db.execute(
        """INSERT INTO public.chat_messages
           (id,conversation_id,user_id,turn_id,client_request_id,role,content)
           VALUES (%s,%s,%s,%s,%s,'user','Test') RETURNING id,sequence""",
        (message, conv, user, message, request or uuid4()),
    ).fetchone()


@pytest.mark.parametrize("user,conversation,message", [(USER_A, CONV_A, MSG_A), (USER_B, CONV_B, MSG_B)])
def test_each_user_reads_only_owned_conversations_and_messages(db, user, conversation, message):
    act_as(db, user)
    assert [str(row[0]) for row in db.execute("SELECT id FROM public.conversations")] == [conversation]
    assert [str(row[0]) for row in db.execute("SELECT id FROM public.chat_messages")] == [message]


def test_user_can_create_owned_conversation_and_append(db):
    act_as(db, USER_A)
    new_conv = db.execute("INSERT INTO public.conversations (title) VALUES ('New') RETURNING id,user_id").fetchone()
    assert str(new_conv[1]) == USER_A
    assert insert_user_message(db, conv=new_conv[0])[0]


@pytest.mark.parametrize("table,id_value", [("conversations", CONV_B), ("chat_messages", MSG_B)])
def test_guessed_foreign_ids_return_no_rows(db, table, id_value):
    act_as(db, USER_A)
    assert db.execute(sql.SQL("SELECT * FROM public.{} WHERE id=%s").format(sql.Identifier(table)), (id_value,)).fetchall() == []


@pytest.mark.parametrize("user,conv", [(USER_A, CONV_B), (USER_B, CONV_A)])
def test_forged_owner_or_foreign_conversation_append_is_denied(db, user, conv):
    act_as(db, USER_A)
    with pytest.raises(errors.InsufficientPrivilege), db.transaction():
        insert_user_message(db, user=user, conv=conv)


def test_conversation_insert_cannot_forge_owner(db):
    act_as(db, USER_A)
    with pytest.raises(errors.InsufficientPrivilege), db.transaction():
        db.execute("INSERT INTO public.conversations (user_id) VALUES (%s)", (USER_B,))


@pytest.mark.parametrize("table,id_value", [("conversations", CONV_A), ("chat_messages", MSG_A)])
def test_update_cannot_transfer_ownership(db, table, id_value):
    act_as(db, USER_A)
    with pytest.raises(errors.InsufficientPrivilege), db.transaction():
        db.execute(sql.SQL("UPDATE public.{} SET user_id=%s WHERE id=%s").format(sql.Identifier(table)), (USER_B, id_value))


def test_foreign_update_and_delete_do_not_affect_rows(db):
    act_as(db, USER_A)
    assert db.execute("UPDATE public.conversations SET title='stolen' WHERE id=%s", (CONV_B,)).rowcount == 0
    assert db.execute("UPDATE public.chat_messages SET content='stolen' WHERE id=%s", (MSG_B,)).rowcount == 0
    assert db.execute("DELETE FROM public.chat_messages WHERE id=%s", (MSG_B,)).rowcount == 0
    assert db.execute("DELETE FROM public.conversations WHERE id=%s", (CONV_B,)).rowcount == 0


def test_own_update_delete_and_cascade_work(db):
    act_as(db, USER_A)
    assert db.execute("UPDATE public.conversations SET title='renamed' WHERE id=%s", (CONV_A,)).rowcount == 1
    assert db.execute("DELETE FROM public.conversations WHERE id=%s", (CONV_A,)).rowcount == 1
    assert db.execute("SELECT id FROM public.chat_messages").fetchall() == []


@pytest.mark.parametrize("table", ["conversations", "chat_messages"])
def test_anonymous_role_has_no_table_access(db, table):
    db.execute("SET LOCAL ROLE anon")
    with pytest.raises(errors.InsufficientPrivilege), db.transaction():
        db.execute(sql.SQL("SELECT * FROM public.{}").format(sql.Identifier(table)))


def test_authenticated_role_without_user_claim_has_no_access(db):
    act_as(db, "")
    assert db.execute("SELECT id FROM public.conversations").fetchall() == []
    with pytest.raises(errors.InsufficientPrivilege), db.transaction():
        db.execute("INSERT INTO public.conversations (user_id) VALUES (%s)", (USER_A,))


def test_ownership_constraint_holds_even_for_privileged_writer(db):
    # Fixture admin bypasses RLS: the composite FK is an independent guard.
    with pytest.raises(errors.ForeignKeyViolation), db.transaction():
        insert_user_message(db, user=USER_A, conv=CONV_B)


def test_turn_cannot_reference_another_conversation(db):
    act_as(db, USER_A)
    other = db.execute("INSERT INTO public.conversations DEFAULT VALUES RETURNING id").fetchone()[0]
    with pytest.raises(errors.ForeignKeyViolation), db.transaction():
        db.execute(
            "INSERT INTO public.chat_messages (conversation_id,turn_id,role) VALUES (%s,%s,'assistant')",
            (other, MSG_A),
        )


def test_request_ids_are_unique_per_user_across_conversations(db):
    act_as(db, USER_A)
    with pytest.raises(errors.UniqueViolation), db.transaction():
        insert_user_message(db, request=REQUEST_A)
    assert insert_user_message(db, request=REQUEST_B)  # Other user's ID is independent.


def test_archive_blocks_append_and_preserves_readable_history(db):
    act_as(db, USER_A)
    db.execute("UPDATE public.conversations SET archived_at=now() WHERE id=%s", (CONV_A,))
    assert db.execute("SELECT id FROM public.chat_messages").fetchone()
    with pytest.raises(errors.InsufficientPrivilege), db.transaction():
        insert_user_message(db)
    with pytest.raises(errors.InsufficientPrivilege), db.transaction():
        db.execute("UPDATE public.chat_messages SET content='edit' WHERE id=%s", (MSG_A,))


def test_empty_completed_assistant_is_rejected(db):
    act_as(db, USER_A)
    with pytest.raises(errors.CheckViolation), db.transaction():
        db.execute(
            """INSERT INTO public.chat_messages (conversation_id,turn_id,role,status,content)
               VALUES (%s,%s,'assistant','completed','')""", (CONV_A, MSG_A),
        )


def test_sequence_orders_messages_with_identical_timestamps(db):
    act_as(db, USER_A)
    first = insert_user_message(db)
    second = insert_user_message(db)
    assert first[1] < second[1]
    assert db.execute("SELECT count(DISTINCT created_at) FROM public.chat_messages").fetchone()[0] == 1


def test_migration_preserves_legacy_tables_and_enables_only_new_rls(db):
    for table in ("route_query_log", "road_segments", "congestion_multipliers", "ferry_schedules"):
        assert db.execute(sql.SQL("SELECT count(*) FROM public.{}").format(sql.Identifier(table))).fetchone()[0] == 1
        assert db.execute("SELECT relrowsecurity FROM pg_class WHERE oid=%s::regclass", ("public." + table,)).fetchone()[0] is False
    assert db.execute("SELECT result_json FROM public.route_query_log").fetchone()[0] == {"sentinel": True}
    for table in ("conversations", "chat_messages"):
        assert db.execute("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid=%s::regclass", ("public." + table,)).fetchone() == (True, True)
