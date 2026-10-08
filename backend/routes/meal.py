from flask import Blueprint, request, jsonify, g
from auth_session import load_session_user
from db import get_meal_plans, insert_meal_plan
from datetime import datetime

meal_bp = Blueprint('meal', __name__)

@meal_bp.before_request
def require_login():
    return load_session_user()

@meal_bp.route('/<int:year>/<int:month>', methods=['GET'])
def get_meals(year, month):
    user_id = g.user_id
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400

    meals = get_meal_plans(user_id, year, month)

    if meals:
        for meal in meals:
            meal['id'] = str(meal['id'])
            meal['user_id'] = str(meal['user_id'])
            meal['date'] = meal['date'] if isinstance(meal['date'], str) else meal['date'].isoformat()

    return jsonify(meals or [])


def _is_count(v):
    return isinstance(v, int) and not isinstance(v, bool) and v >= 0


def _validate_record(rec):
    """Return (clean_record, None) or (None, reason)."""
    if not isinstance(rec, dict):
        return None, 'must be an object'

    date = rec.get('date')
    if not isinstance(date, str):
        return None, 'date is required (YYYY-MM-DD)'
    try:
        datetime.strptime(date, '%Y-%m-%d')
    except ValueError:
        return None, 'date must be a valid YYYY-MM-DD'

    meal_type = rec.get('meal_type')
    if meal_type not in ('rice', 'wheat') or not isinstance(meal_type, str):
        return None, "meal_type must be 'rice' or 'wheat'"

    counts = {}
    for field in ('cnt_1to5', 'cnt_6to10'):
        v = rec.get(field, 0)
        if not _is_count(v):
            return None, f'{field} must be an integer >= 0'
        counts[field] = v

    has_pulses = rec.get('has_pulses', False)
    if not isinstance(has_pulses, bool):
        return None, 'has_pulses must be a boolean'

    return {'date': date, 'meal_type': meal_type, 'has_pulses': has_pulses, **counts}, None


@meal_bp.route('/save', methods=['POST'])
def save_meals():
    user_id = g.user_id
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Request body must be a JSON object'}), 400

    # 'records' is the documented key; 'meals' is what the current frontend sends.
    records = data['records'] if 'records' in data else data.get('meals', [])
    if not isinstance(records, list):
        return jsonify({'error': 'records must be a list'}), 400

    # Validate everything before inserting anything.
    clean = []
    for i, rec in enumerate(records):
        value, reason = _validate_record(rec)
        if reason:
            return jsonify({'error': f'Record {i}: {reason}'}), 400
        clean.append(value)

    try:
        for rec in clean:
            insert_meal_plan(user_id=user_id, **rec)
        return jsonify({'status': 'success'})
    except Exception as e:
        print("Error saving meals:", e)
        return jsonify({'error': str(e)}), 500
