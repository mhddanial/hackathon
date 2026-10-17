"""Bounded route reference from paired, completed server-owned tool history."""
import json
from pydantic import ValidationError
from schemas.route import RouteData
from services.oracle_tools import RouteArguments


def route_context(messages: list[dict]) -> dict | None:
    calls = {}
    turn_routes = []
    latest = []
    for message in messages:
        if message.get('role') == 'user':
            if turn_routes:
                latest = turn_routes
            turn_routes = []
            calls = {}
        elif message.get('role') == 'assistant':
            for call in message.get('tool_calls') or []:
                calls[call['id']] = call.get('function', {})
        elif message.get('role') == 'tool':
            call = calls.get(message.get('tool_call_id'), {})
            if call.get('name') != 'get_optimal_route':
                continue
            try:
                args = RouteArguments.model_validate(json.loads(call['arguments']))
                output = json.loads(message['content'])
                if output.get('type') != 'route' or not isinstance(output.get('data'), dict):
                    continue
                data = RouteData.model_validate({k: v for k, v in output['data'].items() if k in RouteData.model_fields})
                inputs = args.model_dump(exclude_none=True)
                # Prefer resolved dates from successful results, while disclosing inference.
                if data.departure_date:
                    inputs['departure_date'] = data.departure_date
                turn_routes.append({'source_call_id': message['tool_call_id'],
                    'source_turn_id': message.get('turn_id'), 'inputs': inputs,
                    'departure_date_inferred': data.departure_date_inferred,
                    'provenance': 'previous validated tool call; not proof of explicit user confirmation'})
            except (ValidationError, ValueError, TypeError, KeyError):
                continue
    if turn_routes:
        latest = turn_routes
    if not latest:
        return None
    unique = {json.dumps(row['inputs'], sort_keys=True): row for row in latest}
    return {'status': 'available' if len(unique) == 1 else 'choose_plan', 'plans': list(unique.values())[-4:]}
