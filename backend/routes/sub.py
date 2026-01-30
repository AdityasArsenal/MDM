from flask import Blueprint, request, jsonify
from db import get_subscription_by_user_id, get_subscription_history, check_active_subscription, expire_old_subscriptions
from datetime import datetime

sub_bp = Blueprint('sub', __name__)

@sub_bp.route('/active', methods=['GET'])
def get_active_subscription():
    """Get user's active subscription"""
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400
    
    sub = get_subscription_by_user_id(user_id)
    
    if sub:
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
def get_subscription_history_route():
    """Get user's subscription history"""
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400
    
    subs = get_subscription_history(user_id)
    
    if subs:
        for sub in subs:
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
def check_subscription():
    """Check if user has valid subscription"""
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400
    
    has_active = check_active_subscription(user_id)
    
    return jsonify({
        'has_active_subscription': has_active
    })

@sub_bp.route('/expire', methods=['POST'])
def expire_subscriptions():
    """Expire old subscriptions (cron job)"""
    try:
        expire_old_subscriptions()
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

