from flask import Blueprint, request, jsonify
from google.oauth2 import id_token
from google.auth.transport import requests
import uuid
import os
from db import get_user_by_google_id, insert_user, get_active_subscription

from dotenv import load_dotenv

load_dotenv()


auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.json
        token = data.get('credential')
        
        if not token:
            return jsonify({'error': 'No token provided'}), 400

        # Get and log the client ID for debugging
        client_id = os.getenv("GOOGLE_CLIENT_ID")
        # print(f"Using Google Client ID: {client_id}")
        
        if not client_id:
            # print("ERROR: GOOGLE_CLIENT_ID environment variable not set")
            return jsonify({'error': 'Server configuration error'}), 500

        # Verify Google token
        id_info = id_token.verify_oauth2_token(
            token, 
            requests.Request(), 
            client_id
        )

        google_id = id_info['sub']
        email = id_info['email']
        name = id_info.get('name')

        # Check if user exists
        user = get_user_by_google_id(google_id)

        if not user:
            # Create new user
            user = insert_user(email, name, google_id)
        
        # Check active subscription
        sub = get_active_subscription(user['id'])

        return jsonify({
            'user': {
                'id': str(user['id']),
                'email': user['email'],
                'name': user['name'],
                'is_subscribed': bool(sub),
                'subscription_end': sub['end_date'] if sub else None
            }
        })

    except ValueError:
        return jsonify({'error': 'Invalid token'}), 401
    except Exception as e:
        print(f"Auth error: {e}")
        return jsonify({'error': 'Authentication failed'}), 500