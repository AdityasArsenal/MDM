from flask import Blueprint, request, jsonify
from db import query_db
from datetime import datetime

meal_bp = Blueprint('meal', __name__)

@meal_bp.route('/<int:year>/<int:month>', methods=['GET'])
def get_meals(year, month):
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400

    # Get all records for the month
    query = """
        SELECT * FROM meal_plans 
        WHERE user_id = %s 
        AND EXTRACT(YEAR FROM date) = %s 
        AND EXTRACT(MONTH FROM date) = %s
        ORDER BY date ASC
    """
    meals = query_db(query, (user_id, year, month))
    
    # Format dates for frontend
    if meals:
        for meal in meals:
            meal['id'] = str(meal['id'])
            meal['user_id'] = str(meal['user_id'])
            meal['date'] = meal['date'].isoformat()
            
    return jsonify(meals or [])

@meal_bp.route('/save', methods=['POST'])
def save_meals():
    data = request.json
    user_id = data.get('user_id')
    meals = data.get('meals', [])
    
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400

    try:
        for meal in meals:
            query_db("""
                INSERT INTO meal_plans (user_id, date, cnt_1to5, cnt_6to8, meal_type, has_pulses)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (user_id, date) 
                DO UPDATE SET 
                    cnt_1to5 = EXCLUDED.cnt_1to5,
                    cnt_6to8 = EXCLUDED.cnt_6to8,
                    meal_type = EXCLUDED.meal_type,
                    has_pulses = EXCLUDED.has_pulses,
                    updated_at = now()
            """, (
                user_id, 
                meal['date'], 
                meal.get('cnt_1to5', 0), 
                meal.get('cnt_6to8', 0), 
                meal.get('meal_type'), 
                meal.get('has_pulses', False)
            ))
            
        return jsonify({'status': 'success'})
    except Exception as e:
        print(f"Error saving meals: {e}")
        return jsonify({'error': str(e)}), 500

@meal_bp.route('/total/<int:year>/<int:month>', methods=['GET'])
def get_monthly_total(year, month):
    # This will be implemented when we do the calculation service
    # For now, return placeholder
    return jsonify({})

