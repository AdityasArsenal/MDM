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


def insert_milk_record(user_id, date, children, milk_open, ragi_open, milk_rcpt, ragi_rcpt, dist_type):
    """Insert or update milk record"""
    try:
        result = supabase.table("milk").upsert({
            "user_id": user_id,
            "date": date,
            "children": children,
            "milk_open": milk_open,
            "ragi_open": ragi_open,
            "milk_rcpt": milk_rcpt,
            "ragi_rcpt": ragi_rcpt,
            "dist_type": dist_type
        }).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        print(f"Error inserting milk record: {e}")
        raise e

def get_milk_records(user_id, year, month):
    """Get milk records for user by year and month"""
    try:
        start_date = f"{year}-{month:02d}-01"
        if month == 12:
            end_date = f"{year + 1}-01-01"
        else:
            end_date = f"{year}-{month + 1:02d}-01"
        
        result = supabase.table("milk").select("*").eq("user_id", user_id).gte("date", start_date).lt("date", end_date).order("date").execute()
        print(result.data)
        return result.data
    except Exception as e:
        print(f"Error getting milk records: {e}")
        raise e


def test_milk_records():
    user_id = "9d16f34f-9cf4-47ee-9cf4-3717f42f1e23"
    date = "2222-02-22"

    # Insert dummy record
    insert_milk_record(
        user_id=user_id,
        date=date,
        children=25,
        milk_open=0,      # calculated, set 0 for test
        ragi_open=0,      # calculated, set 0 for test
        milk_rcpt=30,
        ragi_rcpt=15,
        dist_type="milk & ragi"
    )

    # Fetch the record
    records = get_milk_records(user_id, 2222, 2)
    for r in records:
        print(r)

# Run the test
if __name__ == "__main__":
    # test_milk_records()
    user_id = "9d16f34f-9cf4-47ee-9cf4-3717f42f1e23"
    year = 2222
    month = 2
    print("========")
    get_milk_records(user_id, year, month)

