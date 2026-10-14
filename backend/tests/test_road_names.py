"""Readable road labels preserve internal IDs, route estimates, and old history."""
from types import SimpleNamespace

import pytest
from pydantic import TypeAdapter, ValidationError

from routers import route
from schemas.oracle import OracleResult


@pytest.mark.parametrize('rows', [
    [{'name': 'Updated Sudirman corridor', 'corridor_type': 'urban_arterial'}],
    [],
])
def test_route_name_uses_existing_reference_query_without_changing_estimates(monkeypatch, rows):
    selected = []
    class Query:
        def table(self, table): assert table == 'road_segments'; return self
        def select(self, columns): selected.append(columns); return self
        def eq(self, column, value): assert (column, value) == ('segment_id', 'SEG002'); return self
        def execute(self): return SimpleNamespace(data=rows)
    monkeypatch.setattr(route, 'get_supabase_client', Query)
    monkeypatch.setattr(route, 'find_closest_segment', lambda *args: 'SEG002')
    monkeypatch.setattr(route, 'rf_model', None)
    monkeypatch.setattr(route.requests, 'get', lambda *args, **kwargs: SimpleNamespace(status_code=200, json=lambda: {
        'routes': [{'distance': 5000, 'duration': 600, 'geometry': {'type': 'LineString', 'coordinates': [[104, 1], [104.1, 1.1]]}}]}))
    out = route.calculate_route(route.RouteRequest(origin=route.Point(lat=1, lng=104),
        destination=route.Point(lat=1.1, lng=104.1), time='08:00', day_type='weekday'))
    assert out['matched_segment_id'] == 'SEG002'
    assert out['matched_segment_name'] == (rows[0]['name'] if rows else 'Jl. Jendral Sudirman')
    assert out['distance_km'] == 5 and out['final_time_min'] == 10 and out['emission_kg'] == 1
    assert selected == ['corridor_type,name']


@pytest.mark.parametrize('kind', ['congestion', 'route'])
def test_new_names_and_legacy_results_validate(kind):
    meta = {'type': kind, 'title': 'Estimate', 'source': 'fixture', 'data_status': 'estimated', 'disclaimer': 'Test only'}
    data = ({'segment_id': 'SEG001', 'day_type': 'weekday', 'hour': 8, 'congestion_level': 'LOW', 'multiplier': 1.1}
        if kind == 'congestion' else {'distance_km': 5, 'final_time_min': 10, 'routing_source': 'fixture', 'matched_segment_id': 'SEG001'})
    field = 'segment_name' if kind == 'congestion' else 'matched_segment_name'
    validator = TypeAdapter(OracleResult)
    assert getattr(validator.validate_python({**meta, 'data': data}).data, field) is None
    assert getattr(validator.validate_python({**meta, 'data': {**data, field: 'Jl. Yos Sudarso'}}).data, field) == 'Jl. Yos Sudarso'
    for invalid in ['', ' ', 123, 'x' * 257]:
        with pytest.raises(ValidationError): validator.validate_python({**meta, 'data': {**data, field: invalid}})
