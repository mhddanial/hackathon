from uuid import UUID

from fastapi import APIRouter, Depends, Query
from auth import AuthenticatedContext, get_authenticated_context, get_current_user, get_authenticated_database
from schemas.oracle import Conversation, ConversationCreate, ConversationPage, ConversationUpdate, MessagePage
from services.oracle_history import OracleHistory

router = APIRouter()


def get_oracle_history(context: AuthenticatedContext = Depends(get_authenticated_context)) -> OracleHistory:
    return OracleHistory(context.database, context.user.id)


@router.post("/conversations", response_model=Conversation, status_code=201)
def create_conversation(payload: ConversationCreate, history: OracleHistory = Depends(get_oracle_history)):
    return history.create(payload)


@router.get("/conversations", response_model=ConversationPage)
def list_conversations(
    limit: int = Query(30, ge=1, le=100),
    cursor: str | None = Query(None, min_length=1, max_length=512),
    include_archived: bool = False,
    history: OracleHistory = Depends(get_oracle_history),
):
    return history.list(limit=limit, cursor=cursor, include_archived=include_archived)


@router.get("/conversations/{conversation_id}", response_model=Conversation)
def get_conversation(conversation_id: UUID, history: OracleHistory = Depends(get_oracle_history)):
    return history.get(conversation_id)


@router.patch("/conversations/{conversation_id}", response_model=Conversation)
def update_conversation(
    conversation_id: UUID, payload: ConversationUpdate,
    history: OracleHistory = Depends(get_oracle_history),
):
    return history.update(conversation_id, payload)


@router.get("/conversations/{conversation_id}/messages", response_model=MessagePage)
def get_conversation_messages(
    conversation_id: UUID,
    limit: int = Query(30, ge=1, le=100),
    cursor: str | None = Query(None, min_length=1, max_length=512),
    history: OracleHistory = Depends(get_oracle_history),
):
    return history.messages(conversation_id, limit=limit, cursor=cursor)

@router.get("/history")
def get_user_history(user = Depends(get_current_user), supabase = Depends(get_authenticated_database)):
    """
    Get route query history for the currently authenticated user.
    """
    try:
        # We query the route_query_log table for the authenticated user's ID.
        # The verified request JWT is forwarded to PostgREST. Keep explicit owner
        # filtering as defense in depth alongside the route-history owner policy.
        response = supabase.table("route_query_log").select("*").eq("user_id", user.id).order("requested_at", desc=True).execute()
        return {"status": "success", "data": response.data}
    except Exception:
        return {"status": "error", "message": "Route history is temporarily unavailable"}
