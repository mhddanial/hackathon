"""Evaluate authored Oracle scenarios with live Gemini and controlled tool data.

Default: validate/list the dataset only. --live explicitly consumes Gemini quota.
No login, real routing, Supabase access, or saved-history writes are performed.
Human review is required for semantic task success and explanation grounding.
"""
import argparse
import asyncio
from contextlib import asynccontextmanager, ExitStack
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import statistics
import subprocess
import sys
from time import perf_counter
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend'))


def load_cases(path):
    payload = json.loads(path.read_text(encoding='utf-8'))
    cases = payload['cases']
    if len({case['id'] for case in cases}) != len(cases):
        raise ValueError('Duplicate case IDs')
    for case in cases:
        if not isinstance(case['prompt'], str) or not case['prompt'].strip() or not isinstance(case['expected_tools'], list):
            raise ValueError('Invalid evaluation case')
    return cases


def apply_reviews(report, reviews):
    """Apply explicit reviewer verdicts; automated checks never imply success."""
    records = {(r['id'], r['repetition'], r['variant']): r for r in report['records']}
    seen = set()
    for review in reviews:
        key = (review['id'], review['repetition'], review['variant'])
        if key not in records or key in seen:
            raise ValueError('Unknown or duplicate review key')
        seen.add(key)
        for field in ('human_task_success', 'human_grounding_pass'):
            if type(review[field]) is not bool:
                raise ValueError('Review verdicts must be booleans')
            records[key][field] = review[field]
        records[key]['review_notes'] = str(review.get('notes', ''))[:2000]
    reviewed = [r for r in report['records'] if r.get('human_task_success') is not None]
    report['human_review_status'] = 'complete' if reviewed and len(reviewed) == len(report['records']) else 'partial or pending'
    report['reviewed_task_count'] = len(reviewed)
    report['reviewed_task_pass_count'] = sum(r['human_task_success'] for r in reviewed)
    return report


def normalized(name, arguments):
    from services.oracle_tools import ARGUMENT_MODELS
    from locations import resolve_location
    values = ARGUMENT_MODELS[name].model_validate(arguments).model_dump(exclude_none=True)
    if name == 'get_optimal_route':
        for field in ('origin', 'destination'):
            p = resolve_location(values[field]); values[field] = [p['lat'], p['lng']]
        if values.get('vessel_etd') and 'T' in values['vessel_etd']:
            values['vessel_etd'] = datetime.fromisoformat(values['vessel_etd'].replace('Z', '+00:00')).astimezone(timezone.utc).isoformat()
    return values


def grade(case, tools):
    names = [row['name'] for row in tools]
    correct_tool = names == case['expected_tools']
    arguments_correct = None
    if correct_tool and names:
        try:
            actual = normalized(names[-1], tools[-1]['arguments'])
            expected = normalized(names[-1], case['expected_arguments'])
            # A resolved local departure date may be inherited from an ISO ETD.
            if 'departure_date' not in expected and 'vessel_etd' in expected and 'T' in expected['vessel_etd']:
                from route_planning import planning_context
                expected['departure_date'] = planning_context(expected['time'], expected['day_type'], vessel_etd=expected['vessel_etd'])['date']
                actual.setdefault('departure_date', expected['departure_date'])
            arguments_correct = actual == expected
        except (ValueError, KeyError, TypeError):
            arguments_correct = False
    return {'tool_selection_match': correct_tool, 'normalized_arguments_match': arguments_correct}


class MemoryStore:
    def __init__(self): self.calls, self.saved = [], None
    def record_tool(self, turn, call): self.calls.append(call)
    def finish(self, turn, **values):
        from services.oracle_turns import SavedTurn
        self.saved = values
        return SavedTurn(message_id=turn.assistant_message_id, outcome=values['outcome'])


class MeteredProvider:
    def __init__(self, delegate, budget):
        self.delegate, self.budget = delegate, budget
        self.requests, self.tokens = 0, []

    @asynccontextmanager
    async def session(self, history, message):
        async with self.delegate.session(history, message) as session:
            original = session.stream
            async def metered():
                if self.requests >= self.budget: raise RuntimeError('Evaluation request budget exhausted')
                self.requests += 1
                source = await original()
                async def consume():
                    usage = None
                    try:
                        async for chunk in source:
                            if chunk.usage_metadata: usage = chunk.usage_metadata.model_dump(mode='json')
                            yield chunk
                    finally:
                        await source.aclose()
                        if usage: self.tokens.append(usage)
                return consume()
            session.stream = metered
            yield session


class ControlledFailure:
    def __init__(self, condition): self.condition = condition
    @asynccontextmanager
    async def session(self, *args):
        if self.condition == 'provider_quota':
            from google.genai.errors import ClientError
            raise ClientError(429, {'error': {'code': 429, 'message': 'Controlled quota failure', 'status': 'RESOURCE_EXHAUSTED'}})
        raise TimeoutError('Controlled provider timeout')
        yield  # pragma: no cover


def fixtures(stack, condition):
    from routers import route
    from services import oracle_tools
    def routing(url, **kwargs):
        coordinates = url.split('/driving/')[1].split('?')[0]
        points = [[float(n) for n in value.split(',')] for value in coordinates.split(';')]
        return SimpleNamespace(status_code=503 if condition == 'osrm_outage' else 200,
            json=lambda: {'routes': [{'distance': 5000, 'duration': 600, 'geometry': {'type': 'LineString', 'coordinates': points}}]})
    stack.enter_context(patch.object(route.requests, 'get', routing))
    stack.enter_context(patch.object(route, 'find_closest_segment', lambda *a: 'SEG001'))
    stack.enter_context(patch.object(route, 'get_ml_congestion', lambda *a: {'level': None if condition == 'default_congestion' else 'MEDIUM',
        'multiplier': 1 if condition == 'default_congestion' else 1.2, 'segment_name': 'Yos Sudarso',
        'status': 'default_fallback' if condition == 'default_congestion' else 'synthetic_estimate'}))
    stack.enter_context(patch.object(oracle_tools, 'get_congestion', lambda **a: {'source': 'ml_model', 'congestion_level': 'MEDIUM', 'multiplier': 1.2}))
    class ScheduleQuery:
        def table(self, *a): return self
        def select(self, *a): return self
        def eq(self, field, value): self.terminal = value; return self
        def ilike(self, field, value): self.destination = value; return self
        def order(self, *a): return self
        def limit(self, *a): return self
        def execute(self):
            return SimpleNamespace(data=[] if condition == 'empty_schedules' else [{'terminal': self.terminal,
                'terminal_name': self.terminal.replace('_', ' ').title(), 'destination': getattr(self, 'destination', 'Harbourfront Singapore'),
                'departure_time': '18:00:00', 'cutoff_time': '17:30:00', 'vessel_type': 'Recorded fixture ferry', 'cargo_capacity_tons': 0}])
    stack.enter_context(patch.object(oracle_tools, 'get_supabase_client', ScheduleQuery))


async def run_case(case, meter, variant):
    from routers import agent
    from services import oracle_tools
    from services.oracle_turns import ReservedTurn
    turn = ReservedTurn(conversation_id=uuid4(), turn_id=uuid4(), user_message_id=uuid4(), assistant_message_id=uuid4(),
        replay=False, outcome='in_progress', content=None, tool_calls=[], results=[])
    store = MemoryStore(); history = []
    condition = case.get('condition')
    with ExitStack() as stack:
        fixtures(stack, condition)
        if case.get('history_route'):
            args = case['history_route']; output, _ = oracle_tools.execute_tool('get_optimal_route', args)
            history = [{'role': 'user', 'content': 'Estimate the supplied route.'},
                {'role': 'assistant', 'tool_calls': [{'id': 'previous-route', 'function': {'name': 'get_optimal_route', 'arguments': json.dumps(args)}}]},
                {'role': 'tool', 'tool_call_id': 'previous-route', 'turn_id': 'synthetic-previous-turn', 'content': json.dumps(output)},
                {'role': 'assistant', 'content': 'A previous route estimate based on synthetic fixtures.'}]
        stack.enter_context(patch.object(agent, 'provider', ControlledFailure(condition) if condition in ('provider_quota', 'provider_timeout') else meter))
        if condition == 'tool_unavailable':
            stack.enter_context(patch.object(agent, 'execute_tool', lambda *a: ({'error': 'Controlled tool outage', 'code': 'tool_unavailable'}, None)))
        request = SimpleNamespace(state=SimpleNamespace(oracle_message=case['prompt']))
        async def connected(): return False
        request.is_disconnected = connected
        events = []; start = perf_counter(); first_progress = first_text = None
        before, tokens_before = meter.requests, len(meter.tokens)
        async for wire in agent.stream_turn(turn, store, history, request):
            event = json.loads(wire.removeprefix('data: ').strip()); events.append(event)
            if event['type'] == 'status' and first_progress is None: first_progress = perf_counter() - start
            if event['type'] == 'chunk' and first_text is None: first_text = perf_counter() - start
        tools = [{'name': call.name, 'arguments': call.arguments, 'error_code': call.output.get('code'), 'output': call.output} for call in store.calls]
        grading = grade(case, tools) if events[-1].get('outcome') == 'completed' else {'tool_selection_match': None, 'normalized_arguments_match': None}
        return {'id': case['id'], 'category': case['category'], 'variant': variant, 'condition': condition,
            'controlled_provider_failure': condition in ('provider_quota', 'provider_timeout'),
            'terminal_outcome': events[-1].get('outcome'), 'elapsed_seconds': round(perf_counter()-start, 3),
            'first_progress_seconds': first_progress, 'first_text_seconds': first_text,
            'provider_requests': meter.requests-before, 'usage': meter.tokens[tokens_before:], 'tools': tools,
            'answer': (store.saved or {}).get('content', '')[:8000],
            'errors': [e['content'] for e in events if e['type'] == 'error'],
            **grading, 'grading_eligible': events[-1].get('outcome') == 'completed',
            'human_task_success': None, 'human_grounding_pass': None}


async def evaluate(args, cases):
    from dotenv import load_dotenv
    load_dotenv(ROOT / 'backend/.env')
    from services import oracle_provider
    provider = oracle_provider.GeminiProvider.from_environment()
    if provider is None: raise ValueError('Backend Gemini provider is not configured')
    if args.variant == 'baseline':
        source = subprocess.check_output(['git', 'show', 'c214987:backend/agent_config.py'], cwd=ROOT).decode('utf-8')
        namespace = {}; exec(compile(source, 'baseline_agent_config', 'exec'), namespace)
        oracle_provider.SYSTEM_PROMPT = namespace['SYSTEM_PROMPT']
        oracle_provider.route_context = lambda _: None
    meter = MeteredProvider(provider, args.max_provider_requests)
    records = []
    for repetition in range(args.repetitions):
        for case in cases:
            if meter.requests >= args.max_provider_requests: break
            record = await run_case(case, meter, args.variant); record['repetition'] = repetition + 1
            records.append(record)
            if any('quota' in e.lower() for e in record['errors']) and not record['controlled_provider_failure']:
                return records, provider.model
    return records, provider.model


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cases', type=Path, default=ROOT/'backend/tests/fixtures/oracle_integration_cases.json')
    parser.add_argument('--output', type=Path)
    parser.add_argument('--live', action='store_true')
    parser.add_argument('--variant', choices=['baseline', 'enhanced'], default='enhanced')
    parser.add_argument('--limit', type=int, default=6)
    parser.add_argument('--repetitions', type=int, default=1)
    parser.add_argument('--max-provider-requests', type=int, default=24)
    parser.add_argument('--ids', nargs='*')
    parser.add_argument('--review-report', type=Path, help='Existing evidence JSON to review without provider calls')
    parser.add_argument('--reviews', type=Path, help='JSON array of id/repetition/variant, boolean reviewer verdicts, notes')
    args = parser.parse_args()
    if args.review_report:
        if not args.reviews or not args.output or args.live: parser.error('Review mode requires --reviews and --output, without --live')
        report = apply_reviews(json.loads(args.review_report.read_text(encoding='utf-8')), json.loads(args.reviews.read_text(encoding='utf-8')))
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
        print(json.dumps({'reviewed': report['reviewed_task_count'], 'passed': report['reviewed_task_pass_count']}))
        return
    if not 1 <= args.limit <= 60 or not 1 <= args.repetitions <= 3 or not 1 <= args.max_provider_requests <= 500:
        parser.error('Use bounded limits: 1–60 cases, 1–3 repetitions, 1–500 provider requests')
    cases = load_cases(args.cases)
    if args.ids:
        if set(args.ids) - {c['id'] for c in cases}: parser.error('Unknown case IDs')
        cases = [c for c in cases if c['id'] in args.ids]
    if not cases: parser.error('No matching cases')
    selected = cases[:args.limit]
    report = {'scope': 'Live Gemini with deterministic synthetic tools and in-memory persistence; no signed-in HTTP/DB/browser acceptance.',
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'variant': args.variant, 'source_sha': subprocess.check_output(['git','rev-parse','HEAD'], cwd=ROOT, text=True).strip(),
        'dataset_sha256': hashlib.sha256(args.cases.read_bytes()).hexdigest(), 'selected_cases': [c['id'] for c in selected],
        'requested_conversation_runs': len(selected)*args.repetitions, 'live': args.live, 'records': []}
    report['source_file_hashes'] = {name: hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in (
        'backend/agent_config.py', 'backend/services/oracle_provider.py', 'backend/services/oracle_route_context.py',
        'backend/services/oracle_tools.py', 'backend/routers/route.py', 'backend/schemas/route.py',
        'backend/scripts/evaluate_oracle_integration.py', 'backend/route_planning.py')}
    report['baseline_definition'] = 'Original c214987 prompt with route reference disabled; both variants use current deterministic tool implementations.'
    if args.live:
        try: report['records'], report['model'] = asyncio.run(evaluate(args, selected))
        except Exception as error:
            report['runner_error_type'] = type(error).__name__
    samples = [r['elapsed_seconds'] for r in report['records'] if r['terminal_outcome'] == 'completed' and not r['controlled_provider_failure']]
    report['successful_timing_samples'] = len(samples)
    report['median_success_seconds'] = statistics.median(samples) if samples else None
    report['p95_success_seconds'] = sorted(samples)[min(len(samples)-1, int(len(samples)*.95))] if samples else None
    report['human_review_status'] = 'pending; no semantic task-success or grounding score claimed'
    report['unrun_conversation_runs'] = report['requested_conversation_runs'] - len(report['records']) if args.live else report['requested_conversation_runs']
    report['stop_reason'] = 'runner_error' if report.get('runner_error_type') else ('quota' if any(not r['controlled_provider_failure'] and any('quota' in e.lower() for e in r['errors']) for r in report['records']) else ('not_live' if not args.live else 'limit_or_complete'))
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2, default=str)+'\n', encoding='utf-8')
    print(json.dumps({'dataset_cases': len(cases), 'selected': len(selected), 'live': args.live, 'recorded_runs': len(report['records']),
        'runner_error_type': report.get('runner_error_type'), 'outcomes': [r['terminal_outcome'] for r in report['records']]}))


if __name__ == '__main__': main()
