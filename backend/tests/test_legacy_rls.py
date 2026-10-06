"""Run the actual legacy migration in a disposable loopback PostgreSQL DB."""

import psycopg
from psycopg import errors, sql
import pytest

from test_oracle_rls import test_database_url, USER_A, USER_B, ROOT

TABLES = ("road_segments", "congestion_multipliers", "ferry_schedules", "route_query_log")
REFERENCE_TABLES = TABLES[:3]
MIGRATION = next((ROOT / "supabase" / "migrations").glob("*_legacy_table_rls.sql"))


@pytest.fixture(scope="module")
def legacy_database_url(test_database_url):
    with psycopg.connect(test_database_url, autocommit=True) as conn:
        # This fixture already has legacy sentinel rows plus the Oracle schema.
        conn.execute("ALTER TABLE public.route_query_log ADD COLUMN requested_at timestamptz DEFAULT now()")
        conn.execute("CREATE ROLE legacy_import_test NOLOGIN BYPASSRLS")
        for table in TABLES:
            conn.execute(sql.SQL("GRANT ALL ON public.{} TO PUBLIC, anon, authenticated, legacy_import_test").format(sql.Identifier(table)))
        before = conn.execute("SELECT tablename,policyname,qual,with_check FROM pg_policies ORDER BY 1,2").fetchall()
        conn.execute(MIGRATION.read_text(encoding="utf-8"))
        after = conn.execute("SELECT tablename,policyname,qual,with_check FROM pg_policies WHERE tablename IN ('conversations','chat_messages') ORDER BY 1,2").fetchall()
        assert before == after
    try:
        yield test_database_url
    finally:
        with psycopg.connect(test_database_url, autocommit=True) as conn:
            conn.execute("DROP OWNED BY legacy_import_test")
            conn.execute("DROP ROLE legacy_import_test")


@pytest.fixture
def legacy_db(legacy_database_url):
    with psycopg.connect(legacy_database_url) as conn:
        conn.execute("INSERT INTO auth.users VALUES (%s),(%s)", (USER_A, USER_B))
        conn.execute("INSERT INTO public.route_query_log (id,user_id,result_json) VALUES (2,%s,'{}'),(3,%s,'{}')", (USER_A, USER_B))
        yield conn
        conn.rollback()


def as_role(db, role, user=""):
    db.execute(sql.SQL("SET LOCAL ROLE {}").format(sql.Identifier(role)))
    db.execute("SELECT set_config('request.jwt.claim.sub',%s,true)", (user,))


@pytest.mark.parametrize("role", ["anon", "authenticated"])
@pytest.mark.parametrize("table", REFERENCE_TABLES)
def test_reference_reads_remain_available(legacy_db, role, table):
    as_role(legacy_db, role, USER_A if role == "authenticated" else "")
    assert len(legacy_db.execute(sql.SQL("SELECT * FROM public.{}").format(sql.Identifier(table))).fetchall()) == 1


@pytest.mark.parametrize("role", ["anon", "authenticated"])
@pytest.mark.parametrize("table", TABLES)
@pytest.mark.parametrize("operation", ["insert", "update", "delete", "truncate"])
def test_api_roles_cannot_write_any_legacy_table(legacy_db, role, table, operation):
    as_role(legacy_db, role, USER_A if role == "authenticated" else "")
    name = sql.Identifier(table)
    column = sql.Identifier("segment_id" if table == "road_segments" else "id")
    queries = {
        "insert": sql.SQL("INSERT INTO public.{} SELECT * FROM public.{} LIMIT 1").format(name, name),
        "update": sql.SQL("UPDATE public.{} SET {}={}").format(name, column, column),
        "delete": sql.SQL("DELETE FROM public.{}").format(name),
        "truncate": sql.SQL("TRUNCATE public.{} CASCADE").format(name),
    }
    with pytest.raises(errors.InsufficientPrivilege), legacy_db.transaction():
        legacy_db.execute(queries[operation])


@pytest.mark.parametrize("user,expected_id", [(USER_A, 2), (USER_B, 3)])
def test_route_history_reads_only_owned_rows(legacy_db, user, expected_id):
    as_role(legacy_db, "authenticated", user)
    assert legacy_db.execute("SELECT id FROM public.route_query_log ORDER BY requested_at DESC").fetchall() == [(expected_id,)]
    assert legacy_db.execute("SELECT id FROM public.route_query_log WHERE user_id=%s AND id=1", (user,)).fetchall() == []


def test_route_history_is_unavailable_to_anon(legacy_db):
    as_role(legacy_db, "anon")
    with pytest.raises(errors.InsufficientPrivilege), legacy_db.transaction():
        legacy_db.execute("SELECT * FROM public.route_query_log")


def test_route_history_without_user_claim_returns_no_rows(legacy_db):
    as_role(legacy_db, "authenticated")
    assert legacy_db.execute("SELECT * FROM public.route_query_log").fetchall() == []


def test_legacy_data_preserved_and_all_four_tables_force_rls(legacy_db):
    assert legacy_db.execute("SELECT user_id,result_json FROM public.route_query_log WHERE id=1").fetchone() == (None, {"sentinel": True})
    for table in TABLES:
        assert legacy_db.execute("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid=%s::regclass", ("public." + table,)).fetchone() == (True, True)
    for table in REFERENCE_TABLES:
        assert legacy_db.execute(sql.SQL("SELECT count(*) FROM public.{}").format(sql.Identifier(table))).fetchone()[0] == 1


def test_privileged_import_access_remains_usable(legacy_db):
    as_role(legacy_db, "legacy_import_test")
    legacy_db.execute("INSERT INTO public.road_segments VALUES ('IMPORT_TEST')")
    assert legacy_db.execute("SELECT count(*) FROM public.road_segments").fetchone()[0] == 2
    # A privileged route writer explicitly attributes the verified owner.
    legacy_db.execute("INSERT INTO public.route_query_log (id,user_id) VALUES (4,%s)", (USER_A,))
    assert legacy_db.execute("SELECT count(*) FROM public.route_query_log").fetchone()[0] == 4


def test_unknown_route_owner_is_rejected_even_for_admin(legacy_db):
    with pytest.raises(errors.ForeignKeyViolation), legacy_db.transaction():
        legacy_db.execute("INSERT INTO public.route_query_log (id,user_id) VALUES (4,'00000000-0000-4000-8000-000000000099')")


def test_deleted_user_history_is_retained_but_hidden(legacy_db):
    legacy_db.execute("DELETE FROM auth.users WHERE id=%s", (USER_A,))
    assert legacy_db.execute("SELECT user_id FROM public.route_query_log WHERE id=2").fetchone() == (None,)
    as_role(legacy_db, "authenticated", USER_A)
    assert legacy_db.execute("SELECT * FROM public.route_query_log").fetchall() == []


def test_policy_drift_aborts_without_partial_changes(legacy_db):
    # A second application detects existing policies instead of overriding them.
    statements = MIGRATION.read_text(encoding="utf-8").replace("BEGIN;", "", 1).removesuffix("COMMIT;\n")
    with pytest.raises(errors.RaiseException, match="Legacy policies changed"), legacy_db.transaction():
        legacy_db.execute(statements)
    assert legacy_db.execute("SELECT count(*) FROM public.route_query_log").fetchone()[0] == 3
