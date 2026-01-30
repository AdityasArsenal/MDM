from flask import Blueprint, request, jsonify
from db import get_meal_plans, insert_meal_plan
from datetime import datetime

meal_bp = Blueprint('meal', __name__)

@meal_bp.route('/<int:year>/<int:month>', methods=['GET'])
def get_meals(year, month):
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400

    meals = get_meal_plans(user_id, year, month)

    if meals:
        for meal in meals:
            meal['id'] = str(meal['id'])
            meal['user_id'] = str(meal['user_id'])
            meal['date'] = meal['date'] if isinstance(meal['date'], str) else meal['date'].isoformat()

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
            insert_meal_plan(
                user_id=user_id,
                date=meal['date'],
                cnt_1to5=meal.get('cnt_1to5', 0),
                cnt_6to10=meal.get('cnt_6to10', 0),
                meal_type=meal['meal_type'],      # rice / wheat
                has_pulses=meal.get('has_pulses', False)  # boolean
            )

        return jsonify({'status': 'success'})
    except Exception as e:
        print("Error saving meals:", e)
        return jsonify({'error': str(e)}), 500



