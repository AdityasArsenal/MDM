from flask import Blueprint, request, jsonify
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()

# Initialize Supabase client
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")

if not url or not key:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY environment variables are required")

supabase = create_client(url, key)


def get_egg_records(user_id, year, month):
    """Get egg records for user by year and month"""
    try:
        start_date = f"{year}-{month:02d}-01"
        end_date = (
            f"{year + 1}-01-01"
            if month == 12
            else f"{year}-{month + 1:02d}-01"
        )

        result = (
            supabase.table("egg")
            .select("*")
            .eq("user_id", user_id)
            .gte("date", start_date)
            .lt("date", end_date)
            .order("date")
            .execute()
        )

        return result.data

    except Exception as e:
        print(f"Error getting egg records: {e}")
        raise



def get_egg(year, month):
    user_id = "9d16f34f-9cf4-47ee-9cf4-3717f42f1e23"
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400

    records = get_egg_records(user_id, year, month)
    
    if records:
        for r in records:
            r['id'] = str(r['id'])
            r['user_id'] = str(r['user_id'])
            # Handle date formatting
            if isinstance(r['date'], str):
                r['date'] = r['date']
            else:
                r['date'] = r['date'].isoformat()
            r['egg_price'] = float(r['egg_price']) if r['egg_price'] else 6.0
            r['banana_price'] = float(r['banana_price']) if r['banana_price'] else 6.0

    return records or []



# Make sure you pass integers
f = get_egg(2222, 2)  # year=2020, month=2 as ints
print("--------------")
print(f)
print("--------------")
