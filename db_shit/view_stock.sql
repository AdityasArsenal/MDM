-- stock_daily_view (Virtual table for reporting)
-- Joins meal_plans usage with stock additions to calculate daily balance
CREATE OR REPLACE VIEW stock_daily_view AS
SELECT
    s.user_id,
    s.date,
    s.grade,
    s.rice_add,
    s.wheat_add,
    s.oil_add,
    s.pulse_add,
    -- Calculate usage from meal_plans
    CASE 
        WHEN mp.meal_type = 'rice' THEN 
            (CASE WHEN s.grade = '1to5' THEN mp.cnt_1to5 * 0.1 ELSE mp.cnt_6to8 * 0.15 END)
        ELSE 0 
    END as rice_used,
    CASE 
        WHEN mp.meal_type = 'wheat' THEN 
            (CASE WHEN s.grade = '1to5' THEN mp.cnt_1to5 * 0.1 ELSE mp.cnt_6to8 * 0.15 END)
        ELSE 0 
    END as wheat_used,
    (CASE WHEN s.grade = '1to5' THEN mp.cnt_1to5 * 0.005 ELSE mp.cnt_6to8 * 0.0075 END) as oil_used
FROM stock s
LEFT JOIN meal_plans mp ON s.user_id = mp.user_id AND s.date = mp.date;

