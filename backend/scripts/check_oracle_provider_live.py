"""Live Gemini/Oracle checks with public tools and an in-memory turn store.

This consumes provider quota. It does not log in, write history, or test JWT/RLS.
Run from the repository root with --output <sanitized-json-path>.
"""
import argparse
import asyncio
import json
from pathlib import Path
from types import SimpleNamespace
from time import perf_counter
from uuid import uuid4
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend'))
from dotenv import load_dotenv
load_dotenv(ROOT / 'backend/.env')
from routers import agent
from services.oracle_turns import ReservedTurn, SavedTurn


class MemoryStore:
    def __init__(self): self.calls=[]; self.saved=None
    def record_tool(self, turn, call): self.calls.append(call)
    def finish(self, turn, **values):
        self.saved=values
        return SavedTurn(message_id=turn.assistant_message_id,outcome=values['outcome'])


class Request:
    def __init__(self, prompt): self.state=SimpleNamespace(oracle_message=prompt)
    async def is_disconnected(self): return False


async def run_case(name, prompt, context=None):
    turn=ReservedTurn(conversation_id=uuid4(),turn_id=uuid4(),user_message_id=uuid4(),assistant_message_id=uuid4(),
        replay=False,outcome='in_progress',content=None,tool_calls=[],results=[])
    store=MemoryStore(); events=[]; start=perf_counter(); first=None
    async for wire in agent.stream_turn(turn,store,context or [],Request(prompt)):
        event=json.loads(wire.removeprefix('data: ').strip()); events.append(event)
        if first is None and event['type']=='chunk': first=round(perf_counter()-start,3)
    elapsed=round(perf_counter()-start,3)
    terminal=events[-1]
    success=terminal['type']=='done' and terminal['outcome']=='completed' and terminal['persisted'] and bool(store.saved)
    return {'name':name,'prompt':prompt,'completed_in_memory':success,'elapsed_seconds':elapsed,'first_text_seconds':first,
        'tools':[{'name':call.name,'arguments':call.arguments,'error_code':call.output.get('code')} for call in store.calls],
        'results':[{'type':result.type,'source':result.source,'data_status':result.data_status,'observed_at':result.observed_at,'disclaimer':result.disclaimer} for result in (store.saved or {}).get('results',[])],
        'event_types':[event['type'] for event in events],'answer':(store.saved or {}).get('content','')[:4000]},store


async def check():
    if agent.provider is None: raise RuntimeError('Provider not configured')
    cases=[]
    prompt='Check SEG001 congestion on a weekday at 08:00 Asia/Jakarta and recorded ferry departures from Batu Ampar. Use both registered tools and distinguish synthetic estimates from recorded schedules with unknown freshness.'
    result,stored=await run_case('congestion_and_schedule',prompt); cases.append(result)
    if not result['completed_in_memory']:
        return {'scope':'Live Gemini plus public tools; failed turn recorded only in memory, no JWT/history persistence.',
            'requested_model':agent.provider.model,'samples_per_case':1,'samples':1,'cases':cases,
            'checks':{'all_completed_in_memory':False},
            'limitations':['Stopped after the failed initial turn; follow-up and guardrail cases were skipped.', 'No automatic provider retry or signed-in persistence test.']}
    context=[{'role':'user','content':prompt}]
    for call in stored.calls:
        context += [{'role':'assistant','content':None,'tool_calls':[{'id':call.id,'type':'function','function':{'name':call.name,'arguments':json.dumps(call.arguments)}}]},
            {'role':'tool','tool_call_id':call.id,'content':json.dumps(call.output)}]
    context.append({'role':'assistant','content':(stored.saved or {}).get('content','')})
    follow,_=await run_case('saved_reference_followup','Explain why the previously recorded congestion estimate should not be treated as live traffic. Use only the saved result; do not refetch.',context); cases.append(follow)
    missing,_=await run_case('missing_route_inputs','Please find the best route for my delivery.'); cases.append(missing)
    unrelated,_=await run_case('unrelated_request','Write a fantasy story about a dragon.'); cases.append(unrelated)
    return {'scope':'Live Gemini plus public Supabase tools; terminal acknowledgments use an in-memory store, not HTTP login or database history persistence.',
        'requested_model':agent.provider.model,'samples_per_case':1,'samples':len(cases),'cases':cases,
        'checks':{'all_completed_in_memory':all(case['completed_in_memory'] for case in cases),
            'both_tools_used':{'get_congestion_level','get_ferry_schedule'} <= {item['name'] for item in result['tools']},
            'both_validated_result_types':{'congestion','schedule'} <= {item['type'] for item in result['results']},
            'followup_no_refetch':not follow['tools'],'missing_inputs_no_invented_tool_args':not missing['tools'],
            'unrelated_request_no_tools':not unrelated['tools']},
        'limitations':['One sample per prompt; latency is not a benchmark.','Clarification and domain-response wording require review; no universal model adherence claim.','No signed-in HTTP, Supabase JWT or database persistence tested.']}


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__); parser.add_argument('--output',required=True,type=Path)
    args=parser.parse_args()
    try: evidence=asyncio.run(check())
    except Exception: raise SystemExit('Live provider check failed; inspect service availability without exposing credentials.') from None
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(evidence,indent=2,default=str)+'\n',encoding='utf-8')
    print(json.dumps({'checks':evidence['checks'],'latencies_seconds':[case['elapsed_seconds'] for case in evidence['cases']],'output':str(args.output)}))
    if not all(evidence['checks'].values()): raise SystemExit(1)
