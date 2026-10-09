from datetime import datetime
from flask import Blueprint, request, jsonify, g
from auth_session import load_session_user
from db import (
    get_egg_records, insert_egg_record,
    get_egg_rates, get_latest_egg_rates_before, upsert_egg_rates,
)
from egg_calc import rates_from_row, rates_to_row, validate_rates

egg_bp = Blueprint('egg', __name__)

INT_FIELDS = ['egg_m', 'egg_f', 'banana_m', 'banana_f']
PAYERS = ('APF', 'GOV')

def is_number(v):
    return not isinstance(v, bool) and isinstance(v, (int, float))

def as_int(v):
    """Whole number as int (2.0 -> 2); anything else stays out of the int fields."""
    if not is_number(v) or v != v or v in (float('inf'), float('-inf')):
        return None
    return int(v) if v == int(v) else None

def validate_record(r):
    """Return an error string for an invalid record, or None if valid."""
    if not isinstance(r, dict):
        return 'must be an object'
    date = r.get('date')
    if not isinstance(date, str):
        return 'date is required (YYYY-MM-DD)'
    try:
        datetime.strptime(date, '%Y-%m-%d')
    except ValueError:
        return 'date must be YYYY-MM-DD'
    if r.get('payer') is not None and r['payer'] not in PAYERS:
        return "payer must be 'APF' or 'GOV'"
    for field in INT_FIELDS:
        v = r.get(field)
        if v is not None and (as_int(v) is None or v < 0):
            return f'{field} must be a whole number >= 0'
    return None

@egg_bp.before_request
def require_login():
    return load_session_user()

@egg_bp.route('/<int:year>/<int:month>', methods=['GET'])
def get_egg(year, month):
    user_id = g.user_id
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400

    records = get_egg_records(user_id, year, month)
    
    if records:
        for r in records:
            r['id'] = str(r['id'])
            r['user_id'] = str(r['user_id'])
            # Handle date formatting
            if isinstance(r['date'], str):
                r['date'] = r['date'] 
            else:
                r['date'] = r['date'].isoformat()
            # Prices live in egg_rates now; never expose the legacy columns
            r.pop('egg_price', None)
            r.pop('banana_price', None)

    return jsonify(records or [])

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


@egg_bp.route('/rates/<int:year>/<int:month>', methods=['GET'])
def get_rates(year, month):
    """Read-only: saved rates for the month, else nearest earlier month's, else none."""
    error = _check_year_month(year, month)
    if error:
        return jsonify({'error': error}), 400

    try:
        row = get_egg_rates(g.user_id, year, month)
        if row:
            return jsonify(_rates_payload('saved', year, month, row))

        earlier = get_latest_egg_rates_before(g.user_id, year, month)
        if earlier:
            return jsonify(_rates_payload(
                'inherited', year, month, earlier,
                {'year': earlier['year'], 'month': earlier['month']},
            ))
        return jsonify(_rates_payload('none', year, month, None))
    except Exception as e:
        print("Error loading egg rates:", e)
        return jsonify({'error': str(e)}), 500


@egg_bp.route('/rates/<int:year>/<int:month>', methods=['PUT'])
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
        upsert_egg_rates(g.user_id, year, month, rates_to_row(clean))
        return jsonify(_rates_payload('saved', year, month, rates_to_row(clean)))
    except Exception as e:
        print("Error saving egg rates:", e)
        return jsonify({'error': str(e)}), 500


@egg_bp.route('/save', methods=['POST'])
def save_egg():
    data = request.get_json(silent=True)
    user_id = g.user_id

    if not user_id:
        return jsonify({'error': 'User ID required'}), 400
    if not isinstance(data, dict) or not isinstance(data.get('records', []), list):
        return jsonify({'error': 'records must be a list'}), 400

    records = data.get('records', [])

    # Validate every record first so a bad one never leaves earlier records written
    for i, r in enumerate(records):
        error = validate_record(r)
        if error:
            return jsonify({'error': f'Record {i}: {error}'}), 400

    try:
        # Every month being written needs a saved rate row. Work out what is missing
        # (and fail) before writing anything; freeze inherited rates afterwards.
        months = set()
        for r in records:
            d = datetime.strptime(r['date'], '%Y-%m-%d')
            months.add((d.year, d.month))

        to_freeze = []
        for year, month in sorted(months):
            if get_egg_rates(user_id, year, month):
                continue
            earlier = get_latest_egg_rates_before(user_id, year, month)
            if not earlier:
                return jsonify({
                    'error': 'Set the rates for this month first',
                    'code': 'rates_not_configured',
                }), 400
            to_freeze.append((year, month, rates_to_row(rates_from_row(earlier))))

        for year, month, row in to_freeze:
            upsert_egg_rates(user_id, year, month, row)

        for r in records:
            insert_egg_record(
                user_id=user_id,
                date=r['date'],
                payer=r.get('payer'),
                egg_m=as_int(r.get('egg_m')) or 0,
                egg_f=as_int(r.get('egg_f')) or 0,
                banana_m=as_int(r.get('banana_m')) or 0,
                banana_f=as_int(r.get('banana_f')) or 0,
            )

        return jsonify({'status': 'success'})

    except Exception as e:
        print(f"Error saving egg: {e}")
        return jsonify({'error': str(e)}), 500
