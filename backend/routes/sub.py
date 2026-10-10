import hmac
import os
from flask import Blueprint, request, jsonify, g
from auth_session import login_required
from db import get_subscription_by_user_id, get_subscription_history, check_active_subscription, expire_old_subscriptions
from datetime import datetime
import logging
from routes.pay import reconcile_pending_payments

sub_bp = Blueprint('sub', __name__)
logger = logging.getLogger(__name__)

def _plan_from_payment(sub, keep_payment):
    """Subscriptions no longer store the plan; it comes from the joined payment.
    The response field stays `plan_type` so the frontend does not break."""
    payment = sub.get('payments') or {}
    sub['plan_type'] = payment.get('plan')
    if not keep_payment:
        sub.pop('payments', None)

@sub_bp.route('/active', methods=['GET'])
@login_required
def get_active_subscription():
    """Get user's active subscription"""
    user_id = g.user_id
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400
    
    sub = get_subscription_by_user_id(user_id)
    
    if sub:
        _plan_from_payment(sub, keep_payment=False)
        sub['id'] = str(sub['id'])
        sub['user_id'] = str(sub['user_id'])
        sub['payment_id'] = str(sub['payment_id']) if sub.get('payment_id') else None
        # Handle date formatting - Supabase might return strings
        if isinstance(sub['start_date'], str):
            sub['start_date'] = sub['start_date']
        else:
            sub['start_date'] = sub['start_date'].isoformat()
        if isinstance(sub['end_date'], str):
            sub['end_date'] = sub['end_date']
        else:
            sub['end_date'] = sub['end_date'].isoformat()
        if isinstance(sub['created_at'], str):
            sub['created_at'] = sub['created_at']
        else:
            sub['created_at'] = sub['created_at'].isoformat()
        
    return jsonify(sub)

@sub_bp.route('/history', methods=['GET'])
@login_required
def get_subscription_history_route():
    """Get user's subscription history"""
    user_id = g.user_id
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400
    
    subs = get_subscription_history(user_id)
    
    if subs:
        for sub in subs:
            _plan_from_payment(sub, keep_payment=True)
            sub['id'] = str(sub['id'])
            sub['user_id'] = str(sub['user_id'])
            sub['payment_id'] = str(sub['payment_id']) if sub.get('payment_id') else None
            # Handle date formatting
            if isinstance(sub['start_date'], str):
                sub['start_date'] = sub['start_date']
            else:
                sub['start_date'] = sub['start_date'].isoformat()
            if isinstance(sub['end_date'], str):
                sub['end_date'] = sub['end_date']
            else:
                sub['end_date'] = sub['end_date'].isoformat()
            if isinstance(sub['created_at'], str):
                sub['created_at'] = sub['created_at']
            else:
                sub['created_at'] = sub['created_at'].isoformat()
            
    return jsonify(subs or [])

@sub_bp.route('/check', methods=['GET'])
@login_required
def check_subscription():
    """Check if user has valid subscription"""
    user_id = g.user_id
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400
    
    # A user who paid and closed the browser never reached /api/pay/status, so
    # re-check their recent unfinished payments first. Must never break this route.
    try:
        reconcile_pending_payments(user_id)
    except Exception as e:
        logger.error(f"Payment reconcile failed for user {user_id}: {type(e).__name__}")

    has_active = check_active_subscription(user_id)
    
    return jsonify({
        'has_active_subscription': has_active
    })

@sub_bp.route('/expire', methods=['POST'])
def expire_subscriptions():
    """Expire old subscriptions (cron job). Requires the X-Cron-Secret header."""
    # Fails closed: if CRON_SECRET is not set, nobody can call this
    cron_secret = os.getenv('CRON_SECRET')
    # Compare bytes: compare_digest raises TypeError on non-ASCII str
    provided = request.headers.get('X-Cron-Secret', '')
    if not cron_secret or not hmac.compare_digest(provided.encode('utf-8'), cron_secret.encode('utf-8')):
        return jsonify({'error': 'Forbidden'}), 403

    try:
        expire_old_subscriptions()
        return jsonify({'status': 'success'})
    except Exception:
        logger.exception('Subscription expiry job failed')
        return jsonify({'error': 'Internal error'}), 500

