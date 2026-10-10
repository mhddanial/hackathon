"""Actual turn RPCs under PostgreSQL ownership roles in a disposable local DB."""

from concurrent.futures import ThreadPoolExecutor
import json
from uuid import uuid4

import psycopg
from psycopg import errors
import pytest

from test_oracle_rls import test_database_url, USER_A, USER_B, ROOT
from services.oracle_turns import paired_context


@pytest.fixture(scope="module")
def turn_database(test_database_url):
    with psycopg.connect(test_database_url,autocommit=True) as conn:
        conn.execute(next((ROOT/'supabase/migrations').glob('*_oracle_turn_lifecycle.sql')).read_text())
        conn.execute("INSERT INTO auth.users VALUES (%s),(%s)",(USER_A,USER_B))
    return test_database_url


@pytest.fixture
def turn_db(turn_database):
    with psycopg.connect(turn_database) as conn:
        conn.execute("SET LOCAL ROLE authenticated")
        conn.execute("SELECT set_config('request.jwt.claim.sub',%s,true)",(USER_A,))
        yield conn
        conn.rollback()


def reserve(db,request=None,content="Test logistics question",convo=None):
    return db.execute("SELECT public.oracle_reserve_turn(%s,%s,%s)",(request or uuid4(),content,convo)).fetchone()[0]


def finish(db,turn,status="completed",content="Saved answer"):
    return db.execute("SELECT public.oracle_finish_turn(%s,%s,%s,'[]','[]')",(turn['turn_id'],content,status)).fetchone()[0]


def test_reservation_is_owned_atomic_and_completed_retry_replays(turn_db):
    request=uuid4()
    turn=reserve(turn_db,request)
    assert turn['outcome']=='in_progress' and not turn['replay']
    assert turn_db.execute('SELECT count(*) FROM chat_messages').fetchone()[0]==2
    saved=finish(turn_db,turn)
    retry=reserve(turn_db,request)
    assert retry['replay'] and retry['content']=='Saved answer'
    assert retry['assistant_message_id']==saved['message_id'] and retry['outcome']=='completed'
    assert turn_db.execute('SELECT count(*) FROM conversations').fetchone()[0]==1


@pytest.mark.parametrize('kind',['same_request','same_conversation','different_message','different_conversation'])
def test_active_or_mismatched_retry_conflicts(turn_db,kind):
    request=uuid4(); turn=reserve(turn_db,request)
    with pytest.raises(psycopg.DatabaseError) as exc,turn_db.transaction():
        if kind=='same_request': reserve(turn_db,request)
        elif kind=='same_conversation': reserve(turn_db,convo=turn['conversation_id'])
        elif kind=='different_message': reserve(turn_db,request,content='Different content')
        else: reserve(turn_db,request,convo=uuid4())
    assert exc.value.sqlstate=='PT409'


def test_foreign_turn_and_conversation_ids_return_not_found(turn_db):
    turn=reserve(turn_db)
    turn_db.execute("SELECT set_config('request.jwt.claim.sub',%s,true)",(USER_B,))
    for query,values in [
        ('SELECT oracle_reserve_turn(%s,%s,%s)',(uuid4(),'Test',turn['conversation_id'])),
        ("SELECT oracle_finish_turn(%s,'stolen','completed','[]','[]')",(turn['turn_id'],)),
        ("SELECT oracle_record_tool(%s,'x','get_ferry_schedule','{}','{}')",(turn['turn_id'],)),
    ]:
        with pytest.raises(psycopg.DatabaseError) as exc,turn_db.transaction(): turn_db.execute(query,values)
        assert exc.value.sqlstate=='PT404'


@pytest.mark.parametrize('status',['failed','interrupted'])
def test_failed_turns_replay_without_reexecution_and_new_request_can_continue(turn_db,status):
    request=uuid4(); turn=reserve(turn_db,request)
    finish(turn_db,turn,status,'Partial answer')
    retry=reserve(turn_db,request)
    assert retry['replay'] and retry['outcome']==status
    assert not reserve(turn_db,convo=turn['conversation_id'])['replay']


def test_stale_turn_becomes_interrupted_and_cannot_finish_late(turn_db):
    request=uuid4(); turn=reserve(turn_db,request)
    turn_db.execute("UPDATE chat_messages SET created_at=now()-interval '4 minutes' WHERE turn_id=%s",(turn['turn_id'],))
    assert reserve(turn_db,request)['outcome']=='interrupted'
    with pytest.raises(psycopg.DatabaseError) as exc,turn_db.transaction(): finish(turn_db,turn)
    assert exc.value.sqlstate=='PT409'


def test_active_archive_is_blocked_and_archive_after_finish_is_readable(turn_db):
    turn=reserve(turn_db)
    with pytest.raises(psycopg.DatabaseError) as exc,turn_db.transaction():
        turn_db.execute('UPDATE conversations SET archived_at=now() WHERE id=%s',(turn['conversation_id'],))
    assert exc.value.sqlstate=='PT409'
    finish(turn_db,turn)
    turn_db.execute('UPDATE conversations SET archived_at=now() WHERE id=%s',(turn['conversation_id'],))
    with pytest.raises(psycopg.DatabaseError) as exc,turn_db.transaction(): reserve(turn_db,convo=turn['conversation_id'])
    assert exc.value.sqlstate=='PT409'


def test_tool_record_duplicate_and_late_writes_are_denied(turn_db):
    turn=reserve(turn_db)
    query="SELECT oracle_record_tool(%s,'call-test','get_ferry_schedule','{\"terminal\":\"sekupang\"}','{\"schedules\":[]}')"
    turn_db.execute(query,(turn['turn_id'],))
    with pytest.raises(errors.UniqueViolation),turn_db.transaction(): turn_db.execute(query,(turn['turn_id'],))
    finish(turn_db,turn)
    with pytest.raises(psycopg.DatabaseError) as exc,turn_db.transaction(): turn_db.execute(query,(turn['turn_id'],))
    assert exc.value.sqlstate=='PT409'


def test_anon_and_claimless_calls_cannot_reserve(turn_db):
    turn_db.execute('SET LOCAL ROLE anon')
    with pytest.raises(errors.InsufficientPrivilege),turn_db.transaction(): reserve(turn_db)
    turn_db.execute('SET LOCAL ROLE authenticated')
    turn_db.execute("SELECT set_config('request.jwt.claim.sub','',true)")
    with pytest.raises(psycopg.DatabaseError) as exc,turn_db.transaction(): reserve(turn_db)
    assert exc.value.sqlstate=='PT401'


def test_concurrent_duplicate_request_creates_one_turn(turn_database):
    request=uuid4()
    def worker():
        with psycopg.connect(turn_database) as conn:
            conn.execute('SET LOCAL ROLE authenticated')
            conn.execute("SELECT set_config('request.jwt.claim.sub',%s,true)",(USER_A,))
            try: return reserve(conn,request)
            except psycopg.DatabaseError as exc: return exc.sqlstate
    with ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(lambda _:worker(),range(2)))
    assert sum(isinstance(result,dict) for result in results)==1 and 'PT409' in results
    with psycopg.connect(turn_database,autocommit=True) as conn:
        row=conn.execute('SELECT conversation_id FROM chat_messages WHERE client_request_id=%s',(request,)).fetchone()
        assert conn.execute('SELECT count(*) FROM chat_messages WHERE conversation_id=%s',row).fetchone()[0]==2
        conn.execute('DELETE FROM conversations WHERE id=%s',row)


def test_context_skips_orphan_failed_and_oversized_turns():
    rows=[{'turn_id':'a','sequence':1,'role':'user','status':'completed','content':'Question'},
          {'turn_id':'a','sequence':2,'role':'assistant','status':'completed','content':'Answer','tool_calls':[]},
          {'turn_id':'b','sequence':3,'role':'assistant','status':'completed','content':'Orphan','tool_calls':[]},
          {'turn_id':'c','sequence':4,'role':'user','status':'failed','content':'Failed'},
          {'turn_id':'c','sequence':5,'role':'assistant','status':'failed','content':'Failed','tool_calls':[]}]
    assert paired_context(rows)==[{'role':'user','content':'Question'},{'role':'assistant','content':'Answer'}]
    assert paired_context(rows,budget=1)==[]
