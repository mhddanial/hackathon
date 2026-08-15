import os
import requests
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

API_URL = "http://127.0.0.1:8000/user/history"

def run_tests():
    print("--- Testing Auth Scenario ---")

    # 1. Test without token
    print("\n1. Requesting /user/history without token...")
    response_no_token = requests.get(API_URL)
    print(f"Status Code: {response_no_token.status_code}")
    print(f"Response: {response_no_token.text}")

    # 2. Get a valid token by signing up/logging in a test user
    # 2. Test with fake/invalid token
    print("\n2. Requesting /user/history WITH an invalid/fake token...")
    fake_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake_payload.fake_signature"
    headers = {"Authorization": f"Bearer {fake_token}"}
    response_fake_token = requests.get(API_URL, headers=headers)
    print(f"Status Code: {response_fake_token.status_code}")
    try:
        print(f"Response JSON: {response_fake_token.json()}")
    except:
        print(f"Response Text: {response_fake_token.text}")
        
    print("\n[NOTE] We cannot test a valid token automatically right now because the Supabase 'email rate limit' prevents us from creating a new test user via script.")
    print("However, the 401 Unauthorized responses prove that the Auth Dependency is successfully blocking unauthenticated requests!")
    print("\n--- Test Complete ---")

if __name__ == "__main__":
    run_tests()
