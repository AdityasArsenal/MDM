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

def insert_stock(user_id, date, grade, rice_add, wheat_add, oil_add, pulse_add, rice_open=None, wheat_open=None, oil_open=None, pulse_open=None):
    """Insert or update stock record"""
    try:
        data = {
            "user_id": user_id,
            "date": date,
            "grade": grade,
            "rice_add": rice_add,
            "wheat_add": wheat_add,
            "oil_add": oil_add,
            "pulse_add": pulse_add
        }

        # Only include opening stock if provided
        if rice_open is not None:
            data["rice_open"] = rice_open
        if wheat_open is not None:
            data["wheat_open"] = wheat_open
        if oil_open is not None:
            data["oil_open"] = oil_open
        if pulse_open is not None:
            data["pulse_open"] = pulse_open

        result = supabase.table("stock").insert(data).execute()

        return result.data[0] if result.data else None
    except Exception as e:
        print(f"Error inserting stock: {e}")
        raise e


def get_stock_records(user_id, year, month):
    """Get stock records for user by year and month"""
    try:
        start_date = f"{year}-{month:02d}-01"
        if month == 12:
            end_date = f"{year + 1}-01-01"
        else:
            end_date = f"{year}-{month + 1:02d}-01"

        result = (
            supabase.table("stock")
            .select("*")
            .eq("user_id", user_id)
            .gte("date", start_date)
            .lt("date", end_date)
            .order("date")
            .order("grade")
            .execute()
        )
        return result.data
    except Exception as e:
        print(f"Error getting stock records: {e}")
        raise e



def get_meal_plans(user_id, year, month):
    """Get meal plans for user by year and month"""
    try:
        start_date = f"{year}-{month:02d}-01"
        end_date = (
            f"{year + 1}-01-01"
            if month == 12
            else f"{year}-{month + 1:02d}-01"
        )

        result = (
            supabase
            .table("meal_plans")
            .select("*")
            .eq("user_id", user_id)
            .gte("date", start_date)
            .lt("date", end_date)
            .order("date")
            .execute()
        )

        return result.data

    except Exception as e:
        print(f"Error getting meal plans: {e}")
        raise


def test_stock_functions():
    # Dummy user ID
    user_id = "9d16f34f-9cf4-47ee-9cf4-3717f42f1e23"

    # Dummy data to insert
    dummy_records = [
        {
            "date": "2026-01-01",
            "grade": "1-5",
            "rice_add": 100,
            "wheat_add": 50,
            "oil_add": 20,
            "pulse_add": 30,
            "rice_open": 10,
            "wheat_open": 5,
            "oil_open": 2,
            "pulse_open": 3
        },
        {
            "date": "2026-01-01",
            "grade": "6-10",
            "rice_add": 80,
            "wheat_add": 40,
            "oil_add": 15,
            "pulse_add": 25,
            "rice_open": 8,
            "wheat_open": 4,
            "oil_open": 1,
            "pulse_open": 2
        }
    ]

    # Insert dummy data
    for r in dummy_records:
        insert_stock(
            user_id=user_id,
            date=r['date'],
            grade=r['grade'],
            rice_add=r['rice_add'],
            wheat_add=r['wheat_add'],
            oil_add=r['oil_add'],
            pulse_add=r['pulse_add'],
            rice_open=r['rice_open'],
            wheat_open=r['wheat_open'],
            oil_open=r['oil_open'],
            pulse_open=r['pulse_open']
        )
    print("Dummy stock records inserted successfully.")

    # Fetch data for January 2026
    fetched = get_stock_records(user_id=user_id, year=2026, month=1)
    print("Fetched stock records:")
    for f in fetched:
        print(f)

def test_stock_calculations():
    user_id = "9d16f34f-9cf4-47ee-9cf4-3717f42f1e23"
    year = 2026
    month = 1

    # Fetch stock and meal data
    stock_records = get_stock_records(user_id, year, month)
    meal_plans = get_meal_plans(user_id, year, month)

    print(f"stock records : {stock_records}")

    # Meal lookup
    meal_lookup = {}
    for meal in meal_plans:
        date_key = meal['date'] if isinstance(meal['date'], str) else meal['date'].isoformat()
        meal_lookup[date_key] = meal

    # Process calculations
    result = []

    
    for r in stock_records:
        date_key = r['date'] if isinstance(r['date'], str) else r['date'].isoformat()
        grade = r['grade']
        is_1to5 = grade == '1-5'

        print("f")

        meal_data = meal_lookup.get(date_key, {})
        cnt = meal_data.get('cnt_1to5' if is_1to5 else 'cnt_6to10', 0)
        meal_type = meal_data.get('meal_type')
        has_pulses = meal_data.get('has_pulses', False)

        rice_used = wheat_used = oil_used = pulse_used = 0
        if cnt and meal_type:
            rice_rate = 0.1 if is_1to5 else 0.15
            wheat_rate = 0.1 if is_1to5 else 0.15
            oil_rate = 0.005 if is_1to5 else 0.0075
            pulse_rate = 0.02 if is_1to5 else 0.03

            if meal_type == 'rice':
                rice_used = cnt * rice_rate
            elif meal_type == 'wheat':
                wheat_used = cnt * wheat_rate

            oil_used = cnt * oil_rate
            if has_pulses:
                pulse_used = cnt * pulse_rate

        result.append({
            'date': date_key,
            'grade': grade,
            'rice_add': float(r['rice_add']) if r['rice_add'] else 0,
            'wheat_add': float(r['wheat_add']) if r['wheat_add'] else 0,
            'oil_add': float(r['oil_add']) if r['oil_add'] else 0,
            'pulse_add': float(r['pulse_add']) if r['pulse_add'] else 0,
            'rice_open': float(r['rice_open']) if r['rice_open'] else None,
            'wheat_open': float(r['wheat_open']) if r['wheat_open'] else None,
            'oil_open': float(r['oil_open']) if r['oil_open'] else None,
            'pulse_open': float(r['pulse_open']) if r['pulse_open'] else None,
            'rice_used': round(rice_used, 3),
            'wheat_used': round(wheat_used, 3),
            'oil_used': round(oil_used, 3),
            'pulse_used': round(pulse_used, 3),
        })

    # Print final result
    for r in result:
        print(r)

# Run the test
test_stock_calculations()



# test_stock_functions()


