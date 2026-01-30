from flask import Blueprint, request, jsonify
from db import get_milk_records, insert_milk_record

milk_bp = Blueprint('milk', __name__)

@milk_bp.route('/<int:year>/<int:month>', methods=['GET'])
def get_milk(year, month):
    user_id = request.args.get('user_id')
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
                if r[key] is not None:
                    r[key] = float(r[key])

    return jsonify(records or [])

@milk_bp.route('/save', methods=['POST'])
def save_milk():
    data = request.json
    user_id = data.get('user_id')
    records = data.get('records', [])
    
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400

    try:
        for r in records:
            insert_milk_record(
                user_id, r['date'], r.get('children', 0),
                r.get('milk_open', 0), r.get('ragi_open', 0),
                r.get('milk_rcpt', 0), r.get('ragi_rcpt', 0),
                r.get('dist_type', 'milk & ragi')
            )
            
        return jsonify({'status': 'success'})
    except Exception as e:
        print(f"Error saving milk: {e}")
        return jsonify({'error': str(e)}), 500

