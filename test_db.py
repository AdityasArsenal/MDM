from supabase import create_client
import os

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")

if not url or not key:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY environment variables are required")

print(f"Connecting to: {url}")

supabase = create_client(url, key)

# Example of writing data to your 'users' table
data = supabase.table("users").insert({
    "email": "ady@example.com",
    "name": "Ady",
    "google_id": "123245"
}).execute()

print("Data inserted:", data)