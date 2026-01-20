import psycopg2
from psycopg2.extras import RealDictCursor
import os

def get_db_connection():
    conn = psycopg2.connect(os.getenv("DATABASE_URL"))
    return conn

def query_db(query, args=(), one=False):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(query, args)
        if query.strip().upper().startswith('SELECT') or 'RETURNING' in query.upper():
            rv = cur.fetchall()
            conn.commit()
            return (rv[0] if rv else None) if one else rv
        else:
            conn.commit()
            return None
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()

