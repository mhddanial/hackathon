"""Departure v1 types. These models neither fetch dependencies nor register routes."""
from datetime import date, datetime, timedelta
from typing import Annotated, Literal, Self
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import (
    AfterValidator, AwareDatetime, BaseModel, BeforeValidator, ConfigDict, Field,
    StringConstraints, model_validator,
)

from departure_config import PositiveMinutes
from locations import in_planning_area, resolve_location
from route_planning import PLANNING_ZONE, planning_context, planning_date

Terminal = Literal["batu_ampar", "batam_center", "sekupang"]
ServiceKind = Literal["cargo", "passenger_hand_carry"]
Status = Literal["SAFE", "RISKY", "MISSED", "UNAVAILABLE"]
CalculatedStatus = Literal["SAFE", "RISKY", "MISSED"]
ReasonCode = Literal[
    "BUFFER_SUFFICIENT", "BELOW_SAFETY_BUFFER", "CUTOFF_MISSED", "NO_SCHEDULES",
    "NO_RELEVANT_SCHEDULES", "NO_EVALUABLE_SCHEDULES", "MISSING_SERVICE_DATE",
    "MISSING_SOURCE_ZONE", "INVALID_SOURCE_ZONE", "MISSING_DEPARTURE", "INVALID_SCHEDULE",
    "MISSING_CUTOFF", "INVALID_CUTOFF", "SERVICE_UNKNOWN", "FRESHNESS_UNKNOWN",
    "INVALID_FRESHNESS", "STALE_SCHEDULE", "AMBIGUOUS_SCHEDULE", "ROUTE_FALLBACK",
    "CONGESTION_UNAVAILABLE", "ROUTE_CONTEXT_UNKNOWN", "CANDIDATE_LIMIT",
]
DecisionReason = Literal["BUFFER_SUFFICIENT", "BELOW_SAFETY_BUFFER", "CUTOFF_MISSED"]
ShortText = Annotated[str, StringConstraints(strict=True, min_length=1, max_length=80)]
Explanation = Annotated[str, StringConstraints(strict=True, min_length=1, max_length=500)]
FiniteMinutes = Annotated[float, Field(strict=True, allow_inf_nan=False)]
DurationMinutes = Annotated[FiniteMinutes, Field(ge=0, le=1440)]
Count = Annotated[int, Field(strict=True, ge=0, le=101)]


def normalized_label(value: str) -> str:
    return " ".join(value.split())


def canonical_uuid(value: object) -> str:
    if isinstance(value, UUID):
        return str(value)
    if not isinstance(value, str) or str(UUID(value)) != value:
        raise ValueError("Use a canonical lowercase hyphenated UUID")
    return value


def calendar_date(value: object) -> date:
    if type(value) is date:
        return value
    if not isinstance(value, str):
        raise ValueError("Use YYYY-MM-DD")
    return date.fromisoformat(planning_date(value))


def jakarta(value: datetime) -> datetime:
    return value.astimezone(PLANNING_ZONE)


def timestamp(value: object) -> object:
    if not isinstance(value, (str, datetime)):
        raise ValueError("Use an aware ISO timestamp")
    return value


ScheduleID = Annotated[str, BeforeValidator(canonical_uuid)]
CalendarDate = Annotated[date, BeforeValidator(calendar_date)]
SourceDatetime = Annotated[AwareDatetime, BeforeValidator(timestamp)]
JakartaDatetime = Annotated[SourceDatetime, AfterValidator(jakarta)]
Destination = Annotated[ShortText, BeforeValidator(lambda v: normalized_label(v) if isinstance(v, str) else v)]


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, validate_default=True)


class Origin(Model):
    lat: Annotated[float, Field(strict=True, allow_inf_nan=False)]
    lng: Annotated[float, Field(strict=True, allow_inf_nan=False)]

    @model_validator(mode="after")
    def coverage(self) -> Self:
        if not in_planning_area(self.lat, self.lng):
            raise ValueError("Origin is outside the Batam planning envelope")
        return self


class DepartureRequest(Model):
    origin: Origin
    origin_name: Annotated[str, StringConstraints(strict=True, strip_whitespace=True, min_length=1, max_length=256)] | None = None
    terminal: Terminal
    ferry_destination: Destination
    departure_date: CalendarDate
    departure_time: Annotated[str, StringConstraints(strict=True, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")]
    service_date: CalendarDate
    service_kind: ServiceKind
    day_type: Literal["weekday", "weekend"] | None = None
    schedule_id: ScheduleID | None = None

    @model_validator(mode="after")
    def calendar_consistency(self) -> Self:
        derived = "weekday" if self.departure_date.weekday() < 5 else "weekend"
        if self.day_type is not None and self.day_type != derived:
            raise ValueError("Departure date conflicts with day type")
        if (self.service_date - self.departure_date).days not in (0, 1):
            raise ValueError("Service date must be the road date or following date")
        object.__setattr__(self, "day_type", derived)
        return self

    @property
    def planned_departure_at(self) -> datetime:
        return planning_context(self.departure_time, self.day_type, self.departure_date.isoformat())["departure"]

    @property
    def terminal_point(self) -> dict:
        ids = {"batu_ampar": "batu_ampar_port", "batam_center": "batam_center_terminal", "sekupang": "sekupang_terminal"}
        return resolve_location(ids[self.terminal])


class ScheduleView(Model):
    """Partial, sanitized row view; never evidence of a valid occurrence."""
    schedule_id: ScheduleID | None
    occurrence_id: ShortText | None
    terminal: Terminal | None
    destination: Destination | None
    service_date: CalendarDate | None
    allowed_service_kinds: list[ServiceKind] | None
    source_timezone: ShortText | None
    source_departure_at: SourceDatetime | None
    source_cutoff_at: SourceDatetime | None
    departure_at: JakartaDatetime | None
    cutoff_at: JakartaDatetime | None
    verified_at: JakartaDatetime | None
    source: Literal["database", "synthetic_fixture"] | None


class ScheduleOccurrence(ScheduleView):
    schedule_id: ScheduleID
    occurrence_id: ShortText
    terminal: Terminal
    destination: Destination
    service_date: CalendarDate
    allowed_service_kinds: list[ServiceKind]
    source_timezone: ShortText
    source_departure_at: SourceDatetime
    source_cutoff_at: SourceDatetime
    departure_at: JakartaDatetime
    cutoff_at: JakartaDatetime
    verified_at: JakartaDatetime
    source: Literal["database", "synthetic_fixture"]

    @model_validator(mode="after")
    def occurrence_consistency(self) -> Self:
        try:
            zone = ZoneInfo(self.source_timezone)
            for value in (self.source_departure_at, self.source_cutoff_at):
                if value.utcoffset() != value.astimezone(zone).utcoffset():
                    raise ValueError("Source offset conflicts with source zone")
        except ZoneInfoNotFoundError:
            raise ValueError("Unknown source zone") from None
        if self.departure_at != self.source_departure_at or self.cutoff_at != self.source_cutoff_at:
            raise ValueError("Normalized times must preserve source instants")
        if self.cutoff_at >= self.departure_at:
            raise ValueError("Recorded cutoff must precede sailing departure")
        if self.departure_at.date() != self.service_date:
            raise ValueError("Service date must be the Jakarta sailing date")
        if self.occurrence_id != f"{self.schedule_id}@{self.service_date.isoformat()}":
            raise ValueError("Occurrence identity conflicts with schedule/date")
        return self


class RouteInput(Model):
    """Already adjusted duration and adapter provenance, injected into the core."""
    final_time_min: DurationMinutes
    routing_source: ShortText
    congestion_status: Literal["synthetic_estimate", "default_fallback", "unavailable"] | None
    context_verified: Annotated[bool, Field(strict=True)]


class ScheduleAssessment(Model):
    schedule: ScheduleOccurrence | ScheduleView
    reason_code: ReasonCode | None

    @model_validator(mode="after")
    def normalized_or_unavailable(self) -> Self:
        if self.reason_code is None and not isinstance(self.schedule, ScheduleOccurrence):
            raise ValueError("An eligible schedule must be a validated occurrence")
        return self


class ScheduleCandidate(Model):
    """Internal normalized candidate; the fingerprint never enters API responses."""
    assessment: ScheduleAssessment
    fingerprint: Annotated[str, StringConstraints(pattern=r"^[0-9a-f]{64}$")] | None = None


class CandidateBatch(Model):
    # The repository consumes the 101st raw row only as an overflow sentinel.
    candidates: list[ScheduleCandidate] = Field(max_length=100)
    truncated: Annotated[bool, Field(strict=True)]
    source: Literal["database", "synthetic_fixture"]


class RouteEstimate(RouteInput):
    estimated_arrival_at: JakartaDatetime


class Sources(Model):
    schedule: ShortText | None
    route: ShortText | None
    congestion: ShortText | None
    cutoff: ShortText | None


class Warning(Model):
    code: ShortText
    message: Explanation


class Selection(Model):
    mode: Literal["selected", "automatic"]
    service_date: CalendarDate
    examined_count: Count
    excluded_count: Count
    candidate_limit: Literal[100]
    truncated: Annotated[bool, Field(strict=True)]

    @model_validator(mode="after")
    def counts(self) -> Self:
        if self.excluded_count > self.examined_count:
            raise ValueError("Excluded count exceeds examined count")
        return self


class Exclusion(Model):
    schedule_id: ScheduleID | None
    reason_code: ReasonCode | Literal["SCHEDULE_MISMATCH", "SERVICE_MISMATCH"]


class Alternative(Model):
    schedule: ScheduleOccurrence
    status: Literal["SAFE", "RISKY"]
    reason_code: DecisionReason
    reason: Explanation
    estimated_arrival_at: JakartaDatetime
    travel_time_min: DurationMinutes
    buffer_min: FiniteMinutes
    latest_departure_estimate_at: JakartaDatetime

    @model_validator(mode="after")
    def alternative_buffer(self) -> Self:
        expected_reason = "BUFFER_SUFFICIENT" if self.status == "SAFE" else "BELOW_SAFETY_BUFFER"
        if self.buffer_min < 0 or self.reason_code != expected_reason:
            raise ValueError("Alternative must have a feasible status and matching reason")
        if self.buffer_min != (self.schedule.cutoff_at - self.estimated_arrival_at).total_seconds() / 60:
            raise ValueError("Alternative buffer conflicts with recorded cutoff and ETA")
        return self


class DepartureResult(Model):
    contract_version: Literal["1.0"]
    status: Status
    reason_code: ReasonCode
    reason: Explanation
    plan: DepartureRequest
    planned_departure_at: JakartaDatetime
    selected_schedule: ScheduleOccurrence | ScheduleView | None
    travel_time_min: DurationMinutes | None
    estimated_arrival_at: JakartaDatetime | None
    buffer_min: FiniteMinutes | None
    latest_departure_estimate_at: JakartaDatetime | None
    safety_buffer_min: PositiveMinutes
    route_estimate: RouteEstimate | None
    alternatives: list[Alternative] = Field(max_length=3)
    selection: Selection
    exclusions: list[Exclusion] = Field(max_length=101)
    sources: Sources
    data_status: Literal["simulation", "unavailable"]
    assumptions: list[Explanation] = Field(max_length=20)
    warnings: list[Warning] = Field(max_length=20)
    calculated_at: JakartaDatetime
    disclaimer: Annotated[str, StringConstraints(strict=True, min_length=1, max_length=1000)]

    @model_validator(mode="after")
    def decision_consistency(self) -> Self:
        values = (self.travel_time_min, self.estimated_arrival_at, self.buffer_min, self.latest_departure_estimate_at)
        if self.planned_departure_at != self.plan.planned_departure_at:
            raise ValueError("Road instant conflicts with plan")
        if self.selection.mode != ("selected" if self.plan.schedule_id else "automatic") or self.selection.service_date != self.plan.service_date:
            raise ValueError("Selection metadata conflicts with request")
        if self.selected_schedule is not None and self.plan.schedule_id is not None and self.selected_schedule.schedule_id not in (None, self.plan.schedule_id):
            raise ValueError("Selected mode must preserve the requested target")
        if self.selection.excluded_count != len(self.exclusions):
            raise ValueError("Excluded count conflicts with exclusion records")
        if self.status == "UNAVAILABLE":
            if any(v is not None for v in values) or self.alternatives or self.data_status != "unavailable":
                raise ValueError("Unavailable decisions must have null decision values and no alternatives")
            if self.reason_code in ("BUFFER_SUFFICIENT", "BELOW_SAFETY_BUFFER", "CUTOFF_MISSED"):
                raise ValueError("Unavailable decision requires an unavailable reason")
        else:
            if any(v is None for v in values) or not isinstance(self.selected_schedule, ScheduleOccurrence):
                raise ValueError("Calculated decisions require a valid occurrence and all arithmetic values")
            occurrence = self.selected_schedule
            if (occurrence.terminal != self.plan.terminal or occurrence.destination.casefold() != self.plan.ferry_destination.casefold()
                or occurrence.service_date != self.plan.service_date or self.plan.service_kind not in occurrence.allowed_service_kinds):
                raise ValueError("Calculated schedule conflicts with request constraints")
            expected = "MISSED" if self.buffer_min < 0 else "RISKY" if self.buffer_min < self.safety_buffer_min else "SAFE"
            reasons = {"SAFE": "BUFFER_SUFFICIENT", "RISKY": "BELOW_SAFETY_BUFFER", "MISSED": "CUTOFF_MISSED"}
            if self.status != expected or self.reason_code != reasons[expected] or self.data_status != "simulation":
                raise ValueError("Decision conflicts with unrounded buffer")
            if self.route_estimate is None or (
                self.route_estimate.routing_source != "OSRM API"
                or self.route_estimate.congestion_status != "synthetic_estimate"
                or not self.route_estimate.context_verified
            ):
                raise ValueError("Calculated decision requires eligible route provenance")
            try:
                eta = self.planned_departure_at + timedelta(minutes=self.travel_time_min)
                latest = self.selected_schedule.cutoff_at - timedelta(minutes=self.travel_time_min) - timedelta(minutes=self.safety_buffer_min)
            except OverflowError:
                raise ValueError("Decision arithmetic exceeds datetime range") from None
            if self.estimated_arrival_at != eta or self.latest_departure_estimate_at != latest:
                raise ValueError("Decision timestamps conflict with input arithmetic")
            if self.buffer_min != (self.selected_schedule.cutoff_at - eta).total_seconds() / 60:
                raise ValueError("Decision buffer conflicts with recorded cutoff")
            if self.route_estimate.final_time_min != self.travel_time_min or self.route_estimate.estimated_arrival_at != eta:
                raise ValueError("Route estimate conflicts with decision duration/ETA")
        for alternative in self.alternatives:
            expected_status = "RISKY" if alternative.buffer_min < self.safety_buffer_min else "SAFE"
            if alternative.status != expected_status or alternative.travel_time_min != self.travel_time_min or alternative.estimated_arrival_at != self.estimated_arrival_at:
                raise ValueError("Alternative conflicts with road plan or safety threshold")
            occurrence = alternative.schedule
            if (occurrence.terminal != self.plan.terminal
                or occurrence.destination.casefold() != self.plan.ferry_destination.casefold()
                or occurrence.service_date != self.plan.service_date
                or self.plan.service_kind not in occurrence.allowed_service_kinds
                or (self.selected_schedule and occurrence.occurrence_id == self.selected_schedule.occurrence_id)):
                raise ValueError("Alternative conflicts with request constraints or selected occurrence")
            try:
                latest = occurrence.cutoff_at - timedelta(minutes=alternative.travel_time_min) - timedelta(minutes=self.safety_buffer_min)
            except OverflowError:
                raise ValueError("Alternative arithmetic exceeds datetime range") from None
            if alternative.latest_departure_estimate_at != latest:
                raise ValueError("Alternative latest departure conflicts with input arithmetic")
        ordering = [(item.schedule.departure_at, item.schedule.schedule_id) for item in self.alternatives]
        if ordering != sorted(ordering) or len({item.schedule.occurrence_id for item in self.alternatives}) != len(self.alternatives):
            raise ValueError("Alternatives must be unique and sorted by departure/UUID")
        return self
