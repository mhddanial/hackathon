from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_supabase_client

router = APIRouter()

@router.get("")
@router.get("/")
def get_all_schedules():
    """
    Returns all ferry schedules for the dashboard and schedule pages.
    """
    try:
        supabase = get_supabase_client()
        response = supabase.table("ferry_schedules").select("*").execute()
        
        if not response.data:
            return {"schedules": []}
            
        return {"schedules": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
