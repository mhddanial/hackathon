"""Offline Sprint 1 fixture/example consistency review; never imports the app or I/O clients.

This checks authored expectations against independent datetime arithmetic and the
documented decision constraints. It does not execute the future departure service.
"""
from collections import Counter
from copy import deepcopy
from datetime import date, datetime, timedelta
import json
import math
from pathlib import Path
import re
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
ZONE = ZoneInfo('Asia/Jakarta')
FIXTURES = ROOT / 'backend/tests/fixtures/departure_cases.json'
EXAMPLES = ROOT / 'docs/departure/contracts/DEPARTURE_API_EXAMPLES.json'
REQUEST_FIELDS = {'origin', 'origin_name', 'terminal', 'ferry_destination', 'departure_date',
                  'departure_time', 'service_date', 'service_kind', 'day_type', 'schedule_id'}
RESPONSE_FIELDS = {'contract_version', 'status', 'reason_code', 'reason', 'plan', 'planned_departure_at',
                   'selected_schedule', 'travel_time_min', 'estimated_arrival_at', 'buffer_min',
                   'safety_buffer_min', 'latest_departure_estimate_at', 'route_estimate', 'alternatives',
                   'selection', 'exclusions', 'sources', 'data_status', 'assumptions', 'warnings',
                   'calculated_at', 'disclaimer'}
SCHEDULE_FIELDS = {'schedule_id', 'occurrence_id', 'terminal', 'destination', 'service_date',
                   'allowed_service_kinds', 'source_timezone', 'source_departure_at', 'source_cutoff_at',
                   'departure_at', 'cutoff_at', 'verified_at', 'source'}
CALCULATED = {'SAFE', 'RISKY', 'MISSED'}


def load(path):
    def no_duplicates(pairs):
        result = {}
        for key, value in pairs:
            assert key not in result, f'duplicate JSON key: {key}'
            result[key] = value
        return result
    def nonfinite(value):
        raise ValueError(f'nonfinite JSON literal: {value}')
    return json.loads(path.read_text(), object_pairs_hook=no_duplicates, parse_constant=nonfinite)


def merge(base, patch):
    result = deepcopy(base)
    for key, value in patch.items():
        result[key] = merge(result[key], value) if isinstance(value, dict) and isinstance(result.get(key), dict) else deepcopy(value)
    return result


def aware(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    assert result.tzinfo is not None
    return result


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def valid_uuid(value):
    return isinstance(value, str) and str(UUID(value)) == value


def request_valid(request):
    try:
        assert set(request) <= REQUEST_FIELDS
        assert set(request['origin']) == {'lat', 'lng'}
        lat, lng = request['origin']['lat'], request['origin']['lng']
        assert finite(lat) and finite(lng) and .7 <= lat <= 1.25 and 103.8 <= lng <= 104.3
        assert request['terminal'] in {'batu_ampar', 'batam_center', 'sekupang'}
        assert 1 <= len(request['ferry_destination'].strip()) <= 80
        road, service = date.fromisoformat(request['departure_date']), date.fromisoformat(request['service_date'])
        assert re.fullmatch(r'\d{4}-\d{2}-\d{2}', request['departure_date'])
        assert re.fullmatch(r'\d{4}-\d{2}-\d{2}', request['service_date'])
        assert (service - road).days in (0, 1)
        assert re.fullmatch(r'([01]\d|2[0-3]):[0-5]\d', request['departure_time'])
        day = 'weekday' if road.weekday() < 5 else 'weekend'
        assert request.get('day_type') in (None, day)
        assert request['service_kind'] in {'cargo', 'passenger_hand_carry'}
        assert request.get('schedule_id') is None or valid_uuid(request['schedule_id'])
        assert request.get('origin_name') is None or 1 <= len(request['origin_name'].strip()) <= 256
        return True
    except (AssertionError, ValueError, KeyError, TypeError):
        return False


def road_instant(request):
    return datetime.fromisoformat(request['departure_date'] + 'T' + request['departure_time']).replace(tzinfo=ZONE)


def check_zone(row):
    zone = ZoneInfo(row['source_timezone'])
    for field in ('source_departure_at', 'source_cutoff_at'):
        if row[field] is not None:
            value = aware(row[field])
            assert value.utcoffset() == value.astimezone(zone).utcoffset()


def check_calculated(value, row, request, duration, threshold):
    assert value['status'] in CALCULATED
    assert finite(duration) and 0 <= duration <= 1440 and finite(threshold) and threshold > 0
    check_zone(row)
    departure = aware(row['source_departure_at']).astimezone(ZONE)
    cutoff = aware(row['source_cutoff_at']).astimezone(ZONE)
    assert cutoff < departure
    assert departure.date().isoformat() == row['service_date'] == request['service_date']
    assert row['terminal'] == request['terminal']
    assert ' '.join(row['destination'].split()).casefold() == ' '.join(request['ferry_destination'].split()).casefold()
    assert request['service_kind'] in row['allowed_service_kinds']
    eta = road_instant(request) + timedelta(minutes=duration)
    buffer = (cutoff - eta).total_seconds() / 60
    assert aware(value['estimated_arrival_at']) == eta
    assert math.isclose(value['buffer_min'], buffer, rel_tol=0, abs_tol=1e-10)
    assert aware(value['latest_departure_estimate_at']) == cutoff - timedelta(minutes=duration + threshold)
    if value['status'] == 'SAFE':
        assert buffer >= threshold and value['reason_code'] == 'BUFFER_SUFFICIENT'
    elif value['status'] == 'RISKY':
        assert 0 <= buffer < threshold and value['reason_code'] == 'BELOW_SAFETY_BUFFER'
    else:
        assert buffer < 0 and value['reason_code'] == 'CUTOFF_MISSED'
    assert value['travel_time_min'] == duration


def unavailable_precondition(code, context, row):
    if code == 'MISSING_SERVICE_DATE': return row['service_date'] is None
    if code == 'MISSING_SOURCE_ZONE': return row['source_timezone'] is None
    if code == 'INVALID_SOURCE_ZONE':
        try:
            check_zone(row)
        except (ZoneInfoNotFoundError, AssertionError, ValueError):
            return True
        return False
    if code == 'MISSING_CUTOFF': return row['source_cutoff_at'] is None
    if code == 'INVALID_CUTOFF': return aware(row['source_cutoff_at']) >= aware(row['source_departure_at'])
    if code == 'SERVICE_UNKNOWN': return row['allowed_service_kinds'] is None
    if code == 'FRESHNESS_UNKNOWN': return row['verified_at'] is None
    if code == 'STALE_SCHEDULE': return (aware(context['clock']) - aware(row['verified_at'])).total_seconds() / 60 > context['config']['schedule_max_age_min']
    if code == 'INVALID_FRESHNESS': return aware(row['verified_at']) > aware(context['clock'])
    if code == 'ROUTE_FALLBACK': return context['route']['routing_source'] != 'OSRM API'
    if code == 'CONGESTION_UNAVAILABLE': return context['route']['congestion_status'] != 'synthetic_estimate'
    if code == 'ROUTE_CONTEXT_UNKNOWN': return context['route']['context_verified'] is not True
    if code == 'CANDIDATE_LIMIT': return context['retrieval']['truncated'] and context['request']['schedule_id'] is None
    if code == 'NO_SCHEDULES': return context['schedules'] == []
    if code == 'NO_RELEVANT_SCHEDULES': return all(context['request']['service_kind'] not in s['allowed_service_kinds'] for s in context['schedules'])
    if code == 'NO_EVALUABLE_SCHEDULES': return all(s['source_cutoff_at'] is None for s in context['schedules'])
    if code == 'AMBIGUOUS_SCHEDULE':
        matches = [s for s in context['schedules'] if s['schedule_id'] == context['request']['schedule_id']]
        return len(matches) > 1 and matches[0] != matches[1]
    raise AssertionError(f'No design precondition review defined for {code}')


fixtures = load(FIXTURES)
assert fixtures['fixture_version'] == '1.0' and 'synthetic' in fixtures['provenance'].lower()
cases = fixtures['cases']
by_id = {case['id']: case for case in cases}
assert len(by_id) == len(cases)
reviews, counts, covered = [], Counter(), set()
for case in cases:
    context = merge(fixtures['defaults'], case['overrides'])
    request, expected = context['request'], case['expected']
    covered.update(case['covers'])
    counts[case['stage']] += 1
    assert case['review_note'], case['id']
    http = expected['http_status']
    try:
        if case['stage'] == 'configuration':
            assert expected['startup_error'] == 'INVALID_CONFIGURATION' and http is None
            assert any(not finite(v) or v <= 0 for v in context['config'].values())
        elif case['stage'] == 'request':
            assert http == 422 and not request_valid(request)
        else:
            assert request_valid(request)
            assert all(finite(v) and v > 0 for v in context['config'].values())
            rows = [s for s in context['schedules'] if s['schedule_id'] == (expected.get('selected_schedule_id') or request['schedule_id'])]
            row = rows[0] if rows else None
            if http == 200 and expected['status'] in CALCULATED:
                assert row is not None
                assert context['route']['routing_source'] == 'OSRM API'
                assert context['route']['congestion_status'] == 'synthetic_estimate'
                assert context['route']['context_verified'] is True
                age = (aware(context['clock']) - aware(row['verified_at'])).total_seconds() / 60
                assert 0 <= age <= context['config']['schedule_max_age_min']
                check_calculated(expected, row, request, context['route']['final_time_min'], context['config']['safety_buffer_min'])
                assert len(expected['alternative_ids']) <= 3
                assert expected['selected_schedule_id'] not in expected['alternative_ids']
                alternative_rows = [next(s for s in context['schedules'] if s['schedule_id'] == sid) for sid in expected['alternative_ids']]
                assert alternative_rows == sorted(alternative_rows, key=lambda s: (aware(s['source_departure_at']), s['schedule_id']))
                for alternative in alternative_rows:
                    cutoff = aware(alternative['source_cutoff_at'])
                    eta = road_instant(request) + timedelta(minutes=context['route']['final_time_min'])
                    assert cutoff >= eta and cutoff < aware(alternative['source_departure_at'])
                    assert request['service_kind'] in alternative['allowed_service_kinds']
                    assert alternative['terminal'] == request['terminal'] and alternative['service_date'] == request['service_date']
                if request['schedule_id'] is not None:
                    assert expected['selected_schedule_id'] == request['schedule_id']
                if context['retrieval']['truncated']:
                    assert expected['alternative_ids'] == [] and 'ALTERNATIVES_TRUNCATED' in expected['required_warning_codes']
            elif http == 200:
                assert expected['status'] == 'UNAVAILABLE'
                assert all(expected[key] is None for key in ('travel_time_min', 'estimated_arrival_at', 'buffer_min', 'latest_departure_estimate_at'))
                assert expected['alternative_ids'] == []
                assert unavailable_precondition(expected['reason_code'], context, row)
            elif case['stage'] == 'dependency':
                if expected['error_code'] == 'INVALID_DEPENDENCY_RESPONSE':
                    duration = context['route']['final_time_min']
                    assert not finite(duration) or not 0 <= duration <= 1440
                else:
                    assert context['failures']
                assert http == 503
            elif case['stage'] == 'auth':
                assert context['failures']['auth'] in {'expired', 'outage'} and expected['error_code'] is None
                assert http == (401 if context['failures']['auth'] == 'expired' else 503)
            elif case['stage'] == 'target':
                matches = [s for s in context['schedules'] if s['schedule_id'] == request['schedule_id']]
                if http == 404:
                    assert not matches
                else:
                    assert http == 422 and matches
                    item = matches[0]
                    if expected['error_code'] == 'SERVICE_MISMATCH':
                        assert request['service_kind'] not in item['allowed_service_kinds']
                    else:
                        assert item['terminal'] != request['terminal'] or item['destination'] != request['ferry_destination'] or item['service_date'] != request['service_date']
            else:
                raise AssertionError('unreviewed fixture category')
    except Exception as exc:
        raise AssertionError(f'{case["id"]}: {exc}') from exc
    reviews.append({'id': case['id'], 'stage': case['stage'], 'http_status': http, 'status': expected.get('status'), 'reason': expected.get('reason_code') or expected.get('error_code') or expected.get('startup_error') or 'existing auth shape', 'review': case['review_note']})

examples = load(EXAMPLES)['examples']
for example in examples:
    case = by_id[example['fixture_id']]
    context = merge(fixtures['defaults'], case['overrides'])
    expected = case['expected']
    assert example['request'] == context['request'] and example['http_status'] == expected['http_status']
    body = example['response']
    assert len(json.dumps(body).encode()) <= 65536
    if example['http_status'] != 200:
        assert set(body) == {'detail'}
        if example['http_status'] == 503:
            assert set(body['detail']) == {'code', 'message', 'fields'}
            assert body['detail']['code'] == expected['error_code']
        else:
            assert isinstance(body['detail'], list) and all(set(e) == {'loc', 'msg', 'type'} for e in body['detail'])
        continue
    assert set(body) == RESPONSE_FIELDS
    assert body['contract_version'] == '1.0' and body['plan'] == context['request']
    assert body['status'] == expected['status'] and body['reason_code'] == expected['reason_code']
    assert set(body['selected_schedule']) == SCHEDULE_FIELDS
    selected = body['selected_schedule']
    assert selected['schedule_id'] == expected['selected_schedule_id']
    assert selected['occurrence_id'] == selected['schedule_id'] + '@' + selected['service_date']
    assert body['safety_buffer_min'] == context['config']['safety_buffer_min']
    assert aware(body['planned_departure_at']) == road_instant(context['request'])
    assert aware(body['calculated_at']) == aware(context['clock'])
    for source, field in [('source_departure_at', 'departure_at'), ('source_cutoff_at', 'cutoff_at')]:
        assert (selected[field] is None and selected[source] is None) or aware(selected[field]) == aware(selected[source])
    assert 0 <= body['selection']['excluded_count'] <= body['selection']['examined_count'] <= 101
    assert len(body['alternatives']) <= 3 and len(body['warnings']) <= 20 and len(body['exclusions']) <= 101
    assert set(body['sources']) == {'schedule', 'route', 'congestion', 'cutoff'}
    assert body['route_estimate']['final_time_min'] == context['route']['final_time_min']
    if body['status'] in CALCULATED:
        assert body['data_status'] == 'simulation'
        check_calculated(body, selected, body['plan'], body['travel_time_min'], body['safety_buffer_min'])
        assert all(body[field] == expected[field] for field in ('travel_time_min', 'estimated_arrival_at', 'buffer_min', 'latest_departure_estimate_at'))
    else:
        assert body['data_status'] == 'unavailable'
        assert all(body[field] is None for field in ('travel_time_min', 'estimated_arrival_at', 'buffer_min', 'latest_departure_estimate_at'))
    assert [a['schedule']['schedule_id'] for a in body['alternatives']] == expected['alternative_ids']
    for alternative in body['alternatives']:
        assert set(alternative) == {'schedule', 'status', 'reason_code', 'reason', 'estimated_arrival_at', 'travel_time_min', 'buffer_min', 'latest_departure_estimate_at'}
        assert set(alternative['schedule']) == SCHEDULE_FIELDS
        assert alternative['status'] in {'SAFE', 'RISKY'}
        check_calculated(alternative, alternative['schedule'], body['plan'], alternative['travel_time_min'], body['safety_buffer_min'])

assert {f'DEP-{n:02}' for n in range(1, 12)} <= covered
generated_outputs = {OUT / 'design-validation.json', OUT / 'fixture-review.md'}
for document in (ROOT / 'docs/departure').rglob('*.md'):
    if document.parts[-2] in {'context', 'sprint-0'}:
        continue
    if document.parts[-2] in {'planning', 'sprints'} and document.name not in {'SPRINT_1_DESIGN.md', 'DEPARTURE_IMPLEMENTATION_SPRINTS.md'}:
        continue
    for target in re.findall(r'\]\(([^)]+)\)', document.read_text()):
        if '://' not in target:
            resolved = (document.parent / target.split('#')[0]).resolve()
            assert resolved in generated_outputs or resolved.exists(), f'{document}: missing {target}'

summary = {
    'captured_at': datetime.now(ZONE).isoformat(),
    'command': 'python3 docs/departure/evidence/sprint-1/verify_design.py',
    'cwd': 'repository root',
    'result': 'PASS',
    'fixture_definitions_reviewed': len(reviews),
    'categories': dict(sorted(counts.items())),
    'synthetic_api_examples_reviewed': len(examples),
    'coverage': {'offline_fixture_cases': sorted(covered), 'DEP-12': 'UX race/cancel/account rules; execution assigned D5-06', 'DEP-14': 'Usability protocol only; actual observation assigned D6-04'},
    'checks': ['Strict JSON and unique fixture IDs', 'Fixture override merge and request constraints', 'Expected ETA, signed buffer, threshold boundaries and latest-departure arithmetic', 'Midnight/source-zone conversions and freshness boundary', 'Unavailable-data and controlled-error preconditions', 'Alternative identities/order/bounds and preserved selected target', 'Synthetic API example fields, nulls, request/fixture agreement and arithmetic', 'Local documentation links'],
    'limitations': ['No departure service, HTTP endpoint, browser or production schema executed', 'Automatic ranking traces are manually reviewed in fixture-review.md; this is not a service selection test', 'Repository overflow fixtures inject sentinel metadata; no real query/load test', 'No live schedule acceptance or participant observations', 'Sprint 0 application test startup failures remain unresolved'],
    'live_services_used': False,
    'application_tests_run': False,
}
(OUT / 'design-validation.json').write_text(json.dumps(summary, indent=2) + '\n')
lines = ['# Sprint 1 fixture expectation review', '', 'Synthetic authored expectations checked offline; no departure application was executed.', '', '| ID | Stage | HTTP / status | Reason | Arithmetic / policy trace |', '| --- | --- | --- | --- | --- |']
for item in reviews:
    lines.append(f'| {item["id"]} | {item["stage"]} | {item["http_status"]} / {item["status"]} | {item["reason"]} | {item["review"]} |')
(OUT / 'fixture-review.md').write_text('\n'.join(lines) + '\n')
assert all(path.exists() for path in generated_outputs)
print(json.dumps(summary, indent=2))
