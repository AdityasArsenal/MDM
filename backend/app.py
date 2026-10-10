import os
from urllib.parse import urlparse
from flask import Flask
from flask_cors import CORS
from routes.auth import auth_bp
from routes.meal import meal_bp
from routes.stock import stock_bp
from routes.milk import milk_bp
from routes.egg import egg_bp
from routes.pay import pay_bp
from routes.sub import sub_bp
from auth_session import enforce_subscription
from dotenv import load_dotenv

load_dotenv()

import logging
logging.getLogger("apscheduler").setLevel(logging.WARNING)
logging.getLogger("phonepe").setLevel(logging.ERROR)

app = Flask(__name__)

# Data routes need an active subscription (auth, pay and sub routes do not)
app.before_request(enforce_subscription)

# CORS: only the real frontend origin(s) may call the API from a browser.
# Allowed = origin of FRONTEND_SUCCESS_URL / FRONTEND_FAILED_URL, plus any in CORS_ORIGINS
# (comma-separated, e.g. http://localhost:3000 for local development). Empty = nothing allowed.
def _origin(url):
    parts = urlparse((url or "").strip())
    return f"{parts.scheme}://{parts.netloc}" if parts.scheme and parts.netloc else None

_allowed_origins = {_origin(os.getenv("FRONTEND_SUCCESS_URL")), _origin(os.getenv("FRONTEND_FAILED_URL"))}
_allowed_origins |= {o.strip().rstrip("/") for o in os.getenv("CORS_ORIGINS", "").split(",")}
_allowed_origins = sorted(o for o in _allowed_origins if o)
CORS(app, resources={r"/api/*": {"origins": _allowed_origins}})

# Register Blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(meal_bp, url_prefix='/api/meal')
app.register_blueprint(stock_bp, url_prefix='/api/stock')
app.register_blueprint(milk_bp, url_prefix='/api/milk')
app.register_blueprint(egg_bp, url_prefix='/api/egg')
app.register_blueprint(pay_bp, url_prefix='/api/pay')
app.register_blueprint(sub_bp, url_prefix='/api/sub')

@app.route('/health')
def health():
    return {'status': 'ok'}

@app.route('/')
def hello():
    return 'Hello world, welcome to MDM backend!'

if __name__ == '__main__':
    # Read PORT from environment variable, default to 8000
    port = int(os.getenv('PORT', 8000))
    # Run with host 0.0.0.0 to accept external connections
    app.run(host='0.0.0.0', port=port, debug=False)