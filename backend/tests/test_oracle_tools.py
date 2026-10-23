"""Oracle validation and provenance without provider/network calls."""

import json
from types import SimpleNamespace

import pytest
from services import oracle_tools as tools
from agent_config import TOOL_SCHEMAS


@pytest.mark.parametrize('name,args',[
    ('get_congestion_level',{'segment_id':'yos-sudarso','day_type':'weekday','hour':8}),
    ('get_congestion_level',{'segment_id':'SEG001','day_type':'weekday','hour':'8'}),
    ('get_congestion_level',{'segment_id':'SEG001','day_type':'weekend','hour':24}),
    ('get_optimal_route',{'origin':'1,104','destination':'2,104'}),
    ('get_optimal_route',{'origin':'NaN,104','destination':'2,104','time':'08:00','day_type':'weekday'}),
    ('get_optimal_route',{'origin':'91,104','destination':'2,104','time':'08:00','day_type':'weekday'}),
    ('get_optimal_route',{'origin':'1,104','destination':'2,104','time':'25:00','day_type':'weekday'}),
    ('get_optimal_route',{'origin':'1,104','destination':'2,104','time':'08:00','day_type':'weekday','vessel_etd':'18:00'}),
    ('get_ferry_schedule',{'terminal':'unknown'}),
    ('get_ferry_schedule',{'terminal':'sekupang','system':'injected'}),
])
def test_invalid_tool_inputs_are_rejected(name,args):
    with pytest.raises(ValueError): tools.validate_arguments(name,json.dumps(args))


def test_schemas_and_server_validators_share_the_same_tools():
    assert {entry['name'] for entry in TOOL_SCHEMAS}==set(tools.ARGUMENT_MODELS)
    route=next(entry for entry in TOOL_SCHEMAS if entry['name']=='get_optimal_route')['parameters_json_schema']
    assert {'time','day_type','origin','destination'}<=set(route['required'])


@pytest.mark.parametrize('source,status',[('ml_model','synthetic_estimate'),('database','database'),('fallback_default','default_fallback')])
def test_congestion_output_has_source_status_and_no_invented_freshness(monkeypatch,source,status):
    args={'segment_id':'SEG001','day_type':'weekend','hour':8}
    monkeypatch.setattr(tools,'get_congestion',lambda **kwargs:{'source':source,'congestion_level':'LOW','multiplier':1.07})
    output,result=tools.execute_tool('get_congestion_level',args)
    assert output['data_status']==status and output['source']==source and output['observed_at'] is None
    assert result.data.day_type=='weekend' and result.data.hour==8
    assert output['data']['segment_name']=='Jl. Yos Sudarso (Koridor Utama)'


def test_route_preserves_planning_and_legacy_single_route_result(monkeypatch):
    seen=[]
    def route(req):
        seen.append(req)
        return {'distance_km':5,'final_time_min':10,'routing_source':'Haversine Fallback',
            'matched_segment_id':'SEG002','matched_segment_name':'Updated Sudirman corridor',
            'planning_warning':'Route geometry matching found no segment; the congestion reference falls back to a corridor near the origin and may not represent the route traveled.',
            'route_geometry':{'type':'LineString','coordinates':[[104,1],[104,1.1]]}}
    monkeypatch.setattr(tools,'calculate_route',route)
    args=tools.validate_arguments('get_optimal_route',json.dumps({'origin':'1,104','destination':'1.1,104','time':'17:30','day_type':'weekend'}))
    output,result=tools.execute_tool('get_optimal_route',args)
    assert seen[0].day_type=='weekend' and seen[0].time=='17:30'
    assert 'route_geometry' not in output['data'] and output['data_status']=='estimated'
    assert output['data']['map_available']
    assert result.data.route_geometry.type=='LineString'
    assert 'route_options' not in output['data'] and 'default_route_id' not in output['data']
    assert '17:30' in output['disclaimer'] and 'measured' in output['disclaimer']
    assert 'see planning_warning' in output['disclaimer']
    assert output['data']['planning_warning']==result.data.planning_warning
    assert 'falls back to a corridor near the origin' in output['data']['planning_warning']
    assert output['data']['matched_segment_id']=='SEG002' and output['data']['matched_segment_name']=='Updated Sudirman corridor'


def test_oracle_route_tool_does_not_expose_planner_alternatives(monkeypatch):
    coordinates = [[104, 1], [104.1, 1.1]]
    monkeypatch.setattr(tools, 'calculate_route', lambda req: {
        'distance_km': 5, 'base_time_min': 10, 'final_time_min': 12,
        'routing_source': 'OSRM API', 'congestion_status': 'synthetic_estimate',
        'congestion_multiplier': 1.2, 'emission_kg': 1.2,
        'default_route_id': 'route-1', 'route_options': [{'route_id': 'route-1'}],
        'route_geometry': {'type': 'LineString', 'coordinates': coordinates},
    })
    args = tools.validate_arguments('get_optimal_route', json.dumps({
        'origin': '1,104', 'destination': '1.1,104', 'time': '17:30', 'day_type': 'weekday',
    }))

    output, result = tools.execute_tool('get_optimal_route', args)
    assert result is not None
    assert result.data.route_geometry.coordinates == [(104.0, 1.0), (104.1, 1.1)]
    assert 'route_options' not in output['data'] and 'default_route_id' not in output['data']
    assert 'route_geometry' not in output['data'] and output['data']['map_available']


def test_schedule_filter_empty_data_and_capacity_contract(monkeypatch):
    seen=[]
    class Query:
        def table(self,*args): return self
        def select(self,*args): return self
        def eq(self,*args): seen.append(args); return self
        def ilike(self,*args): seen.append(args); return self
        def order(self,*args): return self
        def limit(self,value): assert value==20; return self
        def execute(self): return SimpleNamespace(data=[{'terminal':'sekupang','terminal_name':'Sekupang','destination':'Singapore',
            'departure_time':'08:00:00','cutoff_time':None,'vessel_type':None,'cargo_capacity_tons':1}])
    monkeypatch.setattr(tools,'get_supabase_client',lambda:Query())
    output,result=tools.execute_tool('get_ferry_schedule',tools.validate_arguments('get_ferry_schedule','{"terminal":"Sekupang","destination":"Singapore"}'))
    assert seen==[('terminal','sekupang'),('destination','Singapore')]
    assert output['data']['schedules'][0]['cargo_capacity_tons']==1 and result.observed_at is None


def test_service_error_or_invalid_numeric_data_has_no_result(monkeypatch):
    monkeypatch.setattr(tools,'get_congestion',lambda **kwargs:{'congestion_level':'LOW','multiplier':float('nan')})
    output,result=tools.execute_tool('get_congestion_level',{'segment_id':'SEG001','day_type':'weekday','hour':8})
    assert output['code']=='tool_unavailable' and result is None
