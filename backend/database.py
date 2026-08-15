import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_ANON_KEY")

if not url or not key:
    print("Warning: SUPABASE_URL or SUPABASE_ANON_KEY is missing from environment variables.")

# Create the Supabase client
def get_supabase_client() -> Client:
    return create_client(url, key)
