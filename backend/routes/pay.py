from flask import Blueprint, request, jsonify
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
from dotenv import load_dotenv

load_dotenv()

pay_bp = Blueprint('pay', __name__)

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


PHONEPE_CLIENT_ID = os.getenv("PHONEPE_CLIENT_ID")
PHONEPE_CLIENT_SECRET = os.getenv("PHONEPE_CLIENT_SECRET")
CLIENT_VERSION = os.getenv("CLIENT_VERSION")


# Initialize client only once for Production
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

@pay_bp.route('/create', methods=['POST'])
def create_payment():
    data = request.json
    user_id = data.get('user_id')
    plan = data.get('plan')
    
    if not user_id or not plan:
        return jsonify({"error": "User ID and plan required"}), 400
    
    if plan not in PLAN_PRICES:
        return jsonify({"error": "Invalid plan"}), 400
    
    # PhonePe expects amount in PAISE (1 INR = 100 Paise)
    amount_in_paise = int(PLAN_PRICES[plan] * 100)
    unique_order_id = str(uuid4()).replace('-', '')[:32]
    
    # Use environment variable for BASE_URL or fallback to a hardcoded prod domain
    base_url = os.getenv('BASE_URL', 'https://yourdomain.com').rstrip('/')
    ui_redirect_url = f"{base_url}/pay/status?orderId={unique_order_id}"
    
    meta_info = MetaInfo(udf1=plan, udf2=f"user_{user_id}", udf3="subscription_payment")
    
    try:
        standard_pay_request = StandardCheckoutPayRequest.build_request(
            merchant_order_id=unique_order_id,
            amount=amount_in_paise,
            redirect_url=ui_redirect_url,
            meta_info=meta_info,
        )
        
        response = client.pay(standard_pay_request)
        
        # Log to DB BEFORE sending user to payment page
        insert_payment(user_id, unique_order_id, plan, PLAN_PRICES[plan])
        
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
    try:
        # Fetch status from PhonePe (merchant_order_id is the unique_order_id we sent)
        response = client.get_order_status(order_id, details=False)
        state = response.state  # COMPLETED, FAILED, or PENDING
        
        payment = get_payment_by_order_id(order_id)
        if not payment:
            return jsonify({"error": "Transaction record not found"}), 404

        if payment['status'] != 'COMPLETED' and state == 'COMPLETED':
            # Use __dict__ to serialize response safely
            update_payment_status(order_id, state, json.dumps(response.__dict__, default=str))
            
            plan = payment['plan']
            months = 3 if plan == '3_month' else 1
            start_date = datetime.now()
            end_date = start_date + timedelta(days=30 * months)
            
            insert_subscription(payment['user_id'], payment['id'], plan, start_date, end_date)
            logger.info(f"Subscription activated for order {order_id}")
            
        elif payment['status'] != state:
             update_payment_status(order_id, state, json.dumps(response.__dict__, default=str))
        
        return jsonify({
            "success": True,
            "status": state
        })
        
    except Exception as e:
        logger.error(f"Status Check Error for {order_id}: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500