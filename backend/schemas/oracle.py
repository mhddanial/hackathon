"""Sprint 1 contracts, wired into endpoints in Sprints 2 and 3."""

from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints, model_validator, field_validator
from schemas.route import LocationPoint, RouteGeometry, RouteData

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=8000)]
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]
RoadName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=256)]
ClockTime = Annotated[str, StringConstraints(pattern=r"^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$")]
NonNegative = Annotated[float, Field(ge=0, allow_inf_nan=False)]
Positive = Annotated[float, Field(gt=0, allow_inf_nan=False)]
DataStatus = Literal["synthetic_estimate", "database", "estimated", "default_fallback", "unknown"]
TurnStatus = Literal["in_progress", "completed", "failed", "interrupted"]


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ChatRequest(Contract):
    message: Text
    conversation_id: UUID | None = None
    client_request_id: UUID


class ConversationCreate(Contract):
    title: Title | None = None


class ConversationUpdate(Contract):
    title: Title | None = None
    archived: bool | None = None

    @model_validator(mode="after")
    def require_edit(self):
        if not self.model_fields_set:
            raise ValueError("At least one editable field is required")
        if "archived" in self.model_fields_set and self.archived is None:
            raise ValueError("archived must be a boolean")
        return self


class Conversation(Contract):
    id: UUID
    title: str | None
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None = None


class ResultMetadata(Contract):
    title: Title
    source: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    data_status: DataStatus
    disclaimer: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
    observed_at: datetime | None = None
    calculated_at: datetime | None = None


class CongestionData(Contract):
    segment_id: Annotated[str, StringConstraints(pattern=r"^SEG00[1-6]$")]
    segment_name: RoadName | None = None
    day_type: Literal["weekday", "weekend"]
    hour: Annotated[int, Field(strict=True, ge=0, le=23)]
    congestion_level: Literal["LOW", "MEDIUM", "HIGH"]
    multiplier: Positive


class ScheduleEntry(Contract):
    terminal: str
    destination: str
    departure_time: ClockTime
    cutoff_time: ClockTime | None = None
    vessel_type: str | None = None
    cargo_capacity_tons: NonNegative | None = None


class ScheduleData(Contract):
    schedules: list[ScheduleEntry] = Field(max_length=100)


class CongestionResult(ResultMetadata):
    type: Literal["congestion"]
    data: CongestionData


class ScheduleResult(ResultMetadata):
    type: Literal["schedule"]
    data: ScheduleData


class RouteResult(ResultMetadata):
    type: Literal["route"]
    data: RouteData


class GenericResult(ResultMetadata):
    type: Literal["generic"]
    data: dict[str, Any]


OracleResult = Annotated[
    CongestionResult | ScheduleResult | RouteResult | GenericResult,
    Field(discriminator="type"),
]


class ToolCall(Contract):
    id: str
    name: Literal["get_congestion_level", "get_ferry_schedule", "get_optimal_route"]
    arguments: dict[str, Any]
    output: dict[str, Any]


class ChatMessage(Contract):
    id: UUID
    conversation_id: UUID
    turn_id: UUID
    sequence: int = Field(ge=1)
    role: Literal["user", "assistant", "tool"]
    content: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    tool_arguments: dict[str, Any] | None = None
    tool_result: dict[str, Any] | None = None
    tool_calls: list[ToolCall] = Field(default_factory=list)
    structured_results: list[OracleResult] = Field(default_factory=list)
    status: TurnStatus
    created_at: datetime


class Page(Contract):
    next_cursor: str | None = None


class ConversationPage(Page):
    conversations: list[Conversation]


class MessagePage(Page):
    messages: list[ChatMessage]


class MetadataEvent(Contract):
    type: Literal["metadata"] = "metadata"
    conversation_id: UUID
    turn_id: UUID
    user_message_id: UUID
    assistant_message_id: UUID


class TextEvent(Contract):
    type: Literal["status", "chunk", "error"]
    content: str


class ResultEvent(Contract):
    type: Literal["result"] = "result"
    results: list[OracleResult]


class DoneEvent(Contract):
    type: Literal["done"] = "done"
    conversation_id: UUID
    turn_id: UUID
    message_id: UUID | None = None
    outcome: Literal["completed", "failed", "interrupted"]
    persisted: bool

    @model_validator(mode="after")
    def require_saved_success(self):
        if self.outcome == "completed" and (not self.persisted or self.message_id is None):
            raise ValueError("Completed turns require a persisted assistant message")
        return self


StreamEvent = Annotated[MetadataEvent | TextEvent | ResultEvent | DoneEvent, Field(discriminator="type")]
