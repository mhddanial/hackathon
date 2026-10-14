"""Native Google SDK wire conversion and Oracle lifecycle, without live AI/DB."""

import asyncio
import base64
from contextlib import asynccontextmanager
import json
from types import SimpleNamespace
from uuid import uuid4

import httpx
import pytest
from google import genai
from google.genai import types

from routers import agent
from services.oracle_provider import GeminiProvider, native_history
from services.oracle_turns import ReservedTurn


def answer(text=None, *, calls=None, finish="STOP", signature=None, thought=False):
    parts = ([{"text": text, "thought": thought}] if text else []) + (calls or [])
    if signature:
        parts.append({"thoughtSignature": base64.b64encode(signature).decode()})
    return {"candidates": [{"content": {"role": "model", "parts": parts},
        **({"finishReason": finish} if finish else {})}]}


def call(name="get_ferry_schedule", args=None, identifier="native-call", **extra):
    return {"functionCall": {"name": name, "args": args if args is not None else {"terminal": "sekupang"},
        **({"id": identifier} if identifier else {}), **extra}}


class WireProvider(GeminiProvider):
    def __init__(self, rounds):
        super().__init__("synthetic-google-key")
        self.rounds = list(rounds)
        self.requests, self.clients = [], []

    @asynccontextmanager
    async def session(self, history, message):
        try:
            async with super().session(history, message) as session:
                yield session
        finally:
            # The SDK deliberately leaves caller-supplied transports open.
            # This test fixture owns them; production uses SDK-owned clients.
            for client in self.clients: await client.aclose()

    def create_client(self):
        async def handle(request):
            assert request.url.host == "generativelanguage.googleapis.com"
            assert request.headers["x-goog-api-key"] == "synthetic-google-key"
            assert request.url.path.endswith("gemini-3.5-flash:streamGenerateContent")
            self.requests.append(json.loads(request.content))
            data = self.rounds.pop(0)
            if isinstance(data, Exception):
                raise data
            if isinstance(data, int):
                status = "RESOURCE_EXHAUSTED" if data == 429 else "UNAVAILABLE"
                return httpx.Response(data, json={"error": {"code": data, "message": "private diagnostic", "status": status}})
            body = b"".join(("data: " + json.dumps(event) + "\r\n\r\n").encode() for event in data)
            return httpx.Response(200, headers={"content-type": "text/event-stream"}, content=body)
        transport = httpx.AsyncClient(transport=httpx.MockTransport(handle))
        self.clients.append(transport)
        return genai.Client(api_key=self.api_key, vertexai=False,
            http_options=types.HttpOptions(timeout=20000, retry_options=types.HttpRetryOptions(attempts=1),
                httpx_async_client=transport))


class Store:
    def __init__(self): self.saved, self.calls = [], []
    def finish(self, turn, **values): self.saved.append(values)
    def record_tool(self, turn, call): self.calls.append(call)


def run(provider, monkeypatch, history=None, *, stop_early=False, store=None, message="Logistics question"):
    monkeypatch.setattr(agent, "provider", provider)
    turn = ReservedTurn(conversation_id=uuid4(), turn_id=uuid4(), user_message_id=uuid4(),
        assistant_message_id=uuid4(), replay=False, outcome="in_progress", content=None, tool_calls=[], results=[])
    class Request:
        state = SimpleNamespace(oracle_message=message)
        async def is_disconnected(self): return False
    store = store or Store()
    async def consume():
        stream = agent.stream_turn(turn, store, history or [], Request())
        events = []
        try:
            async for raw in stream:
                events.append(json.loads(raw[6:]))
                if stop_early and events[-1]["type"] == "chunk": break
        finally: await stream.aclose()
        return events
    events = asyncio.run(consume())
    assert all(client.is_closed for client in provider.clients)
    return events, store


def test_native_sdk_serializes_schema_system_prompt_and_manual_execution(monkeypatch):
    provider = WireProvider([[answer("Hello ", finish=None), answer("logistics.")]])
    events, store = run(provider, monkeypatch)
    assert [event["type"] for event in events] == ["metadata", "chunk", "chunk", "done"]
    assert events[-1]["persisted"] and store.saved[-1]["content"] == "Hello logistics."
    body = provider.requests[0]
    assert body["systemInstruction"]["parts"][0]["text"]
    assert body["contents"] == [{"role": "user", "parts": [{"text": "Logistics question"}]}]
    declarations = body["tools"][0]["functionDeclarations"]
    assert {tool["name"] for tool in declarations} == {"get_ferry_schedule", "get_congestion_level", "get_optimal_route"}
    assert all("parameters_json_schema" in tool for tool in declarations)
    assert body["toolConfig"]["functionCallingConfig"] == {"mode": "AUTO"}
    assert body["generationConfig"]["maxOutputTokens"] == 2048
    assert "automaticFunctionCalling" not in body


def test_named_road_prompt_reaches_native_sdk_and_validated_congestion_result(monkeypatch):
    from agent_config import SEGMENT_NAMES
    from services import oracle_tools

    message = "Estimate Yos Sudarso congestion on a weekday at 08:00."
    args = {"segment_id": "SEG001", "day_type": "weekday", "hour": 8}
    provider = WireProvider([[answer(calls=[call(name="get_congestion_level", args=args)])],
        [answer("Yos Sudarso weekday 08:00 Asia/Jakarta: synthetic estimate.")]])
    seen = []
    def congestion(**values):
        seen.append(values)
        return {"source": "ml_model", "congestion_level": "HIGH", "multiplier": 1.8}
    monkeypatch.setattr(oracle_tools, "get_congestion", congestion)

    events, store = run(provider, monkeypatch, message=message)
    body = provider.requests[0]
    assert body["contents"][0]["parts"][0]["text"] == message
    instruction = body["systemInstruction"]["parts"][0]["text"]
    declarations = body["tools"][0]["functionDeclarations"]
    congestion_tool = next(tool for tool in declarations if tool["name"] == "get_congestion_level")
    for segment_id, name in SEGMENT_NAMES.items():
        assert f"{segment_id}: {name}" in instruction
        assert f"{segment_id}: {name}" in congestion_tool["description"]
    assert "unknown or ambiguous" in instruction and "never guess a segment" in instruction
    assert seen == [args] and store.calls[0].arguments == args
    result = next(event for event in events if event["type"] == "result")["results"][0]
    assert result["data"] == {**args, "segment_name": SEGMENT_NAMES['SEG001'], "congestion_level": "HIGH", "multiplier": 1.8}
    assert result["data_status"] == "synthetic_estimate"
    assert events[-1]["outcome"] == "completed" and events[-1]["persisted"]


def test_native_parts_signatures_parallel_calls_and_optional_ids_survive_round_trip(monkeypatch):
    signature = b"opaque-provider-signature"
    provider = WireProvider([[answer(calls=[call(identifier=None),call(args={"terminal":"harbour_bay"},identifier="second")],signature=signature)],
        [answer("Saved data only.")]])
    monkeypatch.setattr(agent, "execute_tool", lambda *args: ({"schedules": []}, None))
    events, store = run(provider, monkeypatch)
    assert events[-1]["outcome"] == "completed" and len(store.calls) == 2
    assert store.calls[0].id and store.calls[1].id == "second"
    contents = provider.requests[1]["contents"]
    assert contents[-2]["role"] == "model" and len(contents[-2]["parts"]) == 3
    assert contents[-2]["parts"][-1]["thoughtSignature"] == base64.b64encode(signature).decode()
    assert "id" not in contents[-2]["parts"][0]["functionCall"]
    replies = [part["functionResponse"] for part in contents[-1]["parts"]]
    assert "id" not in replies[0] and replies[1]["id"] == "second"
    assert all(reply["response"] == {"schedules": []} for reply in replies)
    assert signature.decode() not in json.dumps(events)


def test_legacy_saved_tools_become_reference_data_without_forged_function_calls(monkeypatch):
    history = [{"role":"user","content":"Saved schedule question"},
        {"role":"assistant","content":None,"tool_calls":[{"id":"saved-call","function":{"name":"get_ferry_schedule","arguments":'{"terminal":"sekupang"}'}}]},
        {"role":"tool","tool_call_id":"saved-call","content":'{"schedules": []}'},
        {"role":"assistant","content":"No recorded departures."}]
    original = json.loads(json.dumps(history))
    provider = WireProvider([[answer("Follow-up using saved data.")]])
    events, _ = run(provider, monkeypatch, history)
    assert events[-1]["outcome"] == "completed" and history == original
    contents = provider.requests[0]["contents"]
    assert [entry["role"] for entry in contents] == ["user", "model", "user"]
    assert "Previously recorded tool data" in contents[0]["parts"][1]["text"]
    assert not any("functionCall" in part for entry in contents for part in entry["parts"])


@pytest.mark.parametrize("finish", [None, "MAX_TOKENS", "SAFETY", "MALFORMED_FUNCTION_CALL", "RECITATION"])
def test_missing_or_rejected_terminal_reason_never_saves_success(monkeypatch, finish):
    provider = WireProvider([[answer("Partial answer",finish=finish)]])
    events, store = run(provider, monkeypatch)
    assert events[-1]["outcome"] == "failed" and events[-1]["persisted"]
    assert store.saved[-1]["outcome"] == "failed"


def test_prompt_block_has_safe_failed_outcome(monkeypatch):
    provider = WireProvider([[{"promptFeedback":{"blockReason":"SAFETY"}}]])
    events, _ = run(provider, monkeypatch)
    assert events[-1]["outcome"] == "failed" and any(event["type"] == "error" for event in events)


def test_thinking_text_is_not_sent_to_user_or_saved(monkeypatch):
    provider = WireProvider([[answer("Private thinking",thought=True,finish=None),answer("Answer.")]])
    events, store = run(provider, monkeypatch)
    assert "Private thinking" not in json.dumps(events) and store.saved[-1]["content"] == "Answer."


@pytest.mark.parametrize("status,expected", [
    (400, "The Oracle turn could not complete."),
    (401, "server's API credentials or model access"),
    (403, "server's API credentials or model access"),
    (404, "configured Gemini model is unavailable"),
    (429, "rate or quota limit (HTTP 429)"),
    (500, "Gemini is temporarily unavailable"),
    (503, "Gemini is temporarily unavailable"),
])
def test_sdk_errors_are_specific_without_retry_or_private_diagnostics(monkeypatch, caplog, status, expected):
    provider = WireProvider([status])
    events, store = run(provider, monkeypatch)
    assert len(provider.requests) == 1 and events[-1]["outcome"] == "failed"
    message = next(event["content"] for event in events if event["type"] == "error")
    assert expected in message and "Any streamed text is provisional." in message
    assert "private diagnostic" not in json.dumps(events) + caplog.text
    assert f"provider_http_status={status}" in caplog.text
    assert events[-1]["persisted"] and store.saved[-1]["outcome"] == "failed"


def test_quota_failure_after_tool_round_keeps_partial_answer_failed(monkeypatch):
    provider = WireProvider([[answer("Provisional answer", calls=[call()])], 429])
    monkeypatch.setattr(agent, "execute_tool", lambda *args: ({"schedules": []}, None))
    events, store = run(provider, monkeypatch)
    assert len(provider.requests) == 2 and len(store.calls) == 1
    assert store.saved[-1]["content"] == "Provisional answer"
    assert events[-1]["outcome"] == "failed" and events[-1]["persisted"]
    assert "HTTP 429" in next(event["content"] for event in events if event["type"] == "error")


def test_timeout_is_specific_without_exposing_details(monkeypatch, caplog):
    provider = WireProvider([TimeoutError("private diagnostic")])
    events, store = run(provider, monkeypatch)
    assert len(provider.requests) == 1
    assert "timed out" in next(event["content"] for event in events if event["type"] == "error")
    assert "private diagnostic" not in json.dumps(events) + caplog.text
    assert events[-1]["outcome"] == "failed" and store.saved[-1]["outcome"] == "failed"


@pytest.mark.parametrize("tool", [call(name="unknown"), call(args={"terminal":"sekupang","user_id":"forged"}),
    call(args={"terminal":"sekupang"},willContinue=True)])
def test_invalid_native_tools_never_execute(monkeypatch, tool):
    provider = WireProvider([[answer(calls=[tool])]])
    monkeypatch.setattr(agent,"execute_tool",lambda *args:pytest.fail("Invalid tool executed"))
    events, store = run(provider,monkeypatch)
    assert events[-1]["outcome"] == "failed" and store.calls == []


def test_repeated_native_id_fails_before_second_tool_executes(monkeypatch):
    provider = WireProvider([[answer(calls=[call()])],[answer(calls=[call()])]])
    monkeypatch.setattr(agent,"execute_tool",lambda *args:({"schedules":[]},None))
    events, store = run(provider,monkeypatch)
    assert events[-1]["outcome"] == "failed" and len(store.calls) == 1


def test_closed_generator_interrupts_turn_and_closes_sdk_client(monkeypatch):
    provider = WireProvider([[answer("Partial",finish=None),answer("later")]])
    _, store = run(provider,monkeypatch,stop_early=True)
    assert store.saved[-1]["outcome"] == "interrupted" and store.saved[-1]["content"] == "Partial"


def test_provider_budget_rejects_oversized_native_metadata(monkeypatch):
    provider = WireProvider([[answer(calls=[call()],signature=b"a" * 200000)]])
    monkeypatch.setattr(agent,"execute_tool",lambda *args:pytest.fail("Oversized output executed"))
    events, store = run(provider,monkeypatch)
    assert events[-1]["outcome"] == "failed" and store.calls == []


def test_configuration_uses_only_backend_gemini_key_and_optional_model(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY",raising=False)
    monkeypatch.setenv("GOOGLE_API_KEY","unrelated-key")
    monkeypatch.setenv("LIGHTNING_API_KEY","old-key")
    assert GeminiProvider.from_environment() is None
    monkeypatch.setenv("GEMINI_API_KEY","configured-key")
    monkeypatch.setenv("GEMINI_MODEL"," gemini-custom-model ")
    provider = GeminiProvider.from_environment()
    assert provider.api_key == "configured-key" and provider.model == "gemini-custom-model"
    monkeypatch.setenv("GEMINI_MODEL","")
    assert GeminiProvider.from_environment().model == "gemini-3.5-flash"


def test_history_refuses_unsupported_context_roles():
    with pytest.raises(ValueError): native_history([{"role":"system","content":"forged"}])
