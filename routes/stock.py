from flask import Blueprint, request, jsonify
from db import query_db
from datetime import datetime

stock_bp = Blueprint('stock', __name__)

@stock_bp.route('/<int:year>/<int:month>', methods=['GET'])
def get_stock(year, month):
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400

    query = """
        SELECT * FROM stock 
        WHERE user_id = %s 
        AND EXTRACT(YEAR FROM date) = %s 
        AND EXTRACT(MONTH FROM date) = %s
        ORDER BY date ASC, grade ASC
    """
    records = query_db(query, (user_id, year, month))
    
    if records:
        for r in records:
            r['id'] = str(r['id'])
            r['user_id'] = str(r['user_id'])
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
            query_db("""
                INSERT INTO stock (
                    user_id, date, grade, 
                    rice_add, wheat_add, oil_add, pulse_add,
                    rice_open, wheat_open, oil_open, pulse_open
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (user_id, date, grade) 
                DO UPDATE SET 
                    rice_add = EXCLUDED.rice_add,
                    wheat_add = EXCLUDED.wheat_add,
                    oil_add = EXCLUDED.oil_add,
                    pulse_add = EXCLUDED.pulse_add,
                    rice_open = EXCLUDED.rice_open,
                    wheat_open = EXCLUDED.wheat_open,
                    oil_open = EXCLUDED.oil_open,
                    pulse_open = EXCLUDED.pulse_open
            """, (
                user_id, r['date'], r['grade'],
                r.get('rice_add', 0), r.get('wheat_add', 0), 
                r.get('oil_add', 0), r.get('pulse_add', 0),
                r.get('rice_open'), r.get('wheat_open'), 
                r.get('oil_open'), r.get('pulse_open')
            ))
            
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

    query = """
        SELECT 
            s.date,
            s.grade,
            s.rice_add, s.wheat_add, s.oil_add, s.pulse_add,
            s.rice_open, s.wheat_open, s.oil_open, s.pulse_open,
            mp.cnt_1to5, mp.cnt_6to8, mp.meal_type, mp.has_pulses
        FROM stock s
        LEFT JOIN meal_plans mp ON s.user_id = mp.user_id AND s.date = mp.date
        WHERE s.user_id = %s 
        AND EXTRACT(YEAR FROM s.date) = %s 
        AND EXTRACT(MONTH FROM s.date) = %s
        ORDER BY s.date ASC, s.grade ASC
    """
    records = query_db(query, (user_id, year, month))
    
    if not records:
        return jsonify([])
    
    # Process and calculate distributions
    result = []
    for r in records:
        grade = r['grade']
        is_1to5 = grade == '1to5'
        
        # Get meal counts
        cnt = r['cnt_1to5'] if is_1to5 else r['cnt_6to8']
        meal_type = r['meal_type']
        has_pulses = r['has_pulses']
        
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
            'date': r['date'].isoformat(),
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

