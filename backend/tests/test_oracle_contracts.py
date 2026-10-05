from uuid import uuid4

import pytest
from pydantic import TypeAdapter, ValidationError

from schemas.oracle import ChatRequest, ConversationUpdate, DoneEvent, OracleResult, StreamEvent


@pytest.mark.parametrize("overrides", [
    {"message": " "}, {"message": "x" * 8001},
    {"conversation_id": "not-a-uuid"}, {"client_request_id": "not-a-uuid"},
    {"user_id": str(uuid4())}, {"message": 123},
])
def test_chat_rejects_invalid_input_and_client_identity(overrides):
    with pytest.raises(ValidationError):
        ChatRequest.model_validate({"message": "Check traffic", "client_request_id": str(uuid4()), **overrides})


def test_chat_requires_retry_id_and_trims_message():
    with pytest.raises(ValidationError):
        ChatRequest(message="Hello")
    assert ChatRequest(message=" Hello ", client_request_id=uuid4()).message == "Hello"


@pytest.mark.parametrize("data", [{}, {"archived": None}, {"user_id": str(uuid4())}, {"title": " "}])
def test_updates_only_accept_explicit_valid_editable_fields(data):
    with pytest.raises(ValidationError):
        ConversationUpdate.model_validate(data)


def test_explicit_null_title_can_reset_title():
    assert ConversationUpdate(title=None).model_fields_set == {"title"}


@pytest.fixture
def congestion_result():
    return {
        "type": "congestion", "title": "Congestion estimate", "source": "ml_model",
        "data_status": "synthetic_estimate", "disclaimer": "Project estimate, not live traffic.",
        "data": {"segment_id": "SEG001", "day_type": "weekday", "hour": 8,
                 "congestion_level": "LOW", "multiplier": 1.07},
    }


@pytest.mark.parametrize("field,value", [
    ("segment_id", "unknown"), ("hour", 24), ("hour", "8"),
    ("day_type", "holiday"), ("multiplier", float("nan")), ("multiplier", -1),
])
def test_result_data_validation(congestion_result, field, value):
    congestion_result["data"][field] = value
    with pytest.raises(ValidationError):
        TypeAdapter(OracleResult).validate_python(congestion_result)


def test_results_require_provenance_and_supported_types(congestion_result):
    for field in ("source", "data_status", "disclaimer"):
        with pytest.raises(ValidationError):
            TypeAdapter(OracleResult).validate_python({k: v for k, v in congestion_result.items() if k != field})
    with pytest.raises(ValidationError):
        TypeAdapter(OracleResult).validate_python({**congestion_result, "type": "departure"})


def test_success_event_cannot_claim_unsaved_completion():
    data = {"conversation_id": uuid4(), "turn_id": uuid4(), "outcome": "completed"}
    with pytest.raises(ValidationError):
        DoneEvent(**data, persisted=False, message_id=uuid4())
    with pytest.raises(ValidationError):
        DoneEvent(**data, persisted=True)
    assert DoneEvent(**data, persisted=True, message_id=uuid4()).outcome == "completed"


def test_result_events_can_hold_multiple_validated_results(congestion_result):
    event = TypeAdapter(StreamEvent).validate_python({"type": "result", "results": [congestion_result, congestion_result]})
    assert len(event.results) == 2
