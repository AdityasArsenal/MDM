"""
Session tokens for the MDM API.

Login (POST /api/auth/login) verifies the Google ID token and returns a signed
session token (JWT). Protected routes require `Authorization: Bearer <token>`
and take the user ID from the token only. The user ID in the request body or
query string is never trusted.

ENVIRONMENT VARIABLES REQUIRED:
- JWT_SECRET: long random string used to sign session tokens
  (generate with: openssl rand -hex 32)
"""

import os
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from dotenv import load_dotenv
from flask import g, jsonify, request

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required")

ALGORITHM = "HS256"
TOKEN_TTL = timedelta(days=7)


def issue_token(user_id):
    """Create a signed session token for a user"""
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "iat": now, "exp": now + TOKEN_TTL}
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


def load_session_user():
    """
    Set g.user_id from a valid Bearer token.
    Returns an error response if the token is missing or invalid, otherwise None.
    Used as a before_request hook (returning a response stops the request).
    """
    # Let CORS preflight requests through; they carry no credentials
    if request.method == "OPTIONS":
        return None

    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return jsonify({"error": "Authentication required"}), 401

    try:
        claims = jwt.decode(header[len("Bearer "):], JWT_SECRET, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return jsonify({"error": "Invalid or expired session"}), 401

    g.user_id = claims["sub"]
    return None


def login_required(view):
    """Decorator for a single route that needs a logged-in user"""
    @wraps(view)
    def wrapper(*args, **kwargs):
        error = load_session_user()
        if error:
            return error
        return view(*args, **kwargs)
    return wrapper
