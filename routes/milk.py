from flask import Blueprint, request, jsonify
from db import query_db

milk_bp = Blueprint('milk', __name__)

@milk_bp.route('/<int:year>/<int:month>', methods=['GET'])
def get_milk(year, month):
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400

    query = """
        SELECT * FROM milk 
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
            query_db("""
                INSERT INTO milk (
                    user_id, date, children,
                    milk_open, ragi_open, milk_rcpt, ragi_rcpt, dist_type
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (user_id, date) 
                DO UPDATE SET 
                    children = EXCLUDED.children,
                    milk_open = EXCLUDED.milk_open,
                    ragi_open = EXCLUDED.ragi_open,
                    milk_rcpt = EXCLUDED.milk_rcpt,
                    ragi_rcpt = EXCLUDED.ragi_rcpt,
                    dist_type = EXCLUDED.dist_type,
                    updated_at = now()
            """, (
                user_id, r['date'], r.get('children', 0),
                r.get('milk_open', 0), r.get('ragi_open', 0),
                r.get('milk_rcpt', 0), r.get('ragi_rcpt', 0),
                r.get('dist_type', 'milk & ragi')
            ))
            
        return jsonify({'status': 'success'})
    except Exception as e:
        print(f"Error saving milk: {e}")
        return jsonify({'error': str(e)}), 500

