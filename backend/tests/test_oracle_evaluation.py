import asyncio
from collections import Counter
from pathlib import Path
from types import SimpleNamespace

import pytest
from scripts import evaluate_oracle_integration as evaluation

ROOT = Path(__file__).resolve().parents[2]


def test_evaluation_catalog_is_bounded_and_separate_from_development():
    cases = evaluation.load_cases(ROOT/'backend/tests/fixtures/oracle_integration_cases.json')
    assert len(cases) == 60
    assert set(Counter(c['category'] for c in cases).values()) == {10}
    assert all(c['review_required'] for c in cases)
    pilot = evaluation.load_cases(ROOT/'backend/tests/fixtures/oracle_integration_pilot.json')
    assert not {c['id'] for c in cases} & {c['id'] for c in pilot}
    assert not {c['prompt'] for c in cases} & {c['prompt'] for c in pilot}
    for case in cases:
        if case['expected_tools']:
            evaluation.normalized(case['expected_tools'][-1], case['expected_arguments'])


def test_grading_uses_normalized_locations_and_detects_invented_parameters():
    case = {'expected_tools': ['get_optimal_route'], 'expected_arguments': {
        'origin': 'Batamindo', 'destination': 'Batu Ampar Port', 'time': '10:00', 'day_type': 'weekday'}}
    arguments = {**case['expected_arguments'], 'origin': 'Batamindo Industrial Park'}
    assert evaluation.grade(case, [{'name': 'get_optimal_route', 'arguments': arguments}])['normalized_arguments_match']
    arguments.update(cargo_type='CONTAINER', vessel_etd='18:00')
    assert not evaluation.grade(case, [{'name': 'get_optimal_route', 'arguments': arguments}])['normalized_arguments_match']


@pytest.mark.parametrize('condition', ['provider_quota', 'provider_timeout'])
def test_controlled_outage_records_failure_without_claiming_human_success(condition):
    case = {'id': condition, 'category': 'failure', 'condition': condition, 'prompt': 'Show departures.', 'expected_tools': [], 'expected_arguments': {}}
    meter = SimpleNamespace(requests=0, tokens=[])
    record = asyncio.run(evaluation.run_case(case, meter, 'enhanced'))
    assert record['terminal_outcome'] == 'failed' and record['provider_requests'] == 0
    assert record['human_task_success'] is None and record['controlled_provider_failure']


def test_review_requires_real_boolean_verdicts_and_known_records():
    report = {'records': [{'id': 'a', 'variant': 'enhanced', 'repetition': 1, 'human_task_success': None}]}
    review = {'id': 'a', 'variant': 'enhanced', 'repetition': 1, 'human_task_success': True, 'human_grounding_pass': False}
    assert evaluation.apply_reviews(report, [review])['reviewed_task_pass_count'] == 1
    with pytest.raises(ValueError): evaluation.apply_reviews(report, [{**review, 'id': 'unknown'}])
    with pytest.raises(ValueError): evaluation.apply_reviews(report, [{**review, 'human_task_success': 'true'}])
