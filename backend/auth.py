from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from database import get_supabase_client

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    FastAPI Dependency to verify the JWT token via Supabase Auth.
    Requires an 'Authorization: Bearer <token>' header.
    """
    token = credentials.credentials
    supabase = get_supabase_client()
    
    try:
        # get_user verifies the JWT with the Supabase Auth server
        # It raises an error if the token is invalid or expired
        response = supabase.auth.get_user(token)
        
        if response.user:
            return response.user
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except Exception as e:
        # Supabase API usually raises an exception for invalid tokens (e.g. AuthApiError)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
