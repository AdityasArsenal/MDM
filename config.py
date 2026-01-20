import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key')
    DATABASE_URL = os.getenv('DATABASE_URL')
    
    # Google OAuth
    GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
    GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET')
    
    # PhonePe
    PHONEPE_CLIENT_ID = os.getenv("PHONEPE_CLIENT_ID")
    PHONEPE_CLIENT_SECRET = os.getenv("PHONEPE_CLIENT_SECRET")
    PHONEPE_CLIENT_VERSION = os.getenv("PHONEPE_CLIENT_VERSION", "1")
    PHONEPE_ENV = os.getenv("PHONEPE_ENV", "PRODUCTION")
    BASE_URL = os.getenv("BASE_URL", "http://localhost:3000")
    DATABASE_URL = os.getenv("DATABASE_URL")
    SUPABASE_URL= os.getenv("SUPABASE_URL")
    SUPABASE_ANON_KEY=os.getenv("SUPABASE_ANON_KEY")

