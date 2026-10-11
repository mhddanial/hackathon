"""Actual congestion tool -> native provider loop -> SDK/RPC/RLS -> saved history.

Public tool transport, provider and Auth HTTP are synthetic. PostgreSQL is real.
"""
from types import SimpleNamespace as NS
from routers import agent, congestion
from test_oracle_agent import Provider, chunk, tool, send, install_lifecycle
from test_oracle_history import api, test_database_url, HEADERS_A, HEADERS_B, BASE


def test_congestion_result_persists_and_replays_with_no_tool_reexecution(api,monkeypatch):
    public_calls=[]
    class Query:
        def table(self,name): self.name=name; return self
        def select(self,*args): return self
        def eq(self,*args): return self
        def execute(self):
            public_calls.append(self.name)
            return NS(data=[{'corridor_type':'urban_arterial'}] if self.name=='road_segments' else [{'hour_start':0,'hour_end':24,'congestion_level':'LOW','multiplier':1.1}])
    monkeypatch.setattr(congestion,'get_supabase_client',Query)
    monkeypatch.setattr(congestion,'rf_model',None)
    provider=Provider([[chunk(tools=[tool(0,'get_congestion_level',{'segment_id':'SEG001','day_type':'weekend','hour':0},'congestion-call')],reason='tool_calls')],
        [chunk('Recorded estimate; freshness unverified.',reason='stop')]])
    monkeypatch.setattr(agent,'provider',provider)
    response,events,body=send(api)
    assert response.status_code==200 and events[-1]['persisted'] and events[-1]['outcome']=='completed'
    result=events[-2]['results'][0]
    assert result['source']=='database' and result['data_status']=='database' and result['observed_at'] is None
    assert result['data']['day_type']=='weekend' and result['data']['hour']==0 and 'unverified' in result['disclaimer']
    conversation=events[0]['conversation_id']
    saved=api[0].get(BASE+'/'+conversation+'/messages',headers=HEADERS_A).json()['messages']
    answer=next(row for row in saved if row['role']=='assistant')
    assert answer['structured_results']==[result] and len(answer['tool_calls'])==1
    assert api[0].post('/agent/chat',json=body,headers=HEADERS_A).status_code==200
    assert public_calls==['road_segments','congestion_multipliers'] and len(provider.calls)==2
    assert api[0].get(BASE+'/'+conversation+'/messages',headers=HEADERS_B).status_code==404
    foreign={**body,'client_request_id':'00000000-0000-4000-8000-000000000999','conversation_id':conversation}
    assert api[0].post('/agent/chat',json=foreign,headers=HEADERS_B).status_code==404
    provider.rounds.append([chunk('Previously recorded estimate remains uncertain.',reason='stop')])
    send(api,message='Explain the saved estimate',convo=conversation)
    assert public_calls==['road_segments','congestion_multipliers']
    assert any('Previously recorded tool data' in part.get('text','') for message in provider.calls[-1]['contents'] for part in message['parts'])


def test_actual_congestion_outage_saves_tool_error_and_no_recommendation(api,monkeypatch):
    def unavailable(): raise RuntimeError('private upstream diagnostic')
    monkeypatch.setattr(congestion,'get_supabase_client',unavailable)
    provider=Provider([[chunk(tools=[tool(0,'get_congestion_level',{'segment_id':'SEG001','day_type':'weekday','hour':8},'failed-congestion')],reason='tool_calls')],
        [chunk('Congestion data is unavailable; no estimate is confirmed.',reason='stop')]])
    monkeypatch.setattr(agent,'provider',provider)
    _,events,_=send(api)
    assert events[-1]['persisted'] and events[-1]['outcome']=='completed'
    assert not any(event['type']=='result' for event in events)
    rows=api[0].get(BASE+'/'+events[0]['conversation_id']+'/messages',headers=HEADERS_A).json()['messages']
    output=next(row for row in rows if row['role']=='tool')['tool_result']
    assert output['code']=='tool_unavailable' and 'private' not in str(rows)
    assert next(row for row in rows if row['role']=='assistant')['structured_results']==[]
