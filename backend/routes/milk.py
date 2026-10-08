import math
from datetime import datetime
from flask import Blueprint, request, jsonify, g
from auth_session import load_session_user
from db import get_milk_records, insert_milk_record

milk_bp = Blueprint('milk', __name__)

NUMERIC_FIELDS = ['children', 'milk_open', 'ragi_open', 'milk_rcpt', 'ragi_rcpt']
# Opening stock may be negative: teachers buy milk/ragi out of pocket and record it as distributed with no stock left
SIGNED_FIELDS = ('milk_open', 'ragi_open')
DEFAULT_DIST_TYPE = 'milk & ragi'

@milk_bp.before_request
def require_login():
    return load_session_user()

@milk_bp.route('/<int:year>/<int:month>', methods=['GET'])
def get_milk(year, month):
    user_id = g.user_id
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400

    records = get_milk_records(user_id, year, month)

    if records:
        for r in records:
            r['id'] = str(r['id'])
            r['user_id'] = str(r['user_id'])
            # Handle date formatting
            if isinstance(r['date'], str):
                r['date'] = r['date']
            else:
                r['date'] = r['date'].isoformat()
            for key in ['milk_open', 'ragi_open', 'milk_rcpt', 'ragi_rcpt']:
                if r.get(key) is not None:
                    r[key] = float(r[key])

    return jsonify(records or [])

def validate_record(r):
    """Return (clean_row, None) or (None, reason)."""
    if not isinstance(r, dict):
        return None, 'must be an object'

    date = r.get('date')
    if not isinstance(date, str):
        return None, 'date is required (YYYY-MM-DD)'
    try:
        datetime.strptime(date, '%Y-%m-%d')
    except ValueError:
        return None, 'date must be a valid YYYY-MM-DD'

    clean = {'date': date}
    for key in NUMERIC_FIELDS:
        v = r.get(key, 0)
        if isinstance(v, bool) or not isinstance(v, (int, float)):
            return None, f'{key} must be a number'
        if not math.isfinite(v):
            return None, f'{key} must be a finite number'
        if key not in SIGNED_FIELDS and v < 0:
            return None, f'{key} must be a number >= 0'
        if key == 'children':
            # children is an integer column; accept 2.0 as 2, reject 1.5
            if v != int(v):
                return None, 'children must be a whole number'
            v = int(v)
        clean[key] = v

    dist_type = r.get('dist_type', DEFAULT_DIST_TYPE)
    if not isinstance(dist_type, str):
        return None, 'dist_type must be a string'
    clean['dist_type'] = dist_type
    return clean, None

@milk_bp.route('/save', methods=['POST'])
def save_milk():
    user_id = g.user_id
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Request body must be a JSON object'}), 400
    records = data.get('records', [])
    if not isinstance(records, list):
        return jsonify({'error': 'records must be a list'}), 400

    # Validate every row before inserting any
    rows = []
    for i, r in enumerate(records):
        clean, reason = validate_record(r)
        if reason:
            return jsonify({'error': f'Record {i}: {reason}'}), 400
        rows.append(clean)

    try:
        for r in rows:
            # Skip rows where all numeric fields are zero and dist_type is default
            if (
                all(r[k] == 0 for k in NUMERIC_FIELDS) and
                r['dist_type'] == DEFAULT_DIST_TYPE
            ):
                continue  # skip inserting this row

            insert_milk_record(
                user_id, r['date'], r['children'],
                r['milk_open'], r['ragi_open'],
                r['milk_rcpt'], r['ragi_rcpt'],
                r['dist_type']
            )

        return jsonify({'status': 'success'})
    except Exception as e:
        print(f"Error saving milk: {e}")
        return jsonify({'error': str(e)}), 500
