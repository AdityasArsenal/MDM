"""
PhonePe Payment Gateway Integration with Webhook Support

This module handles subscription payments using PhonePe Standard Checkout API.

WEBHOOK SETUP INSTRUCTIONS:
1. Configure webhook URL in PhonePe dashboard: {BASE_URL}/api/pay/webhook
2. Set webhook username and password in PhonePe dashboard (same as WEBHOOK_USERNAME and WEBHOOK_PASSWORD in .env)
3. PhonePe will send server-to-server notifications to the webhook endpoint
4. Webhook uses SHA256(username:password) for authorization verification

PAYMENT FLOW:
1. Frontend calls POST /api/pay/create with user_id and plan
2. Backend creates payment record in DB (status='pending')
3. Backend returns PhonePe payment URL to frontend
4. User completes payment on PhonePe
5. PhonePe sends webhook notification to /api/pay/webhook (primary method)
6. Webhook updates payment status and creates subscription
7. User is redirected to /api/pay/status/{order_id} (fallback method)
8. Backend redirects user to frontend success/failure page

SECURITY:
- Webhook signature verification using SHA256
- Idempotent processing prevents duplicate subscriptions
- All sensitive data in environment variables

ENVIRONMENT VARIABLES REQUIRED:
- PHONEPE_CLIENT_ID, PHONEPE_CLIENT_SECRET, CLIENT_VERSION
- BASE_URL (backend base URL)
- FRONTEND_SUCCESS_URL, FRONTEND_FAILED_URL
- WEBHOOK_USERNAME, WEBHOOK_PASSWORD (must match PhonePe dashboard config)
"""

from flask import Blueprint, request, jsonify, redirect
from db import insert_payment, get_payment_by_order_id, update_payment_status, insert_subscription
from uuid import uuid4
from phonepe.sdk.pg.payments.v2.standard_checkout_client import StandardCheckoutClient
from phonepe.sdk.pg.payments.v2.models.request.standard_checkout_pay_request import StandardCheckoutPayRequest
from phonepe.sdk.pg.common.models.request.meta_info import MetaInfo
from phonepe.sdk.pg.env import Env
import json
import logging
from datetime import datetime, timedelta
import os
import hashlib
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

# Webhook authentication credentials (configure these in PhonePe dashboard)
WEBHOOK_USERNAME = os.getenv("WEBHOOK_USERNAME", "webhook_user")
WEBHOOK_PASSWORD = os.getenv("WEBHOOK_PASSWORD", "webhook_pass")

client = StandardCheckoutClient.get_instance(
    client_id=PHONEPE_CLIENT_ID, 
    client_secret=PHONEPE_CLIENT_SECRET, 
    client_version=CLIENT_VERSION, 
    env=Env.PRODUCTION,
    should_publish_events=True
)

PLAN_PRICES = {
    '1_month': 1,
    '3_month': 2
}

def verify_webhook_signature(authorization_header):
    """
    Verify webhook signature from PhonePe
    PhonePe sends SHA256(username:password) in Authorization header
    """
    try:
        expected_auth = hashlib.sha256(f"{WEBHOOK_USERNAME}:{WEBHOOK_PASSWORD}".encode()).hexdigest()
        return authorization_header == expected_auth
    except Exception as e:
        logger.error(f"Signature verification error: {str(e)}")
        return False


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
    
    # Get existing payment record
    payment = get_payment_by_order_id(merchant_order_id)
    if not payment:
        logger.error(f"Payment record not found for order {merchant_order_id}")
        return False
    
    # Idempotency check: if already processed as COMPLETED, skip
    if payment['status'] == 'COMPLETED':
        logger.info(f"Payment {merchant_order_id} already processed, skipping")
        return True
    
    # Update payment status with full payload
    update_payment_status(merchant_order_id, state, json.dumps(payload, default=str))
    
    # Create subscription only if payment completed successfully
    if state == 'COMPLETED':
        try:
            plan = payment['plan']
            months = 3 if plan == '3_month' else 1
            start_date = datetime.now()
            end_date = start_date + timedelta(days=30 * months)
            
            insert_subscription(payment['user_id'], payment['id'], plan, start_date, end_date)
            logger.info(f"Subscription created for user {payment['user_id']}, order {merchant_order_id}")
            return True
        except Exception as e:
            logger.error(f"Subscription creation failed for {merchant_order_id}: {str(e)}")
            return False
    
    return True


@pay_bp.route('/webhook', methods=['POST'])
def webhook():
    """
    PhonePe webhook endpoint for server-to-server payment notifications
    This is the primary method for reliable payment confirmation
    
    Configure this URL in PhonePe dashboard: {BASE_URL}/api/pay/webhook
    Also configure WEBHOOK_USERNAME and WEBHOOK_PASSWORD in PhonePe dashboard
    """
    try:
        # Step 1: Verify authorization header
        auth_header = request.headers.get('Authorization', '')
        if not verify_webhook_signature(auth_header):
            logger.warning(f"Webhook signature verification failed. Auth header: {auth_header[:20]}...")
            return jsonify({"status": "error", "message": "Unauthorized"}), 401
        
        # Step 2: Parse webhook payload
        webhook_data = request.json
        if not webhook_data:
            logger.error("Empty webhook payload")
            return jsonify({"status": "error", "message": "Empty payload"}), 400
        
        event_type = webhook_data.get('event')
        payload = webhook_data.get('payload', {})
        
        logger.info(f"Webhook received: event={event_type}, merchantOrderId={payload.get('merchantOrderId')}")
        
        # Step 3: Handle different event types
        if event_type == 'checkout.order.completed':
            success = process_payment_completion(payload)
            if success:
                # Return 200 OK within 3-5 seconds as per PhonePe requirements
                return jsonify({"status": "success", "message": "Payment processed"}), 200
            else:
                return jsonify({"status": "error", "message": "Processing failed"}), 500
                
        elif event_type == 'checkout.order.failed':
            merchant_order_id = payload.get('merchantOrderId')
            if merchant_order_id:
                update_payment_status(merchant_order_id, 'FAILED', json.dumps(payload, default=str))
                logger.info(f"Payment failed for order {merchant_order_id}")
            return jsonify({"status": "success", "message": "Failure recorded"}), 200
        
        else:
            logger.warning(f"Unknown event type: {event_type}")
            return jsonify({"status": "success", "message": "Event ignored"}), 200
            
    except Exception as e:
        logger.error(f"Webhook processing error: {str(e)}")
        # Still return 200 to prevent PhonePe retries for malformed requests
        return jsonify({"status": "error", "message": "Internal error"}), 200


@pay_bp.route('/create', methods=['POST'])
def create_payment():
    """
    Create a new payment and redirect user to PhonePe
    Payment record is inserted BEFORE redirecting to ensure tracking
    """
    data = request.json
    user_id = data.get('user_id')
    plan = data.get('plan')
    
    if not user_id or not plan:
        return jsonify({"error": "User ID and plan required"}), 400
    
    if plan not in PLAN_PRICES:
        return jsonify({"error": "Invalid plan"}), 400
    
    amount_in_paise = int(PLAN_PRICES[plan] * 100)
    unique_order_id = str(uuid4()).replace('-', '')[:32]
    
    # User redirect URL - they come back here after payment
    ui_redirect_url = f"{BASE_URL}/api/pay/status/{unique_order_id}"

    meta_info = MetaInfo(udf1=plan, udf2=f"user_{user_id}", udf3="subscription_payment")
    
    try:
        # Step 1: Insert payment record BEFORE redirecting (critical for tracking)
        insert_payment(user_id, unique_order_id, plan, PLAN_PRICES[plan], status='pending')
        logger.info(f"Payment record created: order_id={unique_order_id}, user_id={user_id}, plan={plan}")
        
        # Step 2: Create PhonePe payment request
        standard_pay_request = StandardCheckoutPayRequest.build_request(
            merchant_order_id=unique_order_id,
            amount=amount_in_paise,
            redirect_url=ui_redirect_url,
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
        return jsonify({"error": "Unauthorized or internal error. Check credentials."}), 500

@pay_bp.route('/status/<order_id>', methods=['GET'])
def check_status(order_id):
    """
    User redirect endpoint after payment
    This is a fallback - primary status updates come via webhook
    Redirects user to appropriate frontend page
    """
    try:
        # Get payment record from database
        payment = get_payment_by_order_id(order_id)
        if not payment:
            logger.error(f"Payment record not found for order {order_id}")
            return redirect(FRONTEND_FAILED_URL)
        
        # Check current status from PhonePe API (fallback if webhook missed)
        try:
            response = client.get_order_status(order_id, details=False)
            state = response.state  # COMPLETED, FAILED, PENDING
            
            # Update status if changed and not already processed by webhook
            if payment['status'] != state:
                logger.info(f"Status check updating order {order_id}: {payment['status']} -> {state}")
                update_payment_status(order_id, state, json.dumps(response.__dict__, default=str))
                
                # Create subscription if completed (idempotent via process_payment_completion)
                if state == 'COMPLETED' and payment['status'] != 'COMPLETED':
                    payload = {
                        'merchantOrderId': order_id,
                        'state': state,
                        'amount': payment['amount'] * 100
                    }
                    process_payment_completion(payload)
            
            # Redirect based on final state
            if state == "COMPLETED":
                logger.info(f"Redirecting to success page for order {order_id}")
                return redirect(FRONTEND_SUCCESS_URL)
            elif state == "FAILED":
                logger.info(f"Redirecting to failed page for order {order_id}")
                return redirect(FRONTEND_FAILED_URL)
            else:
                # PENDING state - redirect to payment page to retry
                logger.info(f"Payment pending for order {order_id}, redirecting to payment page")
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
