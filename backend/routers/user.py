from fastapi import APIRouter, Depends
from auth import get_current_user
from database import get_supabase_client

router = APIRouter()

@router.get("/history")
def get_user_history(user = Depends(get_current_user)):
    """
    Get route query history for the currently authenticated user.
    """
    supabase = get_supabase_client()
    try:
        # We query the route_query_log table for the authenticated user's ID.
        # Since RLS is enabled, we could also just query all and Supabase will filter,
        # but eq("user_id", user.id) is explicit and safe.
        response = supabase.table("route_query_log").select("*").eq("user_id", user.id).order("requested_at", desc=True).execute()
        return {"status": "success", "data": response.data}
    except Exception as e:
        return {"status": "error", "message": str(e)}
