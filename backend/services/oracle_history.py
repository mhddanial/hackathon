"""Owned conversation reads and edits through a verified request-scoped client."""

import base64
import binascii
from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

import httpx
from fastapi import HTTPException
from postgrest.exceptions import APIError
from pydantic import Field, ValidationError, field_validator
from supabase import Client

from schemas.oracle import (
    Contract, Conversation, ConversationCreate, ConversationPage,
    ConversationUpdate, ChatMessage, MessagePage,
)

CONVERSATION_COLUMNS = "id,title,created_at,updated_at,archived_at"
MESSAGE_COLUMNS = (
    "id,conversation_id,turn_id,sequence,role,content,tool_call_id,tool_name,"
    "tool_arguments,tool_result,tool_calls,structured_results,status,created_at"
)


class ConversationCursor(Contract):
    version: Literal[1] = 1
    kind: Literal["conversations"] = "conversations"
    include_archived: bool = Field(strict=True)
    updated_at: datetime
    id: UUID

    @field_validator("updated_at")
    @classmethod
    def require_timezone(cls, value):
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Cursor timestamp must include timezone")
        return value.astimezone(timezone.utc)


class MessageCursor(Contract):
    version: Literal[1] = 1
    kind: Literal["messages"] = "messages"
    conversation_id: UUID
    sequence: int = Field(strict=True, ge=1, le=2**63 - 1)


def _encode_cursor(value: Contract) -> str:
    return base64.urlsafe_b64encode(value.model_dump_json().encode()).decode().rstrip("=")


def _decode_cursor(value: str, model):
    try:
        if not value or len(value) > 512:
            raise ValueError("Invalid cursor size")
        decoded = base64.b64decode(value + "=" * (-len(value) % 4), altchars=b"-_", validate=True)
        return model.model_validate_json(decoded)
    except (ValueError, binascii.Error, ValidationError):
        raise HTTPException(422, "Invalid pagination cursor") from None


def _unavailable():
    return HTTPException(503, "Conversation history is temporarily unavailable", headers={"Retry-After": "5"})


class OracleHistory:
    def __init__(self, database: Client, user_id: UUID | str):
        self.database = database
        self.user_id = str(user_id)

    def _rows(self, query) -> list[dict]:
        try:
            data = query.execute().data
            if not isinstance(data, list) or any(not isinstance(row, dict) for row in data):
                raise ValueError("Invalid database response")
            return data
        except APIError as exc:
            if exc.code == "PT409":
                raise HTTPException(409, "Wait for the active turn before changing this conversation") from None
            raise _unavailable() from None
        except (httpx.HTTPError, ValueError):
            raise _unavailable() from None

    @staticmethod
    def _parse(model, row):
        try:
            return model.model_validate(row)
        except ValidationError:
            raise _unavailable() from None

    def create(self, payload: ConversationCreate) -> Conversation:
        rows = self._rows(self.database.table("conversations").insert({
            "user_id": self.user_id, "title": payload.title,
        }))
        if len(rows) != 1:
            raise _unavailable()
        # Insert responses also contain user_id; expose only the public contract.
        return self._parse(Conversation, {key: rows[0].get(key) for key in CONVERSATION_COLUMNS.split(",")})

    def get(self, conversation_id: UUID) -> Conversation:
        rows = self._rows(self.database.table("conversations").select(CONVERSATION_COLUMNS)
                          .eq("user_id", self.user_id).eq("id", str(conversation_id)).limit(1))
        if not rows:
            raise HTTPException(404, "Conversation not found")
        return self._parse(Conversation, rows[0])

    def list(self, *, limit: int = 30, cursor: str | None = None,
             include_archived: bool = False) -> ConversationPage:
        query = (self.database.table("conversations").select(CONVERSATION_COLUMNS)
                 .eq("user_id", self.user_id))
        if not include_archived:
            query = query.is_("archived_at", "null")
        if cursor:
            boundary = _decode_cursor(cursor, ConversationCursor)
            if boundary.include_archived != include_archived:
                raise HTTPException(422, "Cursor does not match archive filter")
            # Only canonical typed timestamp and UUID values enter this grammar.
            stamp = boundary.updated_at.isoformat()
            query = query.or_(f"updated_at.lt.{stamp},and(updated_at.eq.{stamp},id.lt.{boundary.id})")
        query = query.order("updated_at", desc=True).order("id", desc=True).limit(limit + 1)
        rows = self._rows(query)
        items = [self._parse(Conversation, row) for row in rows[:limit]]
        next_cursor = None
        if len(rows) > limit and items:
            last = items[-1]
            next_cursor = _encode_cursor(ConversationCursor(
                include_archived=include_archived, updated_at=last.updated_at, id=last.id,
            ))
        return ConversationPage(conversations=items, next_cursor=next_cursor)

    def update(self, conversation_id: UUID, payload: ConversationUpdate) -> Conversation:
        values = {}
        if "title" in payload.model_fields_set:
            values["title"] = payload.title
        if "archived" in payload.model_fields_set:
            values["archived_at"] = datetime.now(timezone.utc).isoformat() if payload.archived else None
        rows = self._rows(self.database.table("conversations").update(values)
                          .eq("user_id", self.user_id).eq("id", str(conversation_id)))
        if not rows:
            raise HTTPException(404, "Conversation not found")
        if len(rows) != 1:
            raise _unavailable()
        return self._parse(Conversation, {key: rows[0].get(key) for key in CONVERSATION_COLUMNS.split(",")})

    def delete(self, conversation_id: UUID) -> None:
        # One database statement cascades messages atomically. RLS and the active
        # turn trigger apply to this request-scoped, JWT-authenticated client.
        rows = self._rows(self.database.table("conversations").delete()
                          .eq("user_id", self.user_id).eq("id", str(conversation_id)))
        if not rows:
            raise HTTPException(404, "Conversation not found")
        if len(rows) != 1:
            raise _unavailable()

    def messages(self, conversation_id: UUID, *, limit: int = 30,
                 cursor: str | None = None) -> MessagePage:
        boundary = _decode_cursor(cursor, MessageCursor) if cursor else None
        if boundary and boundary.conversation_id != conversation_id:
            raise HTTPException(422, "Cursor does not match conversation")
        self.get(conversation_id)
        query = (self.database.table("chat_messages").select(MESSAGE_COLUMNS)
                 .eq("user_id", self.user_id).eq("conversation_id", str(conversation_id)))
        if boundary:
            query = query.gt("sequence", boundary.sequence)
        rows = self._rows(query.order("sequence").limit(limit + 1))
        items = [self._parse(ChatMessage, row) for row in rows[:limit]]
        next_cursor = None
        if len(rows) > limit and items:
            next_cursor = _encode_cursor(MessageCursor(conversation_id=conversation_id, sequence=items[-1].sequence))
        return MessagePage(messages=items, next_cursor=next_cursor)
