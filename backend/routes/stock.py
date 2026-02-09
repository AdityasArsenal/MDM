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
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400

    stock_records = get_stock_records(user_id, year, month)
    meal_plans = get_meal_plans(user_id, year, month)

    # Create lookup maps
    stock_lookup = {}
    for r in stock_records:
        date_key = r['date'] if isinstance(r['date'], str) else r['date'].isoformat()
        key = f"{date_key}|{r['grade']}"
        stock_lookup[key] = r

    meal_lookup = {
        (m['date'] if isinstance(m['date'], str) else m['date'].isoformat()): m
        for m in meal_plans
    }

    # Generate all days of the month
    from calendar import monthrange
    days_in_month = monthrange(year, month)[1]
    
    result = []
    
    for day in range(1, days_in_month + 1):
        date_str = f"{year}-{month:02d}-{day:02d}"
        
        for grade in ['1-5', '6-10']:
            key = f"{date_str}|{grade}"
            stock_row = stock_lookup.get(key, {})
            is_1to5 = grade == '1-5'
            
            # Get meal data
            meal = meal_lookup.get(date_str, {})
            cnt = meal.get('cnt_1to5' if is_1to5 else 'cnt_6to10', 0)
            meal_type = meal.get('meal_type')
            has_pulses = meal.get('has_pulses', False)

            # Calculate usage
            rice_used = wheat_used = oil_used = pulse_used = 0
            if cnt and meal_type:
                rice_rate = 0.1 if is_1to5 else 0.15
                wheat_rate = 0.1 if is_1to5 else 0.15
                oil_rate = 0.005 if is_1to5 else 0.0075
                pulse_rate = 0.02 if is_1to5 else 0.03

                if meal_type == 'rice':
                    rice_used = cnt * rice_rate
                elif meal_type == 'wheat':
                    wheat_used = cnt * wheat_rate

                oil_used = cnt * oil_rate
                if has_pulses:
                    pulse_used = cnt * pulse_rate

            result.append({
                'date': date_str,
                'grade': grade,
                'rice_add': float(stock_row.get('rice_add', 0) or 0),
                'wheat_add': float(stock_row.get('wheat_add', 0) or 0),
                'oil_add': float(stock_row.get('oil_add', 0) or 0),
                'pulse_add': float(stock_row.get('pulse_add', 0) or 0),
                'rice_open': float(stock_row['rice_open']) if stock_row.get('rice_open') is not None else (0 if day == 1 else None),
                'wheat_open': float(stock_row['wheat_open']) if stock_row.get('wheat_open') is not None else (0 if day == 1 else None),
                'oil_open': float(stock_row['oil_open']) if stock_row.get('oil_open') is not None else (0 if day == 1 else None),
                'pulse_open': float(stock_row['pulse_open']) if stock_row.get('pulse_open') is not None else (0 if day == 1 else None),
                'rice_used': round(rice_used, 3),
                'wheat_used': round(wheat_used, 3),
                'oil_used': round(oil_used, 3),
                'pulse_used': round(pulse_used, 3),
            })

    return jsonify(result)
