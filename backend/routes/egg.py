from datetime import datetime
from flask import Blueprint, request, jsonify, g
from auth_session import load_session_user
from db import get_egg_records, insert_egg_record

egg_bp = Blueprint('egg', __name__)

INT_FIELDS = ['egg_m', 'egg_f', 'banana_m', 'banana_f']
PRICE_FIELDS = ['egg_price', 'banana_price']
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
    for field in PRICE_FIELDS:
        v = r.get(field)
        if v is not None and (not is_number(v) or v != v or v < 0 or v == float('inf')):
            return f'{field} must be a number >= 0'
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
            r['egg_price'] = float(r['egg_price']) if r['egg_price'] is not None else 6.0
            r['banana_price'] = float(r['banana_price']) if r['banana_price'] is not None else 6.0

    return jsonify(records or [])

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
        for r in records:
            insert_egg_record(
                user_id=user_id,
                date=r['date'],
                payer=r.get('payer'),
                egg_m=as_int(r.get('egg_m')) or 0,
                egg_f=as_int(r.get('egg_f')) or 0,
                banana_m=as_int(r.get('banana_m')) or 0,
                banana_f=as_int(r.get('banana_f')) or 0,
                egg_price=r.get('egg_price', 6),
                banana_price=r.get('banana_price', 6),
            )

        return jsonify({'status': 'success'})

    except Exception as e:
        print(f"Error saving egg: {e}")
        return jsonify({'error': str(e)}), 500
