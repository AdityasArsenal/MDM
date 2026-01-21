from flask import Blueprint, request, jsonify, redirect
from db import insert_payment, get_payment_by_order_id, update_payment_status, insert_subscription
from uuid import uuid4
from phonepe.sdk.pg.payments.v2.standard_checkout_client import StandardCheckoutClient
from phonepe.sdk.pg.payments.v2.models.request.standard_checkout_pay_request import StandardCheckoutPayRequest
from phonepe.sdk.pg.common.models.request.meta_info import MetaInfo
from phonepe.sdk.pg.env import Env
import json
from datetime import datetime, timedelta
import os
pay_bp = Blueprint('pay', __name__)

#initialize phonepe client
if os.getenv("PHONEPE_ENV", "PRODUCTION").upper() == "PRODUCTION":
    env = Env.PRODUCTION
else:
    env = Env.SANDBOX  # Use SANDBOX for UAT/testing

client = StandardCheckoutClient.get_instance(
    client_id=os.getenv("PHONEPE_CLIENT_ID"), 
    client_secret=os.getenv("PHONEPE_CLIENT_SECRET"), 
    client_version=os.getenv("PHONEPE_CLIENT_VERSION"), 
    env=env, 
    should_publish_events=False
)

PLAN_PRICES = {
    '1_month': 100,
    '3_month': 250
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
    
    amount = PLAN_PRICES[plan] * 100
    unique_order_id = str(uuid4()).replace('-', '')[:32]
    ui_redirect_url = f"{os.getenv('BASE_URL')}/pay/status?orderId={unique_order_id}"
    
    meta_info = MetaInfo(udf1=plan, udf2=f"amount_{amount/100}", udf3="payment")
    
    try:
        standard_pay_request = StandardCheckoutPayRequest.build_request(
            merchant_order_id=unique_order_id,
            amount=amount,
            redirect_url=ui_redirect_url,
            meta_info=meta_info,
        )
        
        response = client.pay(standard_pay_request)
        checkout_page_url = response.redirect_url
        
        # Log transaction
        insert_payment(user_id, unique_order_id, plan, amount/100)
        
        return jsonify({
            "success": True,
            "payment_url": checkout_page_url,
            "order_id": unique_order_id
        })
        
    except Exception as e:
        print(f"Payment error: {e}")
        return jsonify({"error": str(e)}), 500

@pay_bp.route('/status/<order_id>', methods=['GET'])
def check_status(order_id):
    try:
        response = client.get_order_status(order_id, details=False)
        state = response.state
        
        # Get payment details from DB
        payment = get_payment_by_order_id(order_id)
        
        if not payment:
            return jsonify({"error": "Order not found"}), 404

        if payment['status'] != 'COMPLETED' and state == 'COMPLETED':
            # 1. Update Payment Status
            update_payment_status(order_id, state, json.dumps(str(response)))
            
            # 2. Create Subscription
            plan = payment['plan']
            months = 3 if plan == '3_month' else 1
            start_date = datetime.now()
            end_date = start_date + timedelta(days=30 * months)
            
            insert_subscription(payment['user_id'], payment['id'], plan, start_date, end_date)
            
        elif payment['status'] != state:
             # Just update status if changed but not completed (e.g. FAILED)
             update_payment_status(order_id, state, json.dumps(str(response)))
        
        return jsonify({
            "success": True,
            "status": state
        })
        
    except Exception as e:
        print(f"Status check error: {e}")
        return jsonify({"error": str(e)}), 500
