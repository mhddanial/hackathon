"""Verified identity and a JWT-scoped database client per request."""

from collections.abc import Iterator
from dataclasses import dataclass, field
from json import JSONDecodeError

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import Client, SupabaseException
from supabase_auth.errors import AuthApiError, AuthError, AuthRetryableError, AuthUnknownError
from supabase_auth.types import User
from pydantic import ValidationError

from database import get_supabase_client

security = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthenticatedContext:
    user: User = field(repr=False)
    database: Client = field(repr=False)


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _auth_unavailable() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Authentication service is temporarily unavailable",
        headers={"Retry-After": "5"},
    )


def get_authenticated_context(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> Iterator[AuthenticatedContext]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized()

    # Exception mapping surrounds verification, not the endpoint's execution.
    with httpx.Client(timeout=httpx.Timeout(10, connect=5)) as transport:
        try:
            client = get_supabase_client(http_client=transport)
            response = client.auth.get_user(credentials.credentials)
        except (httpx.TransportError, AuthRetryableError, AuthUnknownError, SupabaseException,
                ValidationError, JSONDecodeError):
            raise _auth_unavailable() from None
        except AuthApiError as exc:
            if exc.status >= 500 or exc.status == 429:
                raise _auth_unavailable() from None
            raise _unauthorized() from None
        except AuthError:
            raise _unauthorized() from None

        if response is None or response.user is None:
            raise _unauthorized()

        # get_user verifies JWT identity but does not sign PostgREST into it.
        client.postgrest.auth(credentials.credentials)
        yield AuthenticatedContext(user=response.user, database=client)


def get_current_user(context: AuthenticatedContext = Depends(get_authenticated_context)) -> User:
    """Compatibility dependency for existing identity-only routes."""
    return context.user


def get_authenticated_database(
    context: AuthenticatedContext = Depends(get_authenticated_context),
) -> Client:
    """History endpoints share the verified context and its request-owned transport."""
    return context.database
