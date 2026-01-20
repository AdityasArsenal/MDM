-- MDM Database Schema
-- minimal, clean, mobile-first

-- 1. users
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) UNIQUE NOT NULL,
  name varchar(255),
  google_id varchar(255) UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. meal_plans
CREATE TABLE IF NOT EXISTS meal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  date date NOT NULL,
  cnt_1to5 int DEFAULT 0,
  cnt_6to8 int DEFAULT 0,
  meal_type varchar(10), -- 'rice' or 'wheat'
  has_pulses boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_meal_user_date ON meal_plans(user_id, date);

-- 3. stock
CREATE TABLE IF NOT EXISTS stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  date date NOT NULL,
  grade varchar(10) NOT NULL, -- '1to5' or '6to8'
  rice_add numeric(10,3) DEFAULT 0,
  wheat_add numeric(10,3) DEFAULT 0,
  oil_add numeric(10,3) DEFAULT 0,
  pulse_add numeric(10,3) DEFAULT 0,
  rice_open numeric(10,3), -- only for day 1
  wheat_open numeric(10,3),
  oil_open numeric(10,3),
  pulse_open numeric(10,3),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date, grade)
);
CREATE INDEX IF NOT EXISTS idx_stock_user_date ON stock(user_id, date);

-- 4. milk
CREATE TABLE IF NOT EXISTS milk (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  date date NOT NULL,
  children int DEFAULT 0,
  milk_open numeric(10,3) DEFAULT 0,
  ragi_open numeric(10,3) DEFAULT 0,
  milk_rcpt numeric(10,3) DEFAULT 0,
  ragi_rcpt numeric(10,3) DEFAULT 0,
  dist_type varchar(20) DEFAULT 'milk & ragi', -- 'milk & ragi' or 'only milk'
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_milk_user_date ON milk(user_id, date);

-- 5. egg
CREATE TABLE IF NOT EXISTS egg (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  date date NOT NULL,
  payer varchar(10), -- 'APF', 'GOV', or null
  egg_m int DEFAULT 0,
  egg_f int DEFAULT 0,
  chikki_m int DEFAULT 0,
  chikki_f int DEFAULT 0,
  egg_price numeric(10,2) DEFAULT 6,
  banana_price numeric(10,2) DEFAULT 6,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_egg_user_date ON egg(user_id, date);

-- 6. payments
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  order_id varchar(50) UNIQUE NOT NULL,
  plan varchar(20), -- '1_month', '3_month'
  amount numeric(10,2),
  status varchar(20) DEFAULT 'pending',
  pp_data jsonb, -- PhonePe response
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_user ON payments(user_id);

-- 7. subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES payments(id),
  plan_type varchar(20), -- '1_month', '3_month'
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  status varchar(20) DEFAULT 'active', -- 'active', 'expired'
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sub_user ON subscriptions(user_id);

-- 8. stock_daily_view (Virtual table for reporting)
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
