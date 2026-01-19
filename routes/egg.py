from flask import Blueprint, request, jsonify
from db import query_db

egg_bp = Blueprint('egg', __name__)

@egg_bp.route('/<int:year>/<int:month>', methods=['GET'])
def get_egg(year, month):
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400

    query = """
        SELECT * FROM egg 
        WHERE user_id = %s 
        AND EXTRACT(YEAR FROM date) = %s 
        AND EXTRACT(MONTH FROM date) = %s
        ORDER BY date ASC
    """
    records = query_db(query, (user_id, year, month))
    
    if records:
        for r in records:
            r['id'] = str(r['id'])
            r['user_id'] = str(r['user_id'])
            r['date'] = r['date'].isoformat()
            r['egg_price'] = float(r['egg_price']) if r['egg_price'] else 6.0
            r['banana_price'] = float(r['banana_price']) if r['banana_price'] else 6.0

    return jsonify(records or [])

@egg_bp.route('/save', methods=['POST'])
def save_egg():
    data = request.json
    user_id = data.get('user_id')
    records = data.get('records', [])
    
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400

    try:
        for r in records:
            query_db("""
                INSERT INTO egg (
                    user_id, date, payer,
                    egg_m, egg_f, chikki_m, chikki_f,
                    egg_price, banana_price
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (user_id, date) 
                DO UPDATE SET 
                    payer = EXCLUDED.payer,
                    egg_m = EXCLUDED.egg_m,
                    egg_f = EXCLUDED.egg_f,
                    chikki_m = EXCLUDED.chikki_m,
                    chikki_f = EXCLUDED.chikki_f,
                    egg_price = EXCLUDED.egg_price,
                    banana_price = EXCLUDED.banana_price,
                    updated_at = now()
            """, (
                user_id, r['date'], r.get('payer'),
                r.get('egg_m', 0), r.get('egg_f', 0),
                r.get('chikki_m', 0), r.get('chikki_f', 0),
                r.get('egg_price', 6), r.get('banana_price', 6)
            ))
            
        return jsonify({'status': 'success'})
    except Exception as e:
        print(f"Error saving egg: {e}")
        return jsonify({'error': str(e)}), 500

