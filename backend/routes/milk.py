import logging
import math
from datetime import datetime
from flask import Blueprint, request, jsonify, g
from auth_session import load_session_user
from db import (
    get_milk_records, insert_milk_record,
    get_milk_rates, get_latest_milk_rates_before, upsert_milk_rates,
)
from milk_calc import rates_from_row, rates_to_row, validate_rates

milk_bp = Blueprint('milk', __name__)
logger = logging.getLogger(__name__)

NUMERIC_FIELDS = ['children', 'milk_open', 'ragi_open', 'milk_rcpt', 'ragi_rcpt']
# Opening stock may be negative: teachers buy milk/ragi out of pocket and record it as distributed with no stock left
SIGNED_FIELDS = ('milk_open', 'ragi_open')

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

    # dist_type is nullable: null, missing and "" all mean "not chosen" and are stored as NULL
    dist_type = r.get('dist_type')
    if dist_type is not None and not isinstance(dist_type, str):
        return None, 'dist_type must be a string or null'
    clean['dist_type'] = dist_type or None
    return clean, None

def is_untouched(r):
    """Untouched rows (all numeric fields zero, no dist_type chosen) are not saved."""
    return all(r[k] == 0 for k in NUMERIC_FIELDS) and r['dist_type'] is None


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


@milk_bp.route('/rates/<int:year>/<int:month>', methods=['GET'])
def get_rates(year, month):
    """Read-only: saved rates for the month, else nearest earlier month's, else none."""
    error = _check_year_month(year, month)
    if error:
        return jsonify({'error': error}), 400

    try:
        row = get_milk_rates(g.user_id, year, month)
        if row:
            return jsonify(_rates_payload('saved', year, month, row))

        earlier = get_latest_milk_rates_before(g.user_id, year, month)
        if earlier:
            return jsonify(_rates_payload(
                'inherited', year, month, earlier,
                {'year': earlier['year'], 'month': earlier['month']},
            ))
        return jsonify(_rates_payload('none', year, month, None))
    except Exception as e:
        logger.error("Error loading milk rates: %s", e)
        return jsonify({'error': str(e)}), 500


@milk_bp.route('/rates/<int:year>/<int:month>', methods=['PUT'])
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
        upsert_milk_rates(g.user_id, year, month, rates_to_row(clean))
        return jsonify(_rates_payload('saved', year, month, rates_to_row(clean)))
    except Exception as e:
        logger.error("Error saving milk rates: %s", e)
        return jsonify({'error': str(e)}), 500


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
        to_save = [r for r in rows if not is_untouched(r)]

        # Every month actually being written needs a saved rate row. Work out what is
        # missing (and fail) before writing anything; freeze inherited rates afterwards.
        to_freeze = []
        for year, month in sorted({(int(r['date'][:4]), int(r['date'][5:7])) for r in to_save}):
            if get_milk_rates(user_id, year, month):
                continue
            earlier = get_latest_milk_rates_before(user_id, year, month)
            if not earlier:
                return jsonify({
                    'error': 'Set the rates for this month first',
                    'code': 'rates_not_configured',
                }), 400
            to_freeze.append((year, month, rates_to_row(rates_from_row(earlier))))

        for year, month, row in to_freeze:
            upsert_milk_rates(user_id, year, month, row)

        for r in to_save:
            insert_milk_record(
                user_id, r['date'], r['children'],
                r['milk_open'], r['ragi_open'],
                r['milk_rcpt'], r['ragi_rcpt'],
                r['dist_type']
            )

        return jsonify({'status': 'success'})
    except Exception as e:
        logger.error(f"Error saving milk: {e}")
        return jsonify({'error': str(e)}), 500
