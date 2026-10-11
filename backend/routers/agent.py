"""Authenticated, persistent Oracle streaming with bounded provider/tool work."""

import asyncio
from contextlib import aclosing
import json
import logging
from uuid import uuid4

import anyio
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from google.genai import errors, types

from auth import AuthenticatedContext, get_authenticated_context
from schemas.oracle import ChatRequest, MetadataEvent, TextEvent, ResultEvent, DoneEvent, ToolCall
from services.oracle_tools import validate_arguments, execute_tool, status_message
from services.oracle_turns import OracleTurns, ReservedTurn
from services.oracle_provider import GeminiProvider

load_dotenv()
router = APIRouter()
provider = GeminiProvider.from_environment()
logger = logging.getLogger(__name__)

TURN_TIMEOUT = 90
TOOL_TIMEOUT = 15
MAX_TOOL_ROUNDS = 3
MAX_TOOL_CALLS = 12
MAX_ANSWER_CHARS = 32000
MAX_PROVIDER_BYTES = 256000


class OracleStreamingResponse(StreamingResponse):
    async def __call__(self, scope, receive, send):
        try:
            await super().__call__(scope, receive, send)
        finally:
            # ASGI >=2.4 can fail during send, outside the generator itself.
            # Close it before the request-owned DB transport is released.
            if hasattr(self.body_iterator,"aclose"):
                await self.body_iterator.aclose()


def sse_event(event) -> str:
    return f"data: {event.model_dump_json()}\n\n"


def turn_failure_message(error: Exception) -> str:
    """Expose only trusted error categories, never raw SDK diagnostics."""
    message = "The Oracle turn could not complete."
    if isinstance(error, errors.APIError):
        if error.code == 429:
            message = ("Gemini reached a rate or quota limit (HTTP 429). "
                "Wait for the limit to reset or check the project's quota in Google AI Studio.")
        elif error.code in (401, 403):
            message = ("Gemini rejected the server's API credentials or model access. "
                "Check the backend provider configuration.")
        elif error.code == 404:
            message = ("The configured Gemini model is unavailable. "
                "Check the backend model configuration.")
        elif 500 <= error.code < 600:
            message = "Gemini is temporarily unavailable. Send a new turn later."
    elif isinstance(error, TimeoutError):
        message = "The Oracle turn timed out. Send a new turn to try again."
    return message + " Any streamed text is provisional."


def metadata(turn: ReservedTurn) -> MetadataEvent:
    return MetadataEvent(conversation_id=turn.conversation_id, turn_id=turn.turn_id,
        user_message_id=turn.user_message_id, assistant_message_id=turn.assistant_message_id)


async def persist(store, turn, content, outcome, calls, results):
    return await anyio.to_thread.run_sync(lambda: store.finish(turn, content=content,
        outcome=outcome, calls=calls, results=results))


async def stream_turn(turn: ReservedTurn, store: OracleTurns, model_context: list[dict], request: Request):
    calls, results, text = [], [], []
    finalized = False
    outcome = "failed"
    if turn.replay:
        yield sse_event(metadata(turn))
        if turn.content:
            yield sse_event(TextEvent(type="chunk",content=turn.content))
        if turn.results:
            yield sse_event(ResultEvent(results=turn.results))
        if turn.outcome != "completed":
            yield sse_event(TextEvent(type="error",content="This saved turn did not complete. Send a new turn to try again."))
        yield sse_event(DoneEvent(conversation_id=turn.conversation_id,turn_id=turn.turn_id,
            message_id=turn.assistant_message_id,outcome=turn.outcome,persisted=True))
        return

    try:
        yield sse_event(metadata(turn))
        if provider is None:
            raise RuntimeError("Provider not configured")
        with anyio.fail_after(TURN_TIMEOUT):
            async with provider.session(model_context, request.state.oracle_message) as session:
                rounds, provider_bytes = 0, 0
                seen_ids = set()
                while True:
                    if await request.is_disconnected():
                        raise asyncio.CancelledError
                    stream = await session.stream()
                    round_text, parts, pending = [], [], []
                    finish_reason = None
                    async with aclosing(stream):
                        async for chunk in stream:
                            if await request.is_disconnected():
                                raise asyncio.CancelledError
                            if chunk.prompt_feedback and chunk.prompt_feedback.block_reason not in (None, types.BlockedReason.BLOCKED_REASON_UNSPECIFIED):
                                raise ValueError("Provider blocked the prompt")
                            if not chunk.candidates:
                                continue
                            if len(chunk.candidates) != 1:
                                raise ValueError("Unexpected provider candidates")
                            candidate = chunk.candidates[0]
                            if candidate.finish_reason:
                                finish_reason = candidate.finish_reason
                            for part in candidate.content.parts if candidate.content and candidate.content.parts else []:
                                provider_bytes += len(part.model_dump_json(exclude_none=True).encode())
                                if provider_bytes > MAX_PROVIDER_BYTES:
                                    raise ValueError("Provider output limit exceeded")
                                parts.append(part)
                                # Thinking text/signatures stay inside this native
                                # session; only answer text is streamed/persisted.
                                if part.text and not part.thought:
                                    if sum(map(len,text))+len(part.text)>MAX_ANSWER_CHARS:
                                        raise ValueError("Answer limit exceeded")
                                    text.append(part.text)
                                    round_text.append(part.text)
                                    yield sse_event(TextEvent(type="chunk",content=part.text))
                                if part.function_call:
                                    call = part.function_call
                                    if call.partial_args or call.will_continue:
                                        raise ValueError("Incomplete streamed function arguments")
                                    if len(pending)>=MAX_TOOL_CALLS:
                                        raise ValueError("Tool limit exceeded")
                                    pending.append(call)
                    # A missing terminal reason is a lost/truncated response,
                    # never a successful saved answer. STOP includes tool calls.
                    if finish_reason != types.FinishReason.STOP:
                        raise ValueError("Incomplete provider answer")
                    if not pending:
                        if not "".join(round_text).strip():
                            raise ValueError("Provider returned no final answer")
                        break
                    if rounds>=MAX_TOOL_ROUNDS or len(calls)+len(pending)>MAX_TOOL_CALLS:
                        raise ValueError("Tool limit exceeded")
                    rounds += 1
                    validated = []
                    for call in pending:
                        # Gemini may omit IDs; assign only the persisted local
                        # ID, without rewriting the signed native function part.
                        identifier = call.id or str(uuid4())
                        if len(identifier)>200 or identifier in seen_ids or not call.name or len(call.name)>80:
                            raise ValueError("Invalid or repeated tool call ID/name")
                        args = validate_arguments(call.name,json.dumps(call.args,allow_nan=False))
                        seen_ids.add(identifier)
                        validated.append((call,identifier,args))
                    session.remember_round(parts)
                    replies = []
                    for call,identifier,args in validated:
                        if await request.is_disconnected():
                            raise asyncio.CancelledError
                        yield sse_event(TextEvent(type="status",content=status_message(call.name)))
                        try:
                            with anyio.fail_after(TOOL_TIMEOUT):
                                output,result = await anyio.to_thread.run_sync(
                                    lambda: execute_tool(call.name,args),abandon_on_cancel=True)
                        except TimeoutError:
                            output,result = {"error":"Tool request timed out","code":"tool_timeout"},None
                        tool_call = ToolCall(id=identifier,name=call.name,arguments=args,output=output)
                        await anyio.to_thread.run_sync(lambda: store.record_tool(turn,tool_call))
                        calls.append(tool_call)
                        if result is not None:
                            results.append(result)
                        replies.append(types.Part(function_response=types.FunctionResponse(
                            id=call.id, name=call.name, response=output)))
                    session.answer_tools(replies)
                    yield sse_event(TextEvent(type="status",content="Generating an answer from the available tool data…"))
            await persist(store,turn,"".join(text),"completed",calls,results)
            finalized = True
            outcome = "completed"
        if results:
            yield sse_event(ResultEvent(results=results))
        yield sse_event(DoneEvent(conversation_id=turn.conversation_id,turn_id=turn.turn_id,
            message_id=turn.assistant_message_id,outcome="completed",persisted=True))
    except (asyncio.CancelledError, GeneratorExit):
        outcome = "interrupted"
        raise
    except Exception as error:
        # Raw messages/tracebacks can contain credentials, prompts or tool data.
        logger.warning("Oracle turn failed: error_type=%s provider_http_status=%s",
            type(error).__name__, error.code if isinstance(error, errors.APIError) else None)
        yield sse_event(TextEvent(type="error",content=turn_failure_message(error)))
        saved = False
        try:
            await persist(store,turn,"".join(text),"failed",calls,results)
            saved = True
            finalized = True
        except Exception:
            pass
        yield sse_event(DoneEvent(conversation_id=turn.conversation_id,turn_id=turn.turn_id,
            message_id=turn.assistant_message_id if saved else None,outcome="failed",persisted=saved))
    finally:
        if not finalized:
            # ASGI cancellation must not cancel the bounded best-effort outcome save.
            with anyio.CancelScope(shield=True):
                with anyio.move_on_after(12):
                    try:
                        await persist(store,turn,"".join(text),outcome,calls,results)
                    except Exception:
                        pass


@router.post("/chat",response_class=StreamingResponse)
async def chat_with_agent(payload: ChatRequest, request: Request,
    context: AuthenticatedContext = Depends(get_authenticated_context,scope="request")):
    store = OracleTurns(context.database,context.user.id)
    turn = await anyio.to_thread.run_sync(lambda: store.reserve(payload))
    try:
        model_context = [] if turn.replay else await anyio.to_thread.run_sync(lambda: store.context(turn))
    except HTTPException:
        try:
            await persist(store,turn,"","failed",[],[])
        except Exception:
            pass
        raise
    request.state.oracle_message = payload.message
    return OracleStreamingResponse(stream_turn(turn,store,model_context,request),media_type="text/event-stream",
        headers={"Cache-Control":"no-cache, no-transform","Connection":"keep-alive","X-Accel-Buffering":"no"})
