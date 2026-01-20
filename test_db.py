from supabase import create_client
import os
from config import Config

url = "https://grmlqlmvetxqitsxmsie.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdybWxxbG12ZXR4cWl0c3htc2llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NzIwNTgsImV4cCI6MjA4MDI0ODA1OH0.rg69sMWiQXjnKaEw59_57Jz7ZZ8xYeQ7fvaYNvbGhTw"

print(url)

supabase = create_client(url, key)

# Example of writing data to your 'users' table
data = supabase.table("users").insert({
    "email": "ady@example.com",
    "name": "Ady",
    "google_id": "12345"
}).execute()