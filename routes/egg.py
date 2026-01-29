from flask import Blueprint, request, jsonify
from db import get_egg_records, insert_egg_record

egg_bp = Blueprint('egg', __name__)

@egg_bp.route('/<int:year>/<int:month>', methods=['GET'])
def get_egg(year, month):
    user_id = "9d16f34f-9cf4-47ee-9cf4-3717f42f1e23"
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
            r['egg_price'] = float(r['egg_price']) if r['egg_price'] else 6.0
            r['banana_price'] = float(r['banana_price']) if r['banana_price'] else 6.0

    return records or []

@egg_bp.route('/save', methods=['POST'])
def save_egg():
    data = request.json
    user_id = data.get('user_id')
    records = data.get('records', [])

    if not user_id:
        return jsonify({'error': 'User ID required'}), 400

    try:
        for r in records:
            insert_egg_record(
                user_id=user_id,
                date=r['date'],
                payer=r.get('payer'),
                egg_m=r.get('egg_m', 0),
                egg_f=r.get('egg_f', 0),
                banana_m=r.get('banana_m', 0),
                banana_f=r.get('banana_f', 0),
                egg_price=r.get('egg_price', 6),
                banana_price=r.get('banana_price', 6),
            )

        return jsonify({'status': 'success'})

    except Exception as e:
        print(f"Error saving egg: {e}")
        return jsonify({'error': str(e)}), 500
