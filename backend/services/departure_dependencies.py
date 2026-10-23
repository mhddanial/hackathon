"""Bounded, read-only departure adapters for existing schedule/route services."""
from collections.abc import Mapping
from dataclasses import dataclass, field
import math
from typing import Any, Literal

import httpx
from pydantic import ValidationError
import requests

from auth import AuthenticatedContext
from routers import route
from route_geometry import compact_geometry
from schemas.departure_recommendation import (
    DepartureRequest, RouteInput, ScheduleAssessment, ScheduleOccurrence, Warning,
)
from schemas.route import RouteData
from services.departure_io import BoundedClient, IOOverrides, RequestBudget, io_overrides
from services.departure_recommendation import assess_schedule

DB_TIMEOUT_SECONDS = 5
ROUTE_TIMEOUT_SECONDS = 4
SELECTED_ROW_LIMIT = 101
TERMINAL_GROUPS = {"batu_ampar": "TM001", "batam_center": "TM002", "sekupang": "TM003"}


class DepartureError(Exception):
    def __init__(self, code: str, status_code: int = 503, fields: tuple[str, ...] = ()):
        self.code, self.status_code, self.fields = code, status_code, fields
        super().__init__(code)  # Owner fallback logging cannot print private diagnostics.


class RouteArithmeticUnavailable(Exception):
    """Owner date arithmetic exceeded datetime range, with no usable route estimate."""


def dependency_failure(error: Exception) -> DepartureError:
    if isinstance(error, DepartureError):
        return error
    if isinstance(error, (httpx.TimeoutException, requests.Timeout, TimeoutError)):
        return DepartureError("DEPENDENCY_TIMEOUT")
    if isinstance(error, (ValidationError, ValueError, TypeError, KeyError, AttributeError, httpx.RemoteProtocolError, httpx.DecodingError)):
        return DepartureError("INVALID_DEPENDENCY_RESPONSE")
    return DepartureError("DEPENDENCY_UNAVAILABLE")


def response_rows(response: Any, *, limit: int) -> list[dict[str, Any]]:
    rows = getattr(response, "data", None)
    if not isinstance(rows, list) or len(rows) > limit or any(not isinstance(row, dict) for row in rows):
        raise DepartureError("INVALID_DEPENDENCY_RESPONSE")
    return rows


@dataclass
class ScheduleLookup:
    assessment: ScheduleAssessment
    warnings: list[Warning] = field(default_factory=list)


class DepartureDependencies:
    def __init__(self, context: AuthenticatedContext, budget: RequestBudget,
                 *, source: Literal["database", "synthetic_fixture"] = "database",
                 route_transport: httpx.BaseTransport | None = None):
        self.context, self.budget, self.source = context, budget, source
        self.route_transport = route_transport
        self.failure: DepartureError | None = None
        self.corridor_verified = False
        self.corridor_segment: str | None = None

    def execute(self, query: Any, *, limit: int) -> list[dict[str, Any]]:
        try:
            self.budget.remaining()
            # Auth owns this client's lifecycle; never mutate a global/shared client.
            session = self.context.database.postgrest.session
            session.timeout = httpx.Timeout(self.budget.remaining(DB_TIMEOUT_SECONDS))
            if isinstance(session, BoundedClient):
                session.cap = DB_TIMEOUT_SECONDS
            rows = response_rows(query.retry(False).execute(), limit=limit)
            self.budget.remaining()
            return rows
        except Exception as error:
            raise dependency_failure(error) from None

    def selected_schedule(self, plan: DepartureRequest) -> ScheduleLookup:
        try:
            query = self.context.database.table("ferry_schedules").select("*").eq("id", plan.schedule_id).order("id").limit(SELECTED_ROW_LIMIT)
            rows = self.execute(query, limit=SELECTED_ROW_LIMIT)
        except Exception as error:
            raise dependency_failure(error) from None
        if not rows:
            raise DepartureError("SCHEDULE_NOT_FOUND", 404, ("schedule_id",))
        assessments = []
        normalized_rows = []
        for row in rows:
            normalized = dict(row)
            identity = row.get("id", row.get("schedule_id"))
            if identity is not None and identity != plan.schedule_id:
                raise DepartureError("INVALID_DEPENDENCY_RESPONSE")
            normalized["schedule_id"] = identity
            normalized["source"] = self.source  # Repository provenance, never a request switch.
            assessment = assess_schedule(normalized)
            grouping = row.get("terminal_id")
            terminal = row.get("terminal")
            if grouping is not None and (not isinstance(terminal, str) or grouping != TERMINAL_GROUPS.get(terminal)):
                assessment = ScheduleAssessment(schedule=assessment.schedule, reason_code="INVALID_SCHEDULE")
            assessments.append(assessment)
            normalized_rows.append({key: normalized.get(key) for key in (
                "schedule_id", "terminal", "terminal_id", "destination", "service_date", "allowed_service_kinds",
                "source_timezone", "source_departure_at", "source_cutoff_at", "verified_at", "source")})
        first = assessments[0]
        ambiguous = len(rows) == SELECTED_ROW_LIMIT
        for index, candidate in enumerate(assessments[1:], 1):
            if candidate != first or (not isinstance(first.schedule, ScheduleOccurrence) and normalized_rows[index] != normalized_rows[0]):
                ambiguous = True
        if ambiguous:
            return ScheduleLookup(ScheduleAssessment(schedule=first.schedule, reason_code="AMBIGUOUS_SCHEDULE"))
        warnings = []
        if len(rows) > 1:
            warnings.append(Warning(code="DUPLICATE_RECORD_COLLAPSED", message="Identical records for the selected occurrence were collapsed."))
        return ScheduleLookup(first, warnings)

    def route_database(self) -> "RouteDatabase":
        return RouteDatabase(self)

    def osrm_get(self, url: str, **kwargs) -> httpx.Response:
        if self.failure:
            raise self.failure
        try:
            with BoundedClient(self.budget, ROUTE_TIMEOUT_SECONDS, transport=self.route_transport) as client:
                response = client.get(url)
            if response.status_code >= 500 or response.status_code == 429:
                raise DepartureError("DEPENDENCY_UNAVAILABLE")
            payload = response.json()
            if isinstance(payload, dict) and payload.get("code") == "NoRoute" and response.status_code in (200, 400):
                # Known no-road-route result: the owner may retain a labeled Haversine estimate.
                return httpx.Response(200, json={"routes": []})
            if response.status_code != 200 or not isinstance(payload, dict):
                raise DepartureError("INVALID_DEPENDENCY_RESPONSE")
            routes = payload.get("routes")
            if not isinstance(routes, list) or not routes or not isinstance(routes[0], dict):
                raise DepartureError("INVALID_DEPENDENCY_RESPONSE")
            metrics = routes[0]
            for name in ("distance", "duration"):
                value = metrics.get(name)
                if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
                    raise DepartureError("INVALID_DEPENDENCY_RESPONSE")
            if not compact_geometry(metrics.get("geometry")):
                raise DepartureError("INVALID_DEPENDENCY_RESPONSE")
            return response
        except Exception as error:
            self.failure = dependency_failure(error)
            raise self.failure from None

    def route_estimate(self, plan: DepartureRequest) -> RouteInput:
        self.failure = None
        self.corridor_verified = False
        self.corridor_segment = None
        point = plan.terminal_point
        request = route.RouteRequest(origin=plan.origin.model_dump(), destination={"lat": point["lat"], "lng": point["lng"]},
            origin_name=plan.origin_name, destination_name=point["name"], time=plan.departure_time,
            day_type=plan.day_type, departure_date=plan.departure_date.isoformat())
        token = io_overrides.set(IOOverrides(route_get=self.osrm_get, route_database=self.route_database))
        try:
            raw = route.calculate_route(request)
            if self.failure:
                raise self.failure  # The owner may have caught it and returned a plausible fallback.
            # Validate strict duration BEFORE the more permissive shared legacy schema.
            values = raw.model_dump() if isinstance(raw, RouteData) else raw
            if not isinstance(values, Mapping):
                raise DepartureError("INVALID_DEPENDENCY_RESPONSE")
            provisional = RouteInput(final_time_min=values.get("final_time_min"), routing_source=values.get("routing_source"),
                congestion_status=values.get("congestion_status"), context_verified=False)
            data = RouteData.model_validate(values)
            if data.origin is None or data.destination is None or (
                data.origin.model_dump() != request.origin.model_dump() or data.destination.model_dump() != request.destination.model_dump()
                or data.departure_time != request.time or data.departure_date != request.departure_date
                or data.day_type != request.day_type or data.cargo_type is not None or data.vessel_etd is not None
            ):
                raise DepartureError("INVALID_DEPENDENCY_RESPONSE")
            evidence = self.corridor_verified and data.matched_segment_id == self.corridor_segment
            if data.congestion_status == "synthetic_estimate":
                label = data.congestion_level.lower() if data.congestion_level else None
                multiplier = (route.level_to_multiplier or {}).get(label)
                evidence = (evidence and isinstance(multiplier, (int, float)) and not isinstance(multiplier, bool)
                            and math.isfinite(multiplier) and multiplier > 0 and multiplier == data.congestion_multiplier)
            return RouteInput(**{**provisional.model_dump(), "context_verified": evidence})
        except OverflowError:
            if self.failure:
                raise self.failure from None
            raise RouteArithmeticUnavailable() from None
        except Exception as error:
            raise self.failure or dependency_failure(error) from None
        finally:
            io_overrides.reset(token)


class RouteDatabase:
    """Observe only the owner's existing reads; do not make another congestion call."""
    def __init__(self, owner: DepartureDependencies):
        self.owner = owner

    def table(self, name: str) -> "RouteQuery":
        try:
            if self.owner.failure:
                raise self.owner.failure
            if name != "road_segments":
                raise DepartureError("INVALID_DEPENDENCY_RESPONSE")
            return RouteQuery(self.owner, self.owner.context.database.table(name))
        except Exception as error:
            self.owner.failure = dependency_failure(error)
            raise self.owner.failure from None


class RouteQuery:
    def __init__(self, owner: DepartureDependencies, query: Any):
        self.owner, self.query = owner, query
        self.segment: str | None = None

    def select(self, columns: str) -> "RouteQuery":
        try:
            self.query = self.query.select(columns)
            return self
        except Exception as error:
            self.owner.failure = dependency_failure(error)
            raise self.owner.failure from None

    def eq(self, name: str, value: str) -> "RouteQuery":
        try:
            if name != "segment_id":
                raise DepartureError("INVALID_DEPENDENCY_RESPONSE")
            self.segment = value
            self.query = self.query.eq(name, value)
            return self
        except Exception as error:
            self.owner.failure = dependency_failure(error)
            raise self.owner.failure from None

    def execute(self):
        from types import SimpleNamespace
        if self.owner.failure:
            raise self.owner.failure
        try:
            rows = self.owner.execute(self.query.limit(101), limit=101)
            if len(rows) == 101:
                raise DepartureError("INVALID_DEPENDENCY_RESPONSE")
            if self.segment is not None:
                if len(rows) > 1:
                    raise DepartureError("INVALID_DEPENDENCY_RESPONSE")
                corridor = rows[0].get("corridor_type") if rows else None
                self.owner.corridor_verified = bool(corridor and f"corridor_type_{corridor}" in (route.feature_columns or []))
                self.owner.corridor_segment = self.segment if self.owner.corridor_verified else None
            else:
                for row in rows:
                    if not isinstance(row.get("segment_id"), str):
                        raise DepartureError("INVALID_DEPENDENCY_RESPONSE")
                    for name, low, high in (("start_lat", -90, 90), ("end_lat", -90, 90), ("start_lng", -180, 180), ("end_lng", -180, 180)):
                        value = row.get(name)
                        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not low <= value <= high:
                            raise DepartureError("INVALID_DEPENDENCY_RESPONSE")
            return SimpleNamespace(data=rows)
        except Exception as error:
            self.owner.failure = dependency_failure(error)
            raise self.owner.failure from None
