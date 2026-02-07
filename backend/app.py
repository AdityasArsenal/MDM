from flask import Flask
from flask_cors import CORS
from config import Config
from routes.auth import auth_bp
from routes.meal import meal_bp
from routes.stock import stock_bp
from routes.milk import milk_bp
from routes.egg import egg_bp
from routes.pay import pay_bp
from routes.sub import sub_bp

app = Flask(__name__)
app.config.from_object(Config)

# Enable CORS for frontend
CORS(app, resources={r"/api/*": {"origins": "*"}})

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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

