from db import query_db

def get_meal_summary(user_id, year, month):
    query = """
        SELECT 
            SUM(cnt_1to5) as total_1to5,
            SUM(cnt_6to8) as total_6to8,
            SUM(CASE WHEN meal_type = 'rice' THEN cnt_1to5 * 0.1 + cnt_6to8 * 0.15 ELSE 0 END) as total_rice,
            SUM(CASE WHEN meal_type = 'wheat' THEN cnt_1to5 * 0.1 + cnt_6to8 * 0.15 ELSE 0 END) as total_wheat
        FROM meal_plans
        WHERE user_id = %s
        AND EXTRACT(YEAR FROM date) = %s
        AND EXTRACT(MONTH FROM date) = %s
    """
    result = query_db(query, (user_id, year, month), one=True)
    return {k: float(v) if v else 0 for k, v in result.items()} if result else {}

def get_stock_closing(user_id, year, month):
    # This requires complex logic linking meal usage to stock
    # For MVP, we'll just sum additions
    query = """
        SELECT 
            grade,
            SUM(rice_add) as rice_add,
            SUM(wheat_add) as wheat_add,
            SUM(oil_add) as oil_add
        FROM stock
        WHERE user_id = %s
        AND EXTRACT(YEAR FROM date) = %s
        AND EXTRACT(MONTH FROM date) = %s
        GROUP BY grade
    """
    results = query_db(query, (user_id, year, month))
    return {r['grade']: {k: float(v) if v else 0 for k, v in r.items() if k != 'grade'} for r in results} if results else {}

def get_milk_summary(user_id, year, month):
    query = """
        SELECT 
            SUM(children) as total_children,
            SUM(milk_rcpt) as total_milk_rcpt,
            SUM(ragi_rcpt) as total_ragi_rcpt
        FROM milk
        WHERE user_id = %s
        AND EXTRACT(YEAR FROM date) = %s
        AND EXTRACT(MONTH FROM date) = %s
    """
    result = query_db(query, (user_id, year, month), one=True)
    return {k: float(v) if v else 0 for k, v in result.items()} if result else {}

def get_egg_summary(user_id, year, month):
    query = """
        SELECT 
            payer,
            SUM(egg_m + egg_f) as total_eggs,
            SUM(chikki_m + chikki_f) as total_chikki,
            SUM((egg_m + egg_f) * egg_price) as cost_eggs,
            SUM((chikki_m + chikki_f) * banana_price) as cost_chikki
        FROM egg
        WHERE user_id = %s
        AND EXTRACT(YEAR FROM date) = %s
        AND EXTRACT(MONTH FROM date) = %s
        GROUP BY payer
    """
    results = query_db(query, (user_id, year, month))
    return {r['payer']: {k: float(v) if v else 0 for k, v in r.items() if k != 'payer'} for r in results} if results else {}

