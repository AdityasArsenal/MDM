from flask import Blueprint, request, jsonify
from db import get_stock_records, insert_stock, get_meal_plans
from datetime import datetime

stock_bp = Blueprint('stock', __name__)

@stock_bp.route('/<int:year>/<int:month>', methods=['GET'])
def get_stock(year, month):
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400

    records = get_stock_records(user_id, year, month)
    
    if records:
        for r in records:
            r['id'] = str(r['id'])
            r['user_id'] = str(r['user_id'])
            # Handle date formatting
            if isinstance(r['date'], str):
                r['date'] = r['date']
            else:
                r['date'] = r['date'].isoformat()
            # Convert decimals to float
            for key in ['rice_add', 'wheat_add', 'oil_add', 'pulse_add', 
                       'rice_open', 'wheat_open', 'oil_open', 'pulse_open']:
                if r[key] is not None:
                    r[key] = float(r[key])

    return jsonify(records or [])

@stock_bp.route('/save', methods=['POST'])
def save_stock():
    data = request.json
    user_id = data.get('user_id')
    records = data.get('records', [])
    
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400

    try:
        for r in records:
            insert_stock(
                user_id, r['date'], r['grade'],
                r.get('rice_add', 0), r.get('wheat_add', 0), 
                r.get('oil_add', 0), r.get('pulse_add', 0),
                r.get('rice_open'), r.get('wheat_open'), 
                r.get('oil_open'), r.get('pulse_open')
            )
            
        return jsonify({'status': 'success'})
    except Exception as e:
        print(f"Error saving stock: {e}")
        return jsonify({'error': str(e)}), 500

@stock_bp.route('/calc/<int:year>/<int:month>', methods=['GET'])
def get_stock_with_calculations(year, month):
    """Get stock with distribution calculations from meal plans"""
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400

    # Get stock records and meal plans separately
    stock_records = get_stock_records(user_id, year, month)
    meal_plans = get_meal_plans(user_id, year, month)
    
    if not stock_records:
        return jsonify([])
    
    # Create a lookup for meal plans by date
    meal_lookup = {}
    for meal in meal_plans:
        date_key = meal['date'] if isinstance(meal['date'], str) else meal['date'].isoformat()
        meal_lookup[date_key] = meal
    
    # Process and calculate distributions
    result = []
    for r in stock_records:
        date_key = r['date'] if isinstance(r['date'], str) else r['date'].isoformat()
        grade = r['grade']
        is_1to5 = grade == '1to5'
        
        # Get meal data for this date
        meal_data = meal_lookup.get(date_key, {})
        cnt = meal_data.get('cnt_1to5' if is_1to5 else 'cnt_6to8', 0)
        meal_type = meal_data.get('meal_type')
        has_pulses = meal_data.get('has_pulses', False)
        
        # Calculate distribution based on meal type and counts
        rice_used = 0
        wheat_used = 0
        oil_used = 0
        pulse_used = 0
        
        if cnt and meal_type:
            # Rice/wheat rates
            grain_rate = 0.1 if is_1to5 else 0.15
            oil_rate = 0.005 if is_1to5 else 0.0075
            pulse_rate = 0.02 if is_1to5 else 0.03
            
            if meal_type == 'rice':
                rice_used = cnt * grain_rate
            elif meal_type == 'wheat':
                wheat_used = cnt * grain_rate
            
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
    
    return jsonify(result)

