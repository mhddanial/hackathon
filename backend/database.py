import os
from httpx import Client as HttpClient
from supabase import create_client, Client, ClientOptions
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_ANON_KEY")

if not url or not key:
    print("Warning: SUPABASE_URL or SUPABASE_ANON_KEY is missing from environment variables.")

# Create the Supabase client
def get_supabase_client(*, http_client: HttpClient | None = None) -> Client:
    """Create a fresh client; authenticated requests own and close their transport."""
    if http_client is None:
        return create_client(url, key, options=ClientOptions(postgrest_client_timeout=10))
    return create_client(
        url, key,
        options=ClientOptions(
            httpx_client=http_client,
            persist_session=False,
            auto_refresh_token=False,
            postgrest_client_timeout=10,
        ),
    )
