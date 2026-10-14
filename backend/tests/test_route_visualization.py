"""Named route tools, date-aware cutoffs, bounded saved maps and provider summaries."""
import json
import math
from types import SimpleNamespace as NS

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import TypeAdapter, ValidationError

from locations import LOCATIONS, resolve_location, LocationError
from route_geometry import compact_geometry
from routers import route
from schemas.oracle import OracleResult
from services import oracle_tools as tools

BASE = {'origin': 'Batamindo Industrial Park', 'destination': 'Batu Ampar Port', 'time': '10 AM WIB',
    'day_type': 'Weekday', 'cargo_type': 'fast freight', 'vessel_etd': '2024-01-01T12:00:00Z'}


@pytest.fixture
def routing(monkeypatch):
    calls = []
    def request(url, **kwargs):
        calls.append(url)
        return NS(status_code=200, json=lambda: {'routes': [{'distance': 5000, 'duration': 600,
            'geometry': {'type': 'LineString', 'coordinates': [[104.030321,1.06048],[104.02,1.08],[104.01,1.13],[104.002488,1.162951]]}}]})
    monkeypatch.setattr(route.requests, 'get', request)
    monkeypatch.setattr(route, 'find_closest_segment', lambda *args: None)
    return calls


@pytest.mark.parametrize('row', LOCATIONS)
def test_catalog_names_ids_aliases_resolve_to_same_point(row):
    for name in [row['name'], row['id'], *row['aliases']]:
        assert resolve_location(name.upper()) == row


@pytest.mark.parametrize('label,code', [('Terminal','location_ambiguous'),('Singapore','location_unknown'),('-1,104','outside_coverage')])
def test_unresolved_location_returns_clarification_without_routing(routing, label, code):
    args = tools.validate_arguments('get_optimal_route', json.dumps({**BASE, 'origin': label}))
    output, result = tools.execute_tool('get_optimal_route', args)
    assert result is None and output['code'] == code and output['choices'] and not routing


def test_named_route_preserves_date_geometry_and_planning_inputs(routing):
    args = tools.validate_arguments('get_optimal_route', json.dumps(BASE))
    output, result = tools.execute_tool('get_optimal_route', args)
    assert result is not None
    data = result.model_dump(mode='json')['data']
    assert data['origin_name'] == 'Batamindo Industrial Park' and data['destination_name'] == 'Batu Ampar Port'
    assert data['origin']['lat'] == resolve_location(BASE['origin'])['lat']
    assert data['departure_time'] == '10:00' and data['cargo_type'] == 'FAST_FREIGHT'
    assert data['vessel_etd'] == '2024-01-01T19:00:00+07:00' and data['departure_date'] == '2024-01-01'
    assert data['latest_gate_in_datetime'] == '2024-01-01T18:00:00+07:00'
    assert data['optimal_departure_datetime'] == '2024-01-01T17:50:00+07:00' and data['departure_feasible']
    assert 'inferred' in data['planning_warning'] and data['matched_segment_id'] is None
    assert data['congestion_level'] is None and data['congestion_status'] == 'unavailable'
    assert data['route_geometry']['coordinates'][0] == [104.030321,1.06048]
    assert 'route_geometry' not in output['data'] and output['data']['map_available']
    assert len(result.model_dump_json().encode()) < 16000 and len(json.dumps(output).encode()) < 16000
    assert 'https://' in routing[0] and 'overview=simplified' in routing[0]


@pytest.mark.parametrize('time,feasible', [('22:00',True),('23:40',False)])
def test_midnight_cutoff_keeps_calendar_day(routing,time,feasible):
    args = tools.validate_arguments('get_optimal_route', json.dumps({**BASE, 'time':time,
        'departure_date':'2024-01-01','vessel_etd':'2024-01-02T00:30:00+07:00'}))
    _, result = tools.execute_tool('get_optimal_route',args)
    data = result.model_dump(mode='json')['data']
    assert data['latest_gate_in_datetime']=='2024-01-01T23:30:00+07:00'
    assert data['optimal_departure_datetime']=='2024-01-01T23:20:00+07:00'
    assert data['departure_feasible'] is feasible


def test_clock_only_cross_midnight_requests_date(routing):
    args = tools.validate_arguments('get_optimal_route',json.dumps({**BASE,'vessel_etd':'00:30'}))
    output, result = tools.execute_tool('get_optimal_route',args)
    assert result is None and output['code']=='route_parameters' and 'timestamp' in output['error']


@pytest.mark.parametrize('overrides', [
    {'departure_date':'2024-02-30'}, {'departure_date':'2024-01-06'},
    {'vessel_etd':'2024-01-01T12:00:00'}, {'time':'25:00'}, {'cargo_type':'truck'}, {'vessel_etd':None},
])
def test_invalid_or_conflicting_planning_is_rejected(overrides):
    with pytest.raises(ValueError): tools.validate_arguments('get_optimal_route',json.dumps({**BASE,**overrides}))


def test_osrm_outage_keeps_explicit_approximate_connection(routing, monkeypatch):
    monkeypatch.setattr(route.requests,'get',lambda *args,**kwargs: NS(status_code=503))
    _, result = tools.execute_tool('get_optimal_route', tools.validate_arguments('get_optimal_route',json.dumps(BASE)))
    data = result.model_dump(mode='json')['data']
    assert data['routing_source']=='Haversine Fallback' and len(data['route_geometry']['coordinates'])==2
    assert data['route_geometry']['coordinates'][0]==[data['origin']['lng'], data['origin']['lat']]


def test_geometry_simplification_preserves_endpoints_and_bounded_valid_points():
    points = [[104+i*0.00001,1+math.sin(i/10)*0.001] for i in range(5000)]
    compact = compact_geometry({'type':'LineString','coordinates':points})
    assert 2 <= len(compact['coordinates']) <= 160
    assert compact['coordinates'][0]==[round(x,6) for x in points[0]]
    assert compact['coordinates'][-1]==[round(x,6) for x in points[-1]]
    assert compact_geometry({'type':'LineString','coordinates':[[104,1],[True,1]]}) is None
    assert compact_geometry({'type':'LineString','coordinates':[[104,1],[104,float('nan')]]}) is None


def test_direct_route_rejects_outside_area_before_request(routing):
    app=FastAPI(); app.include_router(route.router,prefix='/route')
    with TestClient(app) as client:
        response=client.post('/route',json={'origin':{'lat':-1,'lng':104},'destination':{'lat':1.1,'lng':104},'time':'10:00','day_type':'weekday'})
    assert response.status_code==422 and not routing


def test_missing_or_distant_corridor_does_not_fabricate_id(monkeypatch):
    class Query:
        def table(self,*args): return self
        def select(self,*args): return self
        def execute(self): return NS(data=[{'segment_id':'SEG001','start_lat':0,'end_lat':0,'start_lng':100,'end_lng':100}])
    monkeypatch.setattr(route,'get_supabase_client',Query)
    assert route.find_closest_segment(1.1,104) is None
    assert route.get_ml_congestion(None,'weekday',8)['level'] is None


def test_native_tool_loop_saves_map_but_does_not_send_geometry_to_model(monkeypatch,routing):
    from test_oracle_provider import WireProvider, answer, call, run
    args = {**BASE,'time':'10:00','day_type':'weekday','cargo_type':'FAST_FREIGHT'}
    provider=WireProvider([[answer(calls=[call(name='get_optimal_route',args=args)])],[answer('Mapped route estimate with explicit planning time.')]])
    events,store=run(provider,monkeypatch,message='Estimate a route from Batamindo to Batu Ampar for fast freight at 10 AM WIB, weekday, vessel ETD 2024-01-01T12:00:00Z.')
    result=next(event for event in events if event['type']=='result')['results'][0]
    assert result['data']['route_geometry']['type']=='LineString'
    assert store.saved[-1]['results'][0].data.origin_name=='Batamindo Industrial Park'
    response=provider.requests[1]['contents'][-1]['parts'][0]['functionResponse']['response']
    assert 'route_geometry' not in response['data'] and response['data']['map_available']
    assert events[-1]['persisted'] and events[-1]['outcome']=='completed'
