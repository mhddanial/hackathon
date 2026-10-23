"""Authenticated selected/automatic sailing recommendations and alternatives."""
from contextlib import asynccontextmanager
from datetime import datetime
import json
from typing import Annotated

import anyio
import httpx
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError, ResponseValidationError
from fastapi.routing import APIRoute
from pydantic import ValidationError

from auth import AuthenticatedContext, get_authenticated_context
from departure_config import DepartureConfig
from route_planning import PLANNING_ZONE
from schemas.departure_recommendation import CandidateBatch, DepartureRequest, DepartureResult, ScheduleAssessment, ScheduleCandidate, ScheduleOccurrence
from services.departure_dependencies import DepartureDependencies, DepartureError, RouteArithmeticUnavailable
from services.departure_io import BoundedClient, IOOverrides, RequestBudget, io_overrides
from services.departure_recommendation import PlanMismatch, recommend_from_candidates, validate_schedule_plan

REQUEST_BYTES = 8192
RESPONSE_BYTES = 65536
REQUEST_SECONDS = 30
AUTH_SECONDS = 10
ERROR_MESSAGES = {
    "SCHEDULE_NOT_FOUND": "Selected sailing was not found.",
    "SCHEDULE_MISMATCH": "Selected sailing does not match the requested schedule constraints.",
    "SERVICE_MISMATCH": "Selected sailing does not support the requested service kind.",
    "REQUEST_TOO_LARGE": "Departure request exceeds the size limit.",
    "DEPENDENCY_UNAVAILABLE": "A required departure dependency is temporarily unavailable.",
    "DEPENDENCY_TIMEOUT": "A required departure dependency exceeded the request budget.",
    "INVALID_DEPENDENCY_RESPONSE": "A required dependency returned an invalid response.",
    "RESPONSE_LIMIT": "Departure response exceeds the size limit.",
}


def transport_error(code: str, status: int = 503, fields: tuple[str, ...] = ()) -> HTTPException:
    return HTTPException(status, detail={"code": code, "message": ERROR_MESSAGES[code], "fields": list(fields)})


def validation_error(errors: list[dict]) -> HTTPException:
    safe_fields = set(DepartureRequest.model_fields) | {"body", "lat", "lng"}
    return HTTPException(422, detail=[{
        "loc": ["body", *[part if part in safe_fields else "field" for part in error.get("loc", ()) if isinstance(part, str) and part != "body"][:4]],
        "msg": "Invalid departure request field.",
        "type": str(error.get("type", "value_error"))[:80],
    } for error in errors[:10]])


def object_pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON property")
        result[key] = value
    return result


def invalid_constant(value):
    raise ValueError("Nonfinite JSON number")


def make_auth_client(budget: RequestBudget) -> BoundedClient:
    return BoundedClient(budget, AUTH_SECONDS)


class DepartureRoute(APIRoute):
    def get_route_handler(self):
        original = super().get_route_handler()

        async def guarded(request: Request):
            budget = RequestBudget.start(REQUEST_SECONDS)
            request.state.departure_budget = budget
            token = io_overrides.set(IOOverrides(auth_client=lambda: make_auth_client(budget)))
            try:
                with anyio.fail_after(budget.remaining()):
                    body = bytearray()
                    async for chunk in request.stream():
                        if len(body) + len(chunk) > REQUEST_BYTES:
                            raise transport_error("REQUEST_TOO_LARGE", 413)
                        body.extend(chunk)
                    try:
                        payload = json.loads(body.decode("utf-8"), object_pairs_hook=object_pairs, parse_constant=invalid_constant)
                        DepartureRequest.model_validate(payload)
                    except ValidationError as error:
                        raise validation_error(error.errors(include_input=False, include_context=False)) from None
                    except (ValueError, UnicodeError, RecursionError):
                        raise validation_error([{"loc": (), "type": "json_invalid"}]) from None
                    request._body = bytes(body)
                    response = await original(request)
                    budget.remaining()
                    if len(response.body) > RESPONSE_BYTES:
                        raise transport_error("RESPONSE_LIMIT")
                    return response
            except RequestValidationError as error:
                raise validation_error(error.errors()) from None
            except ResponseValidationError:
                raise transport_error("INVALID_DEPENDENCY_RESPONSE") from None
            except PlanMismatch as error:
                raise transport_error(error.code, 422, error.fields) from None
            except DepartureError as error:
                raise transport_error(error.code, error.status_code, error.fields) from None
            except (httpx.TimeoutException, TimeoutError):
                raise transport_error("DEPENDENCY_TIMEOUT") from None
            finally:
                io_overrides.reset(token)

        return guarded


@asynccontextmanager
async def departure_lifespan(app: FastAPI):
    # Invalid server settings prevent startup rather than masquerading as a user 422.
    app.state.departure_config = DepartureConfig.from_environment()
    yield


router = APIRouter(route_class=DepartureRoute, lifespan=departure_lifespan)


def get_dependencies(request: Request, context: Annotated[AuthenticatedContext, Depends(get_authenticated_context)]) -> DepartureDependencies:
    return DepartureDependencies(context, request.state.departure_budget)


def calculation_clock() -> datetime:
    return datetime.now(PLANNING_ZONE)


@router.post("", response_model=DepartureResult)
def recommend_departure(
    plan: DepartureRequest, request: Request,
    dependencies: Annotated[DepartureDependencies, Depends(get_dependencies)],
    clock: Annotated[datetime, Depends(calculation_clock)],
) -> DepartureResult:
    config = request.app.state.departure_config
    lookup = dependencies.selected_schedule(plan) if plan.schedule_id is not None else None
    if lookup is not None:
        validate_schedule_plan(plan, lookup.assessment.schedule)
    batch = dependencies.candidate_schedules(plan)
    selected = ScheduleCandidate(assessment=lookup.assessment) if lookup is not None else None
    # An incomplete automatic set cannot establish a best sailing or require routing.
    if plan.schedule_id is None and (batch.truncated or not batch.candidates):
        return recommend_from_candidates(plan, batch, None, config, calculated_at=clock)
    try:
        estimate = dependencies.route_estimate(plan)
    except RouteArithmeticUnavailable:
        # Preserve each row's earlier domain reason; arithmetic overflow comes last.
        def overflow(candidate: ScheduleCandidate) -> ScheduleCandidate:
            assessment = candidate.assessment
            reason = assessment.reason_code
            if reason is None and isinstance(assessment.schedule, ScheduleOccurrence):
                age = (clock - assessment.schedule.verified_at).total_seconds() / 60
                reason = "INVALID_FRESHNESS" if age < 0 else "STALE_SCHEDULE" if age > config.schedule_max_age_min else None
            return ScheduleCandidate(assessment=ScheduleAssessment(schedule=assessment.schedule,
                reason_code=reason or "INVALID_SCHEDULE"), fingerprint=candidate.fingerprint)
        selected = overflow(selected) if selected is not None else None
        batch = CandidateBatch(candidates=[overflow(item) for item in batch.candidates], truncated=batch.truncated, source=batch.source)
        estimate = None
    return recommend_from_candidates(plan, batch, estimate, config, calculated_at=clock,
        selected=selected, warnings=lookup.warnings if lookup else [])
