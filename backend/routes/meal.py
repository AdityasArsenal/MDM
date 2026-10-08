from flask import Blueprint, request, jsonify, g
from auth_session import load_session_user
from db import (
    get_meal_plans, insert_meal_plan,
    get_meal_rates, get_latest_meal_rates_before, upsert_meal_rates,
)
from meal_calc import rates_from_row, rates_to_row, validate_rates
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


def _check_year_month(year, month):
    if not 2000 <= year <= 2100:
        return 'year must be between 2000 and 2100'
    if not 1 <= month <= 12:
        return 'month must be between 1 and 12'
    return None


def _rates_payload(source, year, month, row, inherited_from=None):
    return {
        'source': source,
        'year': year,
        'month': month,
        'inherited_from': inherited_from,
        'rates': rates_from_row(row) if row else None,
    }


@meal_bp.route('/rates/<int:year>/<int:month>', methods=['GET'])
def get_rates(year, month):
    """Read-only: saved rates for the month, else nearest earlier month's, else none."""
    error = _check_year_month(year, month)
    if error:
        return jsonify({'error': error}), 400

    try:
        row = get_meal_rates(g.user_id, year, month)
        if row:
            return jsonify(_rates_payload('saved', year, month, row))

        earlier = get_latest_meal_rates_before(g.user_id, year, month)
        if earlier:
            return jsonify(_rates_payload(
                'inherited', year, month, earlier,
                {'year': earlier['year'], 'month': earlier['month']},
            ))
        return jsonify(_rates_payload('none', year, month, None))
    except Exception as e:
        print("Error loading meal rates:", e)
        return jsonify({'error': str(e)}), 500


@meal_bp.route('/rates/<int:year>/<int:month>', methods=['PUT'])
def put_rates(year, month):
    error = _check_year_month(year, month)
    if error:
        return jsonify({'error': error}), 400

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Request body must be a JSON object'}), 400

    clean, reason = validate_rates(data.get('rates'))
    if reason:
        return jsonify({'error': reason}), 400

    try:
        upsert_meal_rates(g.user_id, year, month, rates_to_row(clean))
        return jsonify(_rates_payload('saved', year, month, rates_to_row(clean)))
    except Exception as e:
        print("Error saving meal rates:", e)
        return jsonify({'error': str(e)}), 500


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
        # Every month being saved needs a saved rate row. Work out what is missing
        # (and fail) before writing anything; freeze inherited rates afterwards.
        to_freeze = []
        for year, month in sorted({(int(r['date'][:4]), int(r['date'][5:7])) for r in clean}):
            if get_meal_rates(user_id, year, month):
                continue
            earlier = get_latest_meal_rates_before(user_id, year, month)
            if not earlier:
                return jsonify({
                    'error': 'Set the rates for this month first',
                    'code': 'rates_not_configured',
                }), 400
            to_freeze.append((year, month, rates_to_row(rates_from_row(earlier))))

        for year, month, row in to_freeze:
            upsert_meal_rates(user_id, year, month, row)

        for rec in clean:
            insert_meal_plan(user_id=user_id, **rec)
        return jsonify({'status': 'success'})
    except Exception as e:
        print("Error saving meals:", e)
        return jsonify({'error': str(e)}), 500
