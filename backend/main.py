from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import congestion, agent, user, route
from database import get_supabase_client

app = FastAPI(title="Batam Cross-Border SmartFlow API", version="1.0.0")

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For hackathon, open to all. Restrict in production.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to SmartFlow API"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/test-db")
def test_db_connection():
    try:
        supabase = get_supabase_client()
        # Fetch 1 row from ferry_schedules to test connection
        response = supabase.table("ferry_schedules").select("*").limit(1).execute()
        return {"status": "success", "data": response.data}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# Include routers
app.include_router(user.router, prefix="/user", tags=["User"])
app.include_router(congestion.router, prefix="/congestion", tags=["Congestion"])
app.include_router(agent.router, prefix="/agent", tags=["Agent"])
app.include_router(route.router, prefix="/route", tags=["Routing"])
