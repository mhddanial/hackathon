from fastapi import APIRouter, Depends
from auth import get_current_user, get_authenticated_database

router = APIRouter()

@router.get("/history")
def get_user_history(user = Depends(get_current_user), supabase = Depends(get_authenticated_database)):
    """
    Get route query history for the currently authenticated user.
    """
    try:
        # We query the route_query_log table for the authenticated user's ID.
        # The verified request JWT is forwarded to PostgREST. Keep explicit owner
        # filtering; legacy route_query_log schema/RLS repair is a separate task.
        response = supabase.table("route_query_log").select("*").eq("user_id", user.id).order("requested_at", desc=True).execute()
        return {"status": "success", "data": response.data}
    except Exception:
        return {"status": "error", "message": "Route history is temporarily unavailable"}
