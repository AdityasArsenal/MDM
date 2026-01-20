from flask import Blueprint, request, jsonify
from google.oauth2 import id_token
from google.auth.transport import requests
import uuid
import os
from config import Config
from db import query_db

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.json
        token = data.get('credential')
        
        if not token:
            return jsonify({'error': 'No token provided'}), 400

        # Verify Google token
        id_info = id_token.verify_oauth2_token(
            token, 
            requests.Request(), 
            os.getenv("GOOGLE_CLIENT_ID")
        )

        google_id = id_info['sub']
        email = id_info['email']
        name = id_info.get('name')

        # Check if user exists
        user = query_db('SELECT * FROM users WHERE google_id = %s', (google_id,), one=True)

        if not user:
            # Create new user
            user = query_db(
                'INSERT INTO users (email, name, google_id) VALUES (%s, %s, %s) RETURNING *',
                (email, name, google_id),
                one=True
            )
        
        # Check active subscription
        sub = query_db("""
            SELECT * FROM subscriptions 
            WHERE user_id = %s AND status = 'active' AND end_date > now()
            ORDER BY end_date DESC LIMIT 1
        """, (user['id'],), one=True)

        return jsonify({
            'user': {
                'id': str(user['id']),
                'email': user['email'],
                'name': user['name'],
                'is_subscribed': bool(sub),
                'subscription_end': sub['end_date'].isoformat() if sub else None
            }
        })

    except ValueError:
        return jsonify({'error': 'Invalid token'}), 401
    except Exception as e:
        print(f"Auth error: {e}")
        return jsonify({'error': 'Authentication failed'}), 500