from supabase import create_client
import os
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

# Initialize Supabase client
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")

if not url or not key:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY environment variables are required")

supabase = create_client(url, key)


def insert_egg_record(
    user_id,
    date,
    payer,
    egg_m,
    egg_f,
    banana_m,
    banana_f
):
    """Insert or update egg/banana record"""
    try:
        result = supabase.table("egg").upsert(
            {
                "user_id": user_id,
                "date": date,
                "payer": payer,
                "egg_m": egg_m,
                "egg_f": egg_f,
                "banana_m": banana_m,
                "banana_f": banana_f,
            },
            on_conflict="user_id,date"
        ).execute()

        return result.data[0] if result.data else None

    except Exception as e:
        print(f"Error inserting egg record: {e}")
        raise


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

def get_egg_rates(user_id, year, month):
    """Get the saved egg rates row for an exact month, or None"""
    try:
        result = (
            supabase
            .table("egg_rates")
            .select("*")
            .eq("user_id", user_id)
            .eq("year", year)
            .eq("month", month)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None

    except Exception as e:
        print(f"Error getting egg rates: {e}")
        raise


def get_latest_egg_rates_before(user_id, year, month):
    """Get the nearest earlier saved egg rates row, or None"""
    try:
        result = (
            supabase
            .table("egg_rates")
            .select("*")
            .eq("user_id", user_id)
            .or_(f"year.lt.{year},and(year.eq.{year},month.lt.{month})")
            .order("year", desc=True)
            .order("month", desc=True)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None

    except Exception as e:
        print(f"Error getting earlier egg rates: {e}")
        raise


def upsert_egg_rates(user_id, year, month, row_dict):
    """Insert or update the egg rates row for one month"""
    try:
        payload = {
            **row_dict,
            "user_id": user_id,
            "year": year,
            "month": month,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        result = (
            supabase
            .table("egg_rates")
            .upsert(payload, on_conflict="user_id,year,month")
            .execute()
        )
        return result.data[0] if result.data else None

    except Exception as e:
        print(f"Error saving egg rates: {e}")
        raise

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

def get_meal_rates(user_id, year, month):
    """Get the saved meal rates row for an exact month, or None"""
    try:
        result = (
            supabase
            .table("meal_rates")
            .select("*")
            .eq("user_id", user_id)
            .eq("year", year)
            .eq("month", month)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None

    except Exception as e:
        print(f"Error getting meal rates: {e}")
        raise


def get_latest_meal_rates_before(user_id, year, month):
    """Get the nearest earlier saved meal rates row, or None"""
    try:
        result = (
            supabase
            .table("meal_rates")
            .select("*")
            .eq("user_id", user_id)
            .or_(f"year.lt.{year},and(year.eq.{year},month.lt.{month})")
            .order("year", desc=True)
            .order("month", desc=True)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None

    except Exception as e:
        print(f"Error getting earlier meal rates: {e}")
        raise


def upsert_meal_rates(user_id, year, month, row_dict):
    """Insert or update the meal rates row for one month"""
    try:
        payload = {
            **row_dict,
            "user_id": user_id,
            "year": year,
            "month": month,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        result = (
            supabase
            .table("meal_rates")
            .upsert(payload, on_conflict="user_id,year,month")
            .execute()
        )
        return result.data[0] if result.data else None

    except Exception as e:
        print(f"Error saving meal rates: {e}")
        raise


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
        }, on_conflict="user_id,date").execute()
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
        return result.data
    except Exception as e:
        print(f"Error getting milk records: {e}")
        raise e


def get_milk_rates(user_id, year, month):
    """Get the saved milk rates row for an exact month, or None"""
    try:
        result = (
            supabase
            .table("milk_rates")
            .select("*")
            .eq("user_id", user_id)
            .eq("year", year)
            .eq("month", month)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None

    except Exception as e:
        print(f"Error getting milk rates: {e}")
        raise


def get_latest_milk_rates_before(user_id, year, month):
    """Get the nearest earlier saved milk rates row, or None"""
    try:
        result = (
            supabase
            .table("milk_rates")
            .select("*")
            .eq("user_id", user_id)
            .or_(f"year.lt.{year},and(year.eq.{year},month.lt.{month})")
            .order("year", desc=True)
            .order("month", desc=True)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None

    except Exception as e:
        print(f"Error getting earlier milk rates: {e}")
        raise


def upsert_milk_rates(user_id, year, month, row_dict):
    """Insert or update the milk rates row for one month"""
    try:
        payload = {
            **row_dict,
            "user_id": user_id,
            "year": year,
            "month": month,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        result = (
            supabase
            .table("milk_rates")
            .upsert(payload, on_conflict="user_id,year,month")
            .execute()
        )
        return result.data[0] if result.data else None

    except Exception as e:
        print(f"Error saving milk rates: {e}")
        raise

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

        result = supabase.table("stock").upsert(data, on_conflict="user_id,date,grade").execute()
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



def query_db(query, args=(), one=False):
    """
    Execute raw SQL queries using Supabase
    This maintains compatibility with existing code while using Supabase
    """
    try:
        # For raw SQL queries, we'll use Supabase's rpc function
        # Note: This requires creating a PostgreSQL function in Supabase
        # For now, we'll use the table operations where possible
        
        # This is a simplified approach - in production you might want to 
        # create stored procedures in Supabase for complex queries
        if query.strip().upper().startswith('SELECT') or 'RETURNING' in query.upper():
            # For SELECT queries, we'll need to adapt based on the specific query
            # This is a placeholder - you'll need to implement specific query handling
            result = _execute_raw_query(query, args)
            return (result[0] if result else None) if one else result
        else:
            # For INSERT/UPDATE/DELETE
            result = _execute_raw_query(query, args)
            return result
    except Exception as e:
        print(f"Database error: {e}")
        raise e

def _execute_raw_query(query, args):
    """
    Execute raw SQL query using Supabase
    Note: This is a simplified implementation
    """
    # This is a placeholder implementation
    # In practice, you might need to use Supabase's REST API or create RPC functions
    # For now, we'll return empty results to maintain compatibility
    return []

# Supabase table operation functions
def insert_user(email, name, google_id):
    """Insert a new user"""
    try:
        result = supabase.table("users").insert({
            "email": email,
            "name": name,
            "google_id": google_id
        }).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        print(f"Error inserting user: {e}")
        raise e

def get_user_by_google_id(google_id):
    """Get user by Google ID"""
    try:
        result = supabase.table("users").select("*").eq("google_id", google_id).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        print(f"Error getting user: {e}")
        raise e

def utc_now_iso():
    """Current time in UTC as an ISO 8601 string, for timestamp filters and columns"""
    return datetime.now(timezone.utc).isoformat()


def get_active_subscription(user_id):
    """Get active subscription for user"""
    try:
        result = supabase.table("subscriptions").select("*").eq("user_id", user_id).eq("status", "active").gte("end_date", utc_now_iso()).order("end_date", desc=True).limit(1).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        print(f"Error getting subscription: {e}")
        raise e


def insert_payment(user_id, order_id, plan, amount, status="pending"):
    """Insert payment record"""
    try:
        result = supabase.table("payments").insert({
            "user_id": user_id,
            "order_id": order_id,
            "plan": plan,
            "amount": amount,
            "status": status
        }).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        print(f"Error inserting payment: {e}")
        raise e

def get_payment_by_order_id(order_id):
    """Get payment by order ID"""
    try:
        result = supabase.table("payments").select("*").eq("order_id", order_id).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        print(f"Error getting payment: {e}")
        raise e

def update_payment_status(order_id, status, pp_data=None):
    """Update payment status"""
    try:
        data = {"status": status, "updated_at": utc_now_iso()}
        if pp_data:
            data["pp_data"] = pp_data
            
        result = supabase.table("payments").update(data).eq("order_id", order_id).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        print(f"Error updating payment: {e}")
        raise e

def insert_subscription(user_id, payment_id, start_date, end_date, status="active"):
    """Insert subscription record. The plan is not stored here: payments.plan is the single source of truth."""
    try:
        result = supabase.table("subscriptions").insert({
            "user_id": user_id,
            "payment_id": payment_id,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "status": status
        }).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        print(f"Error inserting subscription: {e}")
        raise e

def get_subscription_by_payment_id(payment_id):
    """Get the subscription created for a payment, or None"""
    try:
        result = supabase.table("subscriptions").select("*").eq("payment_id", payment_id).limit(1).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        print(f"Error getting subscription by payment: {e}")
        raise e

def get_recent_pending_payment(user_id, since_iso):
    """Get a pending payment of this user created at or after since_iso, or None.
    Assumes payments.created_at exists. 'pending' is the lowercase value insert_payment writes."""
    try:
        result = supabase.table("payments").select("*").eq("user_id", user_id).eq("status", "pending").gte("created_at", since_iso).limit(1).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        print(f"Error getting recent pending payment: {e}")
        raise e

def get_pending_payments_for_user(user_id, since_iso, limit=3):
    """Get the user's unfinished payments created at or after since_iso, newest first.
    Matches 'pending' (written by insert_payment) and 'PENDING' (written by the status check)."""
    try:
        result = supabase.table("payments").select("*").eq("user_id", user_id).in_("status", ["pending", "PENDING"]).gte("created_at", since_iso).order("created_at", desc=True).limit(limit).execute()
        return result.data or []
    except Exception as e:
        print(f"Error getting pending payments: {e}")
        raise e

def get_subscription_by_user_id(user_id):
    """Get active subscription by user ID, with the plan from its payment (payments.plan)"""
    try:
        result = supabase.table("subscriptions").select("*, payments(plan)").eq("user_id", user_id).eq("status", "active").gte("end_date", utc_now_iso()).order("end_date", desc=True).limit(1).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        print(f"Error getting subscription: {e}")
        raise e

def get_subscription_history(user_id):
    """Get subscription history for user"""
    try:
        result = supabase.table("subscriptions").select("*, payments(order_id, amount, status, plan)").eq("user_id", user_id).order("created_at", desc=True).execute()
        return result.data
    except Exception as e:
        print(f"Error getting subscription history: {e}")
        raise e

def check_active_subscription(user_id):
    """Check if user has active subscription"""
    try:
        result = supabase.table("subscriptions").select("id").eq("user_id", user_id).eq("status", "active").gte("end_date", utc_now_iso()).limit(1).execute()
        return len(result.data) > 0
    except Exception as e:
        print(f"Error checking subscription: {e}")
        raise e

def expire_old_subscriptions():
    """Expire old subscriptions"""
    try:
        result = supabase.table("subscriptions").update({"status": "expired"}).eq("status", "active").lt("end_date", utc_now_iso()).execute()
        return result.data
    except Exception as e:
        print(f"Error expiring subscriptions: {e}")
        raise e
