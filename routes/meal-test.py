from flask import Blueprint, request, jsonify
from datetime import datetime
import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")

if not url or not key:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY environment variables are required")

supabase = create_client(url, key)

def insert_meal_plan(
    user_id,
    date,
    cnt_1to5,
    cnt_6to10,
    meal_type,
    has_pulses
):
    """Insert or update meal plan"""
    try:
        result = (
            supabase
            .table("meal_plans")
            .upsert(
                {
                    "user_id": user_id,
                    "date": date,
                    "cnt_1to5": cnt_1to5,
                    "cnt_6to10": cnt_6to10,
                    "meal_type": meal_type,
                    "has_pulses": has_pulses,
                },
                on_conflict="user_id,date"
            )
            .execute()
        )

        return result.data[0] if result.data else None

    except Exception as e:
        print(f"Error inserting meal plan: {e}")
        raise


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

def test_meal_plans():
    user_id = "9d16f34f-9cf4-47ee-9cf4-3717f42f1e23"

    # 1️⃣ Insert dummy meal plan
    inserted = insert_meal_plan(
        user_id=user_id,
        date="2026-01-01",
        cnt_1to5=3,
        cnt_6to10=5,
        meal_type="rice",
        has_pulses=True
    )
    print("Inserted record:", inserted)

    # 2️⃣ Fetch dummy meal plan
    meals = get_meal_plans(user_id, year=2222, month=2)
    print("Fetched records:", meals)

if __name__ == "__main__":
    test_meal_plans()