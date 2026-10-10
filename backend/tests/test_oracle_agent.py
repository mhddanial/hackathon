"""Streaming API + actual SDK/RPC/PostgreSQL lifecycle with a fake provider."""

import asyncio
import json
import time
from types import SimpleNamespace as NS
from uuid import uuid4

import psycopg
import pytest
from google.genai import types

from routers import agent
from schemas.oracle import DoneEvent
from services.oracle_turns import ReservedTurn
from services.oracle_provider import GeminiProvider
from test_oracle_history import api, test_database_url, HEADERS_A, HEADERS_B, BASE, create
from test_oracle_rls import ROOT


@pytest.fixture(scope='module',autouse=True)
def install_lifecycle(test_database_url):
    with psycopg.connect(test_database_url,autocommit=True) as conn:
        conn.execute(next((ROOT/'supabase/migrations').glob('*_oracle_turn_lifecycle.sql')).read_text())


def chunk(content=None,tools=None,reason=None):
    parts=([types.Part.from_text(text=content)] if content else []) + (tools or [])
    return types.GenerateContentResponse(candidates=[types.Candidate(
        content=types.Content(role='model',parts=parts),
        finish_reason={'stop':'STOP','tool_calls':'STOP','length':'MAX_TOKENS'}.get(reason,reason))])


def tool(index,name=None,args=None,identifier=None):
    try: args=json.loads(args) if isinstance(args,str) else args
    except ValueError: pass
    # Malformed SDK/provider payloads must still fail at the Oracle boundary.
    return types.Part(function_call=types.FunctionCall.model_construct(id=identifier,name=name,args=args))


class FakeStream:
    def __init__(self,chunks): self.chunks=chunks; self.closed=False; self.iterator=self.generate()
    def __aiter__(self): return self.iterator
    async def aclose(self):
        await self.iterator.aclose(); self.closed=True
    async def generate(self):
        try:
            for item in self.chunks:
                if isinstance(item,BaseException): raise item
                if callable(item): item=item()
                yield item
        finally: self.closed=True


class Provider(GeminiProvider):
    def __init__(self,rounds):
        super().__init__('synthetic-provider-key')
        self.rounds=list(rounds); self.calls=[]; self.streams=[]
        self.closed_clients=0
    def create_client(self):
        return NS(aio=NS(models=NS(generate_content_stream=self.create),aclose=self.close_async),close=lambda:None)
    async def close_async(self): self.closed_clients+=1
    async def create(self,**kwargs):
        self.calls.append(json.loads(json.dumps(kwargs,default=lambda item:item.model_dump(mode='json',exclude_none=True))))
        stream=FakeStream(self.rounds.pop(0)); self.streams.append(stream)
        return stream


def send(api,message='Logistics question',convo=None,request_id=None,headers=HEADERS_A):
    body={'message':message,'client_request_id':str(request_id or uuid4())}
    if convo: body['conversation_id']=convo
    response=api[0].post('/agent/chat',json=body,headers=headers)
    events=[json.loads(line[6:]) for line in response.text.splitlines() if line.startswith('data: ')]
    return response,events,body


def test_direct_answer_is_saved_before_completed_done_and_retry_replays(api,monkeypatch):
    provider=Provider([[chunk('Hello '),chunk('logistics!',reason='stop')]])
    monkeypatch.setattr(agent,'provider',provider)
    response,events,body=send(api)
    assert response.status_code==200 and response.headers['content-type'].startswith('text/event-stream')
    assert [event['type'] for event in events]==['metadata','chunk','chunk','done']
    done=DoneEvent.model_validate(events[-1])
    assert done.persisted and done.outcome=='completed'
    messages=api[0].get(BASE+'/'+events[0]['conversation_id']+'/messages',headers=HEADERS_A).json()['messages']
    assert [message['role'] for message in messages]==['user','assistant']
    assert messages[-1]['content']=='Hello logistics!' and messages[-1]['status']=='completed'
    retry=api[0].post('/agent/chat',json=body,headers=HEADERS_A)
    replay=[json.loads(line[6:]) for line in retry.text.splitlines() if line.startswith('data: ')]
    assert replay[-1]==events[-1] and len(provider.calls)==1
    assert all(stream.closed for stream in provider.streams)
    assert all(transport.is_closed for transport in api[3]['transports'])


def test_successive_native_tools_and_multiple_saved_results(api,monkeypatch):
    from schemas.oracle import GenericResult
    provider=Provider([
        [chunk(tools=[tool(0,'get_ferry_schedule','{"terminal":"sekupang"}','call-a')],reason='tool_calls')],
        [chunk(tools=[tool(0,'get_congestion_level','{"segment_id":"SEG001","day_type":"weekday","hour":8}','call-b')],reason='tool_calls')],
        [chunk('Recorded estimates.',reason='stop')],
    ])
    monkeypatch.setattr(agent,'provider',provider)
    result=GenericResult(type='generic',title='Test result',source='database',data_status='database',disclaimer='Synthetic fixture',data={'count':1})
    monkeypatch.setattr(agent,'execute_tool',lambda name,args:(result.model_dump(mode='json'),result))
    _,events,_=send(api)
    assert events[-1]['outcome']=='completed' and events[-2]['type']=='result' and len(events[-2]['results'])==2
    conv=events[0]['conversation_id']
    messages=api[0].get(BASE+'/'+conv+'/messages',headers=HEADERS_A).json()['messages']
    assert sum(message['role']=='tool' for message in messages)==2
    assistant=next(message for message in messages if message['role']=='assistant')
    assert len(assistant['tool_calls'])==len(assistant['structured_results'])==2
    # Follow-up restores the persisted calls with paired tool replies.
    provider.rounds.append([chunk('Follow-up.',reason='stop')])
    send(api,message='Follow-up question',convo=conv)
    context=provider.calls[-1]['contents']
    assert provider.calls[-1]['config']['system_instruction']
    assert sum('Previously recorded tool data' in part.get('text','') for message in context for part in message['parts'])==2
    assert context[-1]=={'role':'user','parts':[{'text':'Follow-up question'}]}
    assert not any('function_call' in part for message in context for part in message['parts'])


@pytest.mark.parametrize('raw,name',[('{broken','get_ferry_schedule'),('[]','get_ferry_schedule'),('{"terminal":"sekupang","user_id":"forged"}','get_ferry_schedule'),('{}','unknown_tool')])
def test_bad_tool_calls_fail_safely_without_executing_or_creating_results(api,monkeypatch,raw,name):
    provider=Provider([[chunk(tools=[tool(0,name,raw,'bad-call')],reason='tool_calls')]])
    monkeypatch.setattr(agent,'provider',provider)
    monkeypatch.setattr(agent,'execute_tool',lambda *args:pytest.fail('Invalid call executed'))
    _,events,body=send(api)
    assert events[-1]['outcome']=='failed' and events[-1]['persisted'] and not any(event['type']=='result' for event in events)
    before=len(provider.calls)
    retry=api[0].post('/agent/chat',json=body,headers=HEADERS_A)
    assert '"outcome":"failed"' in retry.text and len(provider.calls)==before


@pytest.mark.parametrize('kind',['unconfigured','provider_failure','empty','truncated','tool_limit'])
def test_failure_paths_have_consistent_sse_and_saved_failure(api,monkeypatch,kind):
    if kind=='unconfigured': provider=None
    elif kind=='provider_failure': provider=Provider([[chunk('Partial'),RuntimeError('private provider diagnostic')]])
    elif kind=='empty': provider=Provider([[chunk(reason='stop')]])
    elif kind=='truncated': provider=Provider([[chunk('Partial',reason='length')]])
    else:
        provider=Provider([[chunk(tools=[tool(0,'get_ferry_schedule','{"terminal":"sekupang"}',f'call-{i}')],reason='tool_calls')] for i in range(4)])
        monkeypatch.setattr(agent,'execute_tool',lambda *args:({'schedules':[]},None))
    monkeypatch.setattr(agent,'provider',provider)
    response,events,_=send(api)
    assert response.status_code==200 and events[-1]['outcome']=='failed' and events[-1]['persisted']
    assert 'private' not in response.text and any(event['type']=='error' for event in events)


def test_save_failure_never_acknowledges_success(api,monkeypatch):
    def fail_save(): api[3]['error']='database'; return chunk('Provisional answer',reason='stop')
    monkeypatch.setattr(agent,'provider',Provider([[fail_save]]))
    _,events,_=send(api)
    assert events[-1]['outcome']=='failed' and not events[-1]['persisted'] and events[-1]['message_id'] is None


def test_db_failure_prevents_provider_work_before_stream(api,monkeypatch):
    provider=Provider([]); monkeypatch.setattr(agent,'provider',provider); api[3]['error']='database'
    response,events,_=send(api)
    assert response.status_code==503 and not events and provider.calls==[]


def test_foreign_id_and_missing_or_expired_auth_never_call_provider(api,monkeypatch):
    foreign=create(api,headers=HEADERS_B)
    provider=Provider([]); monkeypatch.setattr(agent,'provider',provider)
    response=send(api,convo=foreign['id'])[0]
    assert response.status_code==404, response.text
    for headers in ({},{'Authorization':'Bearer expired-token'}): assert send(api,headers=headers)[0].status_code==401
    assert provider.calls==[]


def test_chat_request_rejects_legacy_or_forged_body(api):
    assert api[0].post('/agent/chat',json={'message':'Legacy'},headers=HEADERS_A).status_code==422
    assert api[0].post('/agent/chat',json={'message':'Valid','client_request_id':str(uuid4()),'user_id':'forged'},headers=HEADERS_A).status_code==422


def test_generator_close_marks_interrupted_and_closes_provider(monkeypatch):
    turn=ReservedTurn(conversation_id=uuid4(),turn_id=uuid4(),user_message_id=uuid4(),assistant_message_id=uuid4(),
        replay=False,outcome='in_progress',content=None,tool_calls=[],results=[])
    saved=[]
    class Store:
        def finish(self,turn,**kwargs): saved.append(kwargs); return None
    class Request:
        state=NS(oracle_message='Question')
        async def is_disconnected(self): return False
    provider=Provider([[chunk('Partial')]])
    monkeypatch.setattr(agent,'provider',provider)
    async def check():
        stream=agent.stream_turn(turn,Store(),[],Request())
        await anext(stream)
        await anext(stream)
        await stream.aclose()
    asyncio.run(check())
    assert saved[-1]['outcome']=='interrupted' and saved[-1]['content']=='Partial'
    assert provider.streams[0].closed


def test_asgi_send_disconnect_closes_generator_before_dependency_cleanup(monkeypatch):
    turn=ReservedTurn(conversation_id=uuid4(),turn_id=uuid4(),user_message_id=uuid4(),assistant_message_id=uuid4(),
        replay=False,outcome='in_progress',content=None,tool_calls=[],results=[])
    saved=[]
    class Store:
        def finish(self,turn,**kwargs): saved.append(kwargs)
    class Request:
        state=NS(oracle_message='Question')
        async def is_disconnected(self): return False
    monkeypatch.setattr(agent,'provider',Provider([[chunk('Partial')]]))
    async def check():
        response=agent.OracleStreamingResponse(agent.stream_turn(turn,Store(),[],Request()))
        calls=0
        async def send(message):
            nonlocal calls
            if message['type']=='http.response.body':
                calls+=1
                if calls==2: raise OSError('Disconnected')
        async def receive(): return {'type':'http.request'}
        from starlette.requests import ClientDisconnect
        with pytest.raises(ClientDisconnect):
            await response({'type':'http','asgi':{'spec_version':'2.4'}},receive,send)
    asyncio.run(check())
    assert saved[-1]['outcome']=='interrupted'


def test_tool_timeout_produces_an_error_output_without_a_result_card(api,monkeypatch):
    provider=Provider([[chunk(tools=[tool(0,'get_ferry_schedule','{"terminal":"sekupang"}','timeout-call')],reason='tool_calls')],
        [chunk('The schedule could not be retrieved.',reason='stop')]])
    monkeypatch.setattr(agent,'provider',provider)
    monkeypatch.setattr(agent,'TOOL_TIMEOUT',0.01)
    def slow(*args): time.sleep(0.05); return {'schedules':[]},None
    monkeypatch.setattr(agent,'execute_tool',slow)
    _,events,_=send(api)
    assert events[-1]['outcome']=='completed' and not any(event['type']=='result' for event in events)
    reply=next(part['function_response'] for message in provider.calls[-1]['contents'] for part in message['parts'] if 'function_response' in part)
    assert reply['response']['code']=='tool_timeout'


def test_overall_deadline_saves_failure(api,monkeypatch):
    class SlowProvider(Provider):
        async def create(self,**kwargs):
            await asyncio.sleep(0.1)
            return await super().create(**kwargs)
    monkeypatch.setattr(agent,'provider',SlowProvider([[chunk('Late answer',reason='stop')]]))
    monkeypatch.setattr(agent,'TURN_TIMEOUT',0.01)
    _,events,_=send(api)
    assert events[-1]['outcome']=='failed' and events[-1]['persisted']
