from flask import Blueprint, request, jsonify
from db import query_db
from datetime import datetime

sub_bp = Blueprint('sub', __name__)

@sub_bp.route('/active', methods=['GET'])
def get_active_subscription():
    """Get user's active subscription"""
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400
    
    query = """
        SELECT * FROM subscriptions 
        WHERE user_id = %s 
        AND status = 'active'
        AND end_date > now()
        ORDER BY created_at DESC
        LIMIT 1
    """
    sub = query_db(query, (user_id,), one=True)
    
    if sub:
        sub['id'] = str(sub['id'])
        sub['user_id'] = str(sub['user_id'])
        sub['payment_id'] = str(sub['payment_id']) if sub.get('payment_id') else None
        sub['start_date'] = sub['start_date'].isoformat()
        sub['end_date'] = sub['end_date'].isoformat()
        sub['created_at'] = sub['created_at'].isoformat()
        
    return jsonify(sub)

@sub_bp.route('/history', methods=['GET'])
def get_subscription_history():
    """Get user's subscription history"""
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400
    
    query = """
        SELECT s.*, p.order_id, p.amount, p.status as payment_status
        FROM subscriptions s
        LEFT JOIN payments p ON s.payment_id = p.id
        WHERE s.user_id = %s
        ORDER BY s.created_at DESC
    """
    subs = query_db(query, (user_id,))
    
    if subs:
        for sub in subs:
            sub['id'] = str(sub['id'])
            sub['user_id'] = str(sub['user_id'])
            sub['payment_id'] = str(sub['payment_id']) if sub.get('payment_id') else None
            sub['start_date'] = sub['start_date'].isoformat()
            sub['end_date'] = sub['end_date'].isoformat()
            sub['created_at'] = sub['created_at'].isoformat()
            
    return jsonify(subs or [])

@sub_bp.route('/check', methods=['GET'])
def check_subscription():
    """Check if user has valid subscription"""
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400
    
    query = """
        SELECT EXISTS(
            SELECT 1 FROM subscriptions 
            WHERE user_id = %s 
            AND status = 'active'
            AND end_date > now()
        ) as has_active
    """
    result = query_db(query, (user_id,), one=True)
    
    return jsonify({
        'has_active_subscription': result['has_active'] if result else False
    })

@sub_bp.route('/expire', methods=['POST'])
def expire_subscriptions():
    """Expire old subscriptions (cron job)"""
    try:
        query_db("""
            UPDATE subscriptions 
            SET status = 'expired'
            WHERE status = 'active' 
            AND end_date < now()
        """)
        
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

