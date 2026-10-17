"""Atomic turn lifecycle and bounded, paired model context."""

import json
from typing import Literal
from uuid import UUID

import httpx
from fastapi import HTTPException
from postgrest.exceptions import APIError
from pydantic import ValidationError

from schemas.oracle import Contract, ChatRequest, OracleResult, ToolCall, TurnStatus
from services.oracle_history import OracleHistory, MESSAGE_COLUMNS, _unavailable
from services.oracle_tools import ARGUMENT_MODELS


class ReservedTurn(Contract):
    conversation_id: UUID
    turn_id: UUID
    user_message_id: UUID
    assistant_message_id: UUID
    replay: bool
    outcome: TurnStatus
    content: str | None
    tool_calls: list[ToolCall]
    results: list[OracleResult]


class SavedTurn(Contract):
    message_id: UUID
    outcome: Literal["completed", "failed", "interrupted"]


class OracleTurns(OracleHistory):
    def _rpc(self, name: str, params: dict):
        try:
            return self.database.rpc(name, params).execute().data
        except APIError as exc:
            status = {"PT401":401, "PT404":404, "PT409":409, "PT422":422}.get(exc.code)
            if status:
                message = {401:"Authentication required",404:"Conversation or turn not found",
                    409:"Turn conflicts with saved or active history; wait and retry the same request, or use a new request for a new turn",
                    422:"Invalid turn state"}[status]
                raise HTTPException(status,message,headers={"Retry-After":"5"} if status==409 else None) from None
            raise _unavailable() from None
        except (httpx.HTTPError, ValueError):
            raise _unavailable() from None

    def reserve(self, request: ChatRequest) -> ReservedTurn:
        data = self._rpc("oracle_reserve_turn", {"p_request_id":str(request.client_request_id),
            "p_content":request.message,"p_conversation_id":str(request.conversation_id) if request.conversation_id else None})
        try:
            return ReservedTurn.model_validate(data)
        except ValidationError:
            raise _unavailable() from None

    def record_tool(self, turn: ReservedTurn, call: ToolCall):
        self._rpc("oracle_record_tool", {"p_turn_id":str(turn.turn_id),"p_call_id":call.id,
            "p_name":call.name,"p_arguments":call.arguments,"p_output":call.output})

    def finish(self, turn: ReservedTurn, *, content: str, outcome: str,
               calls: list[ToolCall], results: list) -> SavedTurn:
        data = self._rpc("oracle_finish_turn", {"p_turn_id":str(turn.turn_id),"p_content":content,
            "p_status":outcome,"p_tool_calls":[call.model_dump(mode="json") for call in calls],
            "p_results":[result.model_dump(mode="json") for result in results]})
        try:
            saved = SavedTurn.model_validate(data)
            if saved.message_id != turn.assistant_message_id or saved.outcome != outcome:
                raise ValueError("Unexpected terminal acknowledgement")
            return saved
        except (ValidationError, ValueError):
            raise _unavailable() from None

    def context(self, turn: ReservedTurn) -> list[dict]:
        rows = self._rows(self.database.table("chat_messages").select(MESSAGE_COLUMNS)
            .eq("user_id",self.user_id).eq("conversation_id",str(turn.conversation_id))
            .eq("status","completed").order("sequence",desc=True).limit(120))
        return paired_context(rows)


def paired_context(rows: list[dict], budget: int = 24000) -> list[dict]:
    """Skip incomplete/failed turns and never clip a tool call away from its reply."""
    groups = {}
    for row in sorted(rows,key=lambda row:row["sequence"]):
        groups.setdefault(str(row["turn_id"]),[]).append(row)
    selected, used = [], 0
    for group in reversed(list(groups.values())):
        users = [row for row in group if row["role"]=="user"]
        assistants = [row for row in group if row["role"]=="assistant"]
        if len(users)!=1 or len(assistants)!=1:
            continue
        user, assistant = users[0], assistants[0]
        if user["status"]!="completed" or assistant["status"]!="completed":
            continue
        model_turn = [{"role":"user","content":user["content"]}]
        calls = assistant.get("tool_calls") or []
        tools = {row.get("tool_call_id"):row for row in group if row["role"]=="tool"}
        try:
            validated = [ToolCall.model_validate(call) for call in calls]
            if len({call.id for call in validated}) != len(validated):
                continue
            for call in validated:
                ARGUMENT_MODELS[call.name].model_validate(call.arguments)
                if call.id not in tools or tools[call.id]["tool_name"] != call.name:
                    raise ValueError("Unpaired tool result")
            if validated:
                model_turn.append({"role":"assistant","content":None,"tool_calls":[
                    {"id":call.id,"type":"function","function":{"name":call.name,"arguments":json.dumps(call.arguments)}} for call in validated]})
                model_turn.extend({"role":"tool","tool_call_id":call.id,"content":json.dumps(tools[call.id]["tool_result"]),
                    **({"turn_id": str(user["turn_id"])} if call.name == "get_optimal_route" else {})} for call in validated)
            model_turn.append({"role":"assistant","content":assistant["content"]})
            cost = len(json.dumps(model_turn))
            if used + cost > budget:
                break
            selected.insert(0,model_turn)
            used += cost
            if len(selected)>=8:
                break
        except (ValidationError, ValueError, KeyError, TypeError):
            continue
    return [message for turn in selected for message in turn]
