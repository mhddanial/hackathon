"""HTTP and tool integration against fixed routing/congestion; no network/DB."""
from datetime import datetime
import json
from types import SimpleNamespace as NS

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
import pytest

from locations import resolve_location
from routers import route
from schemas.oracle import RouteData as OracleRouteData
from schemas.route import RouteData
from services import oracle_tools as tools
from services.oracle_route_context import route_context


BASE = {'origin': 'Batamindo', 'destination': 'Batu Ampar Port', 'time': '10:00', 'day_type': 'weekday'}


@pytest.fixture
def fixed(monkeypatch):
    monkeypatch.setattr(route.requests, 'get', lambda *a, **k: NS(status_code=200, json=lambda: {'routes': [
        {'distance': 5000, 'duration': 600, 'geometry': {'type': 'LineString', 'coordinates': [[104.030321, 1.06048], [104.002488, 1.162951]]}}]}))
    monkeypatch.setattr(route, 'find_closest_segment', lambda *a: 'SEG001')
    monkeypatch.setattr(route, 'get_ml_congestion', lambda *a: {'level': 'HIGH', 'multiplier': 1.5, 'segment_name': 'Yos Sudarso', 'status': 'synthetic_estimate'})


@pytest.mark.parametrize('extra', [{}, {'cargo_type': 'FAST_FREIGHT', 'vessel_etd': '2024-01-01T12:00:00Z'},
    {'time': '23:20', 'departure_date': '2024-01-01', 'cargo_type': 'CONTAINER', 'vessel_etd': '2024-01-02T01:30:00+07:00'}])
def test_http_and_oracle_have_equivalent_validated_calculations(fixed, extra):
    args = tools.validate_arguments('get_optimal_route', json.dumps({**BASE, **extra}))
    _, result = tools.execute_tool('get_optimal_route', args)
    assert result is not None
    payload = {**args}
    for field in ('origin', 'destination'):
        location = resolve_location(payload[field])
        payload[field] = {key: location[key] for key in ('lat', 'lng')}
        payload[field + '_name'] = location['name']
    app = FastAPI(); app.include_router(route.router, prefix='/route')
    with TestClient(app) as client:
        response = client.post('/route', json=payload)
    assert response.status_code == 200
    actual = response.json(); expected = result.data.model_dump(mode='json')
    actual.pop('calculation_time'); expected.pop('calculation_time')
    assert actual == expected
    assert actual['final_time_min'] == 15 and actual['distance_km'] == 5 and actual['emission_kg'] == 1.5


@pytest.mark.parametrize('time,slack,feasible', [('23:14', 1, True), ('23:15', 0, True), ('23:16', -1, False)])
def test_cutoff_slack_and_arrival_use_calendar_and_exact_boundary(fixed, time, slack, feasible):
    _, result = tools.execute_tool('get_optimal_route', {**BASE, 'time': time,
        'departure_date': '2024-01-01', 'cargo_type': 'CONTAINER', 'vessel_etd': '2024-01-02T01:30:00+07:00'})
    assert result.data.cutoff_slack_min == slack
    assert result.data.departure_feasible is feasible
    assert result.data.estimated_arrival_datetime.date().isoformat() == '2024-01-01'
    assert result.data.latest_gate_in_datetime.isoformat() == '2024-01-01T23:30:00+07:00'


def test_route_only_date_and_clock_only_do_not_invent_calendar(fixed):
    _, route_only = tools.execute_tool('get_optimal_route', {**BASE, 'departure_date': '2024-01-01'})
    assert route_only.data.estimated_arrival_datetime.isoformat() == '2024-01-01T10:15:00+07:00'
    assert route_only.data.cutoff_slack_min is None
    _, clock = tools.execute_tool('get_optimal_route', {**BASE, 'cargo_type': 'FAST_FREIGHT', 'vessel_etd': '11:00'})
    assert clock.data.estimated_arrival_datetime is None
    assert clock.data.estimated_arrival_time == '10:15' and clock.data.cutoff_slack_min == -15


def history(args, output, call_id='route-a', turn='turn-a'):
    return [{'role': 'user', 'content': 'A route request'},
        {'role': 'assistant', 'tool_calls': [{'id': call_id, 'function': {'name': 'get_optimal_route', 'arguments': json.dumps(args)}}]},
        {'role': 'tool', 'tool_call_id': call_id, 'turn_id': turn, 'content': json.dumps(output)},
        {'role': 'assistant', 'content': 'Route estimate.'}]


def test_context_uses_validated_paired_success_and_resolved_date(fixed):
    args = {**BASE, 'cargo_type': 'FAST_FREIGHT', 'vessel_etd': '2024-01-01T12:00:00Z'}
    output, _ = tools.execute_tool('get_optimal_route', args)
    context = route_context(history(args, output))
    assert context['status'] == 'available'
    plan = context['plans'][0]
    assert plan['source_turn_id'] == 'turn-a' and plan['inputs']['departure_date'] == '2024-01-01'
    assert plan['departure_date_inferred'] is True
    assert 'not proof' in plan['provenance']
    assert route_context(history(args, {'error': 'unavailable'})) is None
    assert route_context(history({**args, 'time': '25:00'}, output)) is None


def test_latest_turn_multiple_routes_require_selection(fixed):
    first, _ = tools.execute_tool('get_optimal_route', BASE)
    second_args = {**BASE, 'time': '11:00'}
    second, _ = tools.execute_tool('get_optimal_route', second_args)
    messages = history(BASE, first)
    messages[1]['tool_calls'].append(history(second_args, second, 'route-b')[1]['tool_calls'][0])
    messages.insert(3, history(second_args, second, 'route-b')[2])
    assert route_context(messages)['status'] == 'choose_plan'
    newest = route_context(messages + history(second_args, second, 'route-c', 'turn-c'))
    assert newest['status'] == 'available' and newest['plans'][0]['source_call_id'] == 'route-c'


def test_contract_is_shared_and_historical_results_still_validate():
    assert OracleRouteData is RouteData
    assert RouteData(distance_km=0, final_time_min=0, routing_source='legacy').cutoff_slack_min is None
    with pytest.raises(ValidationError): RouteData(distance_km=1, final_time_min=1, routing_source='x', cutoff_slack_min=float('nan'))


def test_cross_period_suggestion_is_explicit(fixed):
    _, result = tools.execute_tool('get_optimal_route', {**BASE, 'cargo_type': 'FAST_FREIGHT', 'vessel_etd': '18:00'})
    assert 'recalculate' in result.data.planning_warning


def test_clock_only_arrival_crossing_midnight_requires_date(fixed):
    output, result = tools.execute_tool('get_optimal_route', {**BASE, 'time': '23:55', 'cargo_type': 'FAST_FREIGHT', 'vessel_etd': '23:50'})
    assert result is None and output['code'] == 'route_parameters' and 'arrival crossing midnight' in output['error']


def test_native_provider_receives_typed_route_reference_and_saves_new_estimate(fixed, monkeypatch):
    from test_oracle_provider import WireProvider, answer, call, run
    output, _ = tools.execute_tool('get_optimal_route', BASE)
    provider = WireProvider([[answer(calls=[call(name='get_optimal_route', args={**BASE, 'time': '11:00'})])],
        [answer('Updated to 11:00; other route inputs inherited from the previous estimate.')]])
    events, store = run(provider, monkeypatch, history=history(BASE, output), message='Change my road departure to 11 AM.')
    references = [p['text'] for p in provider.requests[0]['contents'][-1]['parts'] if 'Route planning reference' in p.get('text', '')]
    reference = json.loads(references[0].split(': ', 1)[1])
    assert reference['status'] == 'available' and reference['plans'][0]['source_turn_id'] == 'turn-a'
    assert reference['plans'][0]['inputs']['time'] == '10:00'
    assert store.saved[-1]['results'][0].data.departure_time == '11:00'
    assert events[-1]['persisted'] and events[-1]['outcome'] == 'completed'
