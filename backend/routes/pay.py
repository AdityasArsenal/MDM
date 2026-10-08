"""
PhonePe Payment Gateway Integration

This module handles subscription payments using PhonePe Standard Checkout API.

PAYMENT FLOW:
1. Frontend calls POST /api/pay/create with plan (user comes from the Bearer token)
2. Backend creates payment record in DB (status='pending')
3. Backend returns PhonePe payment URL to frontend
4. User completes payment on PhonePe
5. PhonePe redirects the user to /api/pay/status/{order_id}
   (if the user never comes back, GET /api/sub/check re-checks their recent
   unfinished payments through reconcile_pending_payments)
6. The status check asks PhonePe for the order state, updates the payment,
   creates the subscription if COMPLETED, and redirects to the frontend
   success/failure page. This is the only path that creates subscriptions.

SECURITY:
- Idempotent processing prevents duplicate subscriptions
- All sensitive data in environment variables

ENVIRONMENT VARIABLES REQUIRED:
- PHONEPE_CLIENT_ID, PHONEPE_CLIENT_SECRET, CLIENT_VERSION (payments return 503 if missing)
- PHONEPE_ENV: 'production' (default) or 'sandbox'
- BASE_URL (backend base URL)
- FRONTEND_SUCCESS_URL, FRONTEND_FAILED_URL
"""

from flask import Blueprint, request, jsonify, redirect, g
from auth_session import login_required
from db import insert_payment, get_payment_by_order_id, update_payment_status, insert_subscription, get_subscription_by_payment_id, get_recent_pending_payment, get_pending_payments_for_user
from uuid import uuid4
from phonepe.sdk.pg.payments.v2.standard_checkout_client import StandardCheckoutClient
from phonepe.sdk.pg.payments.v2.models.request.standard_checkout_pay_request import StandardCheckoutPayRequest
from phonepe.sdk.pg.common.models.request.meta_info import MetaInfo
from phonepe.sdk.pg.env import Env
import json
import logging
from datetime import datetime, timedelta, timezone
import os
import threading
from dotenv import load_dotenv

load_dotenv()

pay_bp = Blueprint('pay', __name__)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment variables
PHONEPE_CLIENT_ID = os.getenv("PHONEPE_CLIENT_ID")
PHONEPE_CLIENT_SECRET = os.getenv("PHONEPE_CLIENT_SECRET")
CLIENT_VERSION = os.getenv("CLIENT_VERSION")
BASE_URL = os.getenv("BASE_URL")  # backend base URL
FRONTEND_SUCCESS_URL = os.getenv("FRONTEND_SUCCESS_URL")  # https://gov.nonexistential.dev/dashboard
FRONTEND_FAILED_URL = os.getenv("FRONTEND_FAILED_URL")    # https://gov.nonexistential.dev/payment

# A user cannot start a new payment while one they created is still pending within this window
PENDING_ORDER_WINDOW_SECONDS = 120

# PhonePe expires an unpaid order after this many seconds and then reports a terminal state
PAYMENT_EXPIRE_SECONDS = 1200

# Unfinished payments newer than this are re-checked with PhonePe when the user opens the dashboard.
# Kept short: once PhonePe expires an order it reports FAILED, so reconcile marks it and stops asking.
RECONCILE_WINDOW_HOURS = 2
RECONCILE_MAX_PAYMENTS = 3

def _required_price(env_name):
    """Read a plan price in rupees from the environment. Fails fast if missing or invalid."""
    raw = os.getenv(env_name)
    if not raw:
        raise RuntimeError(f"{env_name} environment variable is required")
    try:
        price = float(raw)
    except ValueError:
        raise RuntimeError(f"{env_name} must be a number, got {raw!r}")
    if price <= 0:
        raise RuntimeError(f"{env_name} must be greater than 0")
    return price

# Plan prices in rupees. Only these two plans exist; prices come from .env.
PLAN_PRICES = {
    '1_month': _required_price("ONE_MONTH_PRICE"),
    '3_month': _required_price("THREE_MONTH_PRICE"),
}

PHONEPE_ENVS = {'production': Env.PRODUCTION, 'sandbox': Env.SANDBOX}
PHONEPE_ENV = os.getenv("PHONEPE_ENV", "production").strip().lower()

class PaymentsNotConfigured(Exception):
    """The PhonePe client cannot be built from the current environment"""

_client = None
_client_lock = threading.Lock()

def get_client():
    """
    Build the PhonePe client on first use and reuse it afterwards.
    Raises PaymentsNotConfigured if credentials or PHONEPE_ENV are missing or invalid,
    so the app can still start and serve non-payment routes.
    """
    global _client
    if _client is not None:
        return _client
    with _client_lock:
        if _client is not None:
            return _client
        if PHONEPE_ENV not in PHONEPE_ENVS:
            raise PaymentsNotConfigured(f"PHONEPE_ENV must be 'production' or 'sandbox', got {PHONEPE_ENV!r}")
        missing = [name for name, value in (
            ("PHONEPE_CLIENT_ID", PHONEPE_CLIENT_ID),
            ("PHONEPE_CLIENT_SECRET", PHONEPE_CLIENT_SECRET),
            ("CLIENT_VERSION", CLIENT_VERSION),
        ) if not value]
        if missing:
            raise PaymentsNotConfigured(f"Missing environment variables: {', '.join(missing)}")
        try:
            _client = StandardCheckoutClient.get_instance(
                client_id=PHONEPE_CLIENT_ID,
                client_secret=PHONEPE_CLIENT_SECRET,
                client_version=CLIENT_VERSION,
                env=PHONEPE_ENVS[PHONEPE_ENV],
                should_publish_events=True
            )
        except Exception as e:
            raise PaymentsNotConfigured(f"PhonePe client could not be created: {e}")
        return _client

def _payments_unavailable(error):
    logger.error(f"Payments unavailable: {error}")
    return jsonify({"error": "Payments are not configured"}), 503

def process_payment_completion(payload):
    """
    Process completed payment and create subscription
    This function is idempotent - safe to call multiple times
    """
    merchant_order_id = payload.get('merchantOrderId')
    state = payload.get('state')
    
    if not merchant_order_id:
        logger.error("Missing merchantOrderId in payload")
        return False
    
    # Always re-read the payment: the caller's copy may be stale
    payment = get_payment_by_order_id(merchant_order_id)
    if not payment:
        logger.error(f"Payment record not found for order {merchant_order_id}")
        return False
    
    # Idempotency check: if already processed as COMPLETED, skip
    if payment['status'] == 'COMPLETED':
        logger.info(f"Payment {merchant_order_id} already processed, skipping")
        return True
    
    if state != 'COMPLETED':
        update_payment_status(merchant_order_id, state, json.dumps(payload, default=str))
        return True

    # COMPLETED: create the subscription first, then mark the payment COMPLETED.
    # If the insert fails the payment stays non-COMPLETED, so a retry can still
    # create the subscription instead of being skipped by the check above.
    try:
        if get_subscription_by_payment_id(payment['id']):
            logger.info(f"Subscription already exists for order {merchant_order_id}, skipping insert")
        else:
            plan = payment['plan']
            months = 3 if plan == '3_month' else 1
            start_date = datetime.now(timezone.utc)
            end_date = start_date + timedelta(days=30 * months)

            insert_subscription(payment['user_id'], payment['id'], plan, start_date, end_date)
            logger.info(f"Subscription created for user {payment['user_id']}, order {merchant_order_id}")
        update_payment_status(merchant_order_id, state, json.dumps(payload, default=str))
        return True
    except Exception as e:
        logger.error(f"Subscription creation failed for {merchant_order_id}: {str(e)}")
        return False


def reconcile_pending_payments(user_id):
    """
    Re-check a user's recent unfinished payments with PhonePe, for the user who paid
    and closed the browser before returning to /status. Looks at the newest
    RECONCILE_MAX_PAYMENTS pending payments from the last RECONCILE_WINDOW_HOURS.

    Never raises: it runs inside another request (the subscription check) and must
    not break it. Returns a summary dict for logging and tests.
    """
    summary = {"checked": 0, "completed": 0, "failed": 0, "errors": 0}
    try:
        since_iso = (datetime.now(timezone.utc) - timedelta(hours=RECONCILE_WINDOW_HOURS)).isoformat()
        payments = (get_pending_payments_for_user(user_id, since_iso, RECONCILE_MAX_PAYMENTS) or [])[:RECONCILE_MAX_PAYMENTS]
        if not payments:
            return summary

        try:
            client = get_client()
        except PaymentsNotConfigured as e:
            logger.error(f"Reconcile skipped, payments unavailable: {e}")
            return summary

        for payment in payments:
            order_id = payment.get('order_id')
            try:
                response = client.get_order_status(order_id, details=False)
                state = response.state
                summary["checked"] += 1
                logger.info(f"Reconcile: order {order_id} is {state}")

                if state == 'COMPLETED':
                    # Idempotent: creates the subscription once, then marks the payment COMPLETED
                    if process_payment_completion({
                        **response.__dict__,
                        'merchantOrderId': order_id,
                        'state': state,
                    }):
                        summary["completed"] += 1
                    else:
                        summary["errors"] += 1
                elif state == 'FAILED':
                    # Re-read so a payment completed in the meantime (e.g. by /status) is never overwritten
                    current = get_payment_by_order_id(order_id)
                    if current and current['status'] != 'COMPLETED':
                        update_payment_status(order_id, 'FAILED', json.dumps(response.__dict__, default=str))
                        summary["failed"] += 1
                # PENDING (or anything else): leave the payment alone
            except Exception as e:
                summary["errors"] += 1
                logger.error(f"Reconcile failed for order {order_id}: {type(e).__name__}")
    except Exception as e:
        summary["errors"] += 1
        logger.error(f"Reconcile error for user {user_id}: {type(e).__name__}")
    return summary


@pay_bp.route('/plans', methods=['GET'])
def get_plans():
    """Plan list and prices (in rupees) so the frontend does not hardcode them"""
    return jsonify({
        plan: {'price': price, 'months': 3 if plan == '3_month' else 1}
        for plan, price in PLAN_PRICES.items()
    })

@pay_bp.route('/create', methods=['POST'])
@login_required
def create_payment():
    """
    Create a new payment and redirect user to PhonePe
    Payment record is inserted BEFORE redirecting to ensure tracking
    """
    try:
        client = get_client()
    except PaymentsNotConfigured as e:
        return _payments_unavailable(e)

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be a JSON object"}), 400

    user_id = g.user_id
    plan = data.get('plan')

    if not user_id:
        return jsonify({"error": "User ID required"}), 400

    if not plan or not isinstance(plan, str):
        return jsonify({"error": "Plan required"}), 400

    if plan not in PLAN_PRICES:
        return jsonify({"error": "Invalid plan"}), 400

    # Block a second order while a recent one is still pending (double click, second tab)
    since_iso = (datetime.now(timezone.utc) - timedelta(seconds=PENDING_ORDER_WINDOW_SECONDS)).isoformat()
    try:
        recent_pending = get_recent_pending_payment(user_id, since_iso)
    except Exception as e:
        logger.error(f"Pending payment check error: {str(e)}")
        return jsonify({"error": "Unauthorized or internal error. Check credentials."}), 500
    if recent_pending:
        logger.info(f"Duplicate payment blocked for user {user_id}: order {recent_pending.get('order_id')} still pending")
        return jsonify({"error": "A payment is already in progress. Please wait a moment."}), 409

    amount_in_paise = int(round(PLAN_PRICES[plan] * 100))
    unique_order_id = str(uuid4()).replace('-', '')[:32]

    # User redirect URL - they come back here after payment
    ui_redirect_url = f"{BASE_URL}/api/pay/status/{unique_order_id}"

    meta_info = MetaInfo(udf1=plan, udf2=f"user_{user_id}", udf3="subscription_payment")

    # Step 1: Insert payment record BEFORE calling PhonePe (critical for tracking)
    try:
        insert_payment(user_id, unique_order_id, plan, PLAN_PRICES[plan], status='pending')
        logger.info(f"Payment record created: order_id={unique_order_id}, user_id={user_id}, plan={plan}")
    except Exception as e:
        logger.error(f"Payment Creation Error: {str(e)}")
        return jsonify({"error": "Unauthorized or internal error. Check credentials."}), 500

    try:
        # Step 2: Create PhonePe payment request
        standard_pay_request = StandardCheckoutPayRequest.build_request(
            merchant_order_id=unique_order_id,
            amount=amount_in_paise,
            redirect_url=ui_redirect_url,
            expire_after=PAYMENT_EXPIRE_SECONDS,
            meta_info=meta_info,
        )

        # Step 3: Get payment URL from PhonePe
        response = client.pay(standard_pay_request)

        return jsonify({
            "success": True,
            "payment_url": response.redirect_url,
            "order_id": unique_order_id
        })

    except Exception as e:
        logger.error(f"Payment Creation Error: {str(e)}")
        # Do not leave a pending row behind for an order the user never got a URL for
        try:
            update_payment_status(unique_order_id, 'FAILED', json.dumps({"error": str(e)[:200]}))
        except Exception as update_error:
            logger.error(f"Could not mark order {unique_order_id} FAILED: {str(update_error)}")
        return jsonify({"error": "Unauthorized or internal error. Check credentials."}), 500

@pay_bp.route('/status/<order_id>', methods=['GET'])
def check_status(order_id):
    """
    User redirect endpoint after payment
    This is the only path that updates payment status and creates subscriptions.
    Always ends in a redirect to a frontend page, never a JSON body.
    """
    try:
        client = get_client()
    except PaymentsNotConfigured as e:
        logger.error(f"Payments unavailable for status check of {order_id}: {e}")
        return redirect(FRONTEND_FAILED_URL)

    try:
        # Get payment record from database
        payment = get_payment_by_order_id(order_id)
        if not payment:
            logger.error(f"Payment record not found for order {order_id}")
            return redirect(FRONTEND_FAILED_URL)
        
        # A COMPLETED payment is final: never overwrite it, whatever PhonePe says now
        if payment['status'] == 'COMPLETED':
            logger.info(f"Order {order_id} already COMPLETED, redirecting to success page")
            return redirect(FRONTEND_SUCCESS_URL)

        # Ask PhonePe for the current state
        try:
            response = client.get_order_status(order_id, details=False)
            state = response.state  # COMPLETED, FAILED, PENDING
            
            # Update status if it changed
            if payment['status'] != state:
                logger.info(f"Status check updating order {order_id}: {payment['status']} -> {state}")
                if state == 'COMPLETED':
                    # process_payment_completion creates the subscription and then marks
                    # the payment COMPLETED (idempotent). Marking it here first would make
                    # it skip the subscription.
                    process_payment_completion({
                        **response.__dict__,
                        'merchantOrderId': order_id,
                        'state': state,
                    })
                else:
                    update_payment_status(order_id, state, json.dumps(response.__dict__, default=str))
            
            # Redirect based on final state
            if state == "COMPLETED":
                logger.info(f"Redirecting to success page for order {order_id}")
                return redirect(FRONTEND_SUCCESS_URL)
            elif state == "FAILED":
                logger.info(f"Redirecting to failed page for order {order_id}")
                return redirect(FRONTEND_FAILED_URL)
            else:
                # PENDING: shares the failed page with FAILED (FRONTEND_FAILED_URL) until a
                # separate pending page exists
                logger.info(f"Payment pending for order {order_id}, redirecting to failed page")
                return redirect(FRONTEND_FAILED_URL)
                
        except Exception as api_error:
            logger.error(f"PhonePe API error for {order_id}: {str(api_error)}")
            # If API fails, use database status
            if payment['status'] == 'COMPLETED':
                return redirect(FRONTEND_SUCCESS_URL)
            else:
                return redirect(FRONTEND_FAILED_URL)
        
    except Exception as e:
        logger.error(f"Status Check Error for {order_id}: {str(e)}")
        return redirect(FRONTEND_FAILED_URL)
