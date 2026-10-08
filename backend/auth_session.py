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

import logging
import os
import time
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from dotenv import load_dotenv
from flask import g, jsonify, request

from db import check_active_subscription

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required")

ALGORITHM = "HS256"
TOKEN_TTL = timedelta(days=7)

logger = logging.getLogger(__name__)

# Subscription enforcement for the data routes. Set ENFORCE_SUBSCRIPTION=false
# in .env to turn it off for local development (default: on).
ENFORCE_SUBSCRIPTION = os.getenv("ENFORCE_SUBSCRIPTION", "true").strip().lower() != "false"
PAID_PREFIXES = ("/api/egg/", "/api/meal/", "/api/milk/", "/api/stock/")
PAID_CACHE_SECONDS = 60
_paid_until = {}  # user_id -> time.monotonic() until which the "paid" answer is trusted


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


def enforce_subscription():
    """
    App-level before_request hook. The data routes (egg, meal, milk, stock) need a
    valid session AND an active subscription. Auth, pay and sub routes are not
    gated, so an unpaid user can still log in and pay.
    Returns 402 when there is no active subscription, 503 when it cannot be checked.
    """
    if not ENFORCE_SUBSCRIPTION or request.method == "OPTIONS":
        return None
    if not request.path.startswith(PAID_PREFIXES):
        return None

    error = load_session_user()
    if error:
        return error

    user_id = g.user_id
    now = time.monotonic()
    if _paid_until.get(user_id, 0) > now:
        return None

    try:
        active = check_active_subscription(user_id)
    except Exception as e:
        # Fail closed: do not give access when the check itself fails
        logger.error("Subscription check failed: %s", type(e).__name__)
        return jsonify({"error": "Could not verify subscription"}), 503

    if not active:
        return jsonify({"error": "Subscription required", "code": "subscription_required"}), 402

    # Only "paid" answers are cached, so a user who just paid is never held back
    if len(_paid_until) > 10000:
        _paid_until.clear()
    _paid_until[user_id] = now + PAID_CACHE_SECONDS
    return None
